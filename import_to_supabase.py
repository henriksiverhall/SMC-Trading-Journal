"""
TradeLog - CSV till Supabase market_bars import
==================================================

Kör detta skript LOKALT (inte i Claude). Det läser en MetaTrader-CSV
(format: YYYY-MM-DD HH:MM,open,high,low,close,volume, inget header)
grupperar raderna per dag, och pushar dem till Supabase market_bars
via REST API med ON CONFLICT DO NOTHING (skriver aldrig över befintliga
rader, t.ex. Yahoo-data).

ANVÄNDNING:
1. pip install requests
2. Sätt SUPABASE_URL och SUPABASE_SERVICE_KEY nedan (eller som env vars)
3. Justera CSV_PATH, SYMBOL, INTERVAL, CUTOFF_DATE
4. python import_to_supabase.py

CUTOFF_DATE: importerar bara dagar FÖRE detta datum (exklusivt).
Sätt till None för att importera alla dagar i filen.
"""

import csv
import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime

import requests

# ============================================================
# KONFIGURATION - ändra dessa per körning
# ============================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://qmmpxupsxdouvoqgvgri.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtbXB4dXBzeGRvdXZvcWd2Z3JpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE2NzY3OSwiZXhwIjoyMDk2NzQzNjc5fQ.sn2QcTN3jyNj3HipQklvUmWCWbl8e9v3_F-r9v7oRRs")

CSV_PATH = "EURUSD_M5.csv"      # sökväg till CSV-filen
SYMBOL = "EURUSD=X"             # Yahoo-symbol-format, t.ex. EURUSD=X, GBPUSD=X
INTERVAL = "5m"                 # matchar interval-kolumnen i market_bars
CUTOFF_DATE = "2026-03-26"      # importera bara dagar FÖRE detta datum (Yahoo äger från detta datum)
                                 # Sätt till None för att importera allt

BATCH_SIZE = 1                  # antal dagar per HTTP-request mot Supabase
                                 # OBS: sätt till 1 om databasen kan innehålla enstaka
                                 # dagar som redan importerats - annars stoppar en
                                 # konflikt i en stor batch HELA batchen (alla dess dagar)
REQUEST_TIMEOUT = 60            # sekunder
RETRY_ATTEMPTS = 3
RETRY_DELAY = 2                 # sekunder mellan omförsök

# ============================================================
# SKRIPT - normalt inget att ändra här
# ============================================================


def parse_csv(csv_path, cutoff_date):
    """Läser CSV och grupperar bars per datum (YYYY-MM-DD)."""
    days = defaultdict(list)
    cutoff = datetime.strptime(cutoff_date, "%Y-%m-%d").date() if cutoff_date else None

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        row_count = 0
        skipped = 0
        for row in reader:
            if not row or len(row) < 6:
                continue
            row_count += 1
            dt_str, o, h, l, c, v = row[0], row[1], row[2], row[3], row[4], row[5]
            # dt_str format: "2023-10-11 16:40"
            date_part, time_part = dt_str.split(" ")

            if cutoff:
                row_date = datetime.strptime(date_part, "%Y-%m-%d").date()
                if row_date >= cutoff:
                    skipped += 1
                    continue

            days[date_part].append({
                "time": time_part,
                "open": float(o),
                "high": float(h),
                "low": float(l),
                "close": float(c),
                "volume": int(v),
            })

    print(f"Lästa rader: {row_count}, hoppade över (>= cutoff): {skipped}")
    print(f"Dagar att importera: {len(days)}")
    return days


def chunked(items, size):
    items = list(items)
    for i in range(0, len(items), size):
        yield items[i:i + size]


def push_batch(session, day_batch, symbol, interval):
    """Pushar en batch av dagar till Supabase via REST API (upsert med ON CONFLICT DO NOTHING)."""
    payload = []
    for date_str, bars in day_batch:
        payload.append({
            "symbol": symbol,
            "interval": interval,
            "date": date_str,
            "bars": bars,
        })

    url = f"{SUPABASE_URL}/rest/v1/market_bars"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        # Resolution=ignore-duplicates -> motsvarar ON CONFLICT DO NOTHING
        # kräver att (symbol, interval, date) har en unique constraint i tabellen
        "Prefer": "resolution=ignore-duplicates,return=minimal",
    }

    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            resp = session.post(url, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
            if resp.status_code in (200, 201, 204):
                return True, resp.status_code
            elif resp.status_code == 409:
                # Raden finns redan (unique constraint) - det är OK, hoppa bara över.
                # Detta är vad ON CONFLICT DO NOTHING simulerar när vi kör 1 dag per request.
                return True, "409-already-exists"
            else:
                print(f"  Försök {attempt}: HTTP {resp.status_code} - {resp.text[:300]}")
        except requests.exceptions.RequestException as e:
            print(f"  Försök {attempt}: Nätverksfel - {e}")

        if attempt < RETRY_ATTEMPTS:
            time.sleep(RETRY_DELAY)

    return False, None


def main():
    if SUPABASE_SERVICE_KEY == "PASTE_YOUR_SERVICE_ROLE_KEY_HERE":
        print("FEL: Du måste sätta SUPABASE_SERVICE_KEY (i skriptet eller som env var).")
        print("Hämtas från: Supabase Dashboard -> Project Settings -> API -> service_role (secret)")
        sys.exit(1)

    if not os.path.exists(CSV_PATH):
        print(f"FEL: Hittar inte filen {CSV_PATH}")
        sys.exit(1)

    print(f"Läser {CSV_PATH} ...")
    days = parse_csv(CSV_PATH, CUTOFF_DATE)

    if not days:
        print("Inga dagar att importera (kolla CUTOFF_DATE eller filinnehåll). Avslutar.")
        return

    sorted_days = sorted(days.items())  # [(date_str, bars), ...] sorterat på datum

    total_batches = (len(sorted_days) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"Importerar {len(sorted_days)} dagar i {total_batches} batchar (a {BATCH_SIZE} dagar)")
    print(f"Symbol: {SYMBOL}, Interval: {INTERVAL}")
    print(f"Datumintervall: {sorted_days[0][0]} -> {sorted_days[-1][0]}")
    print()

    session = requests.Session()
    success_count = 0
    already_exists_count = 0
    fail_count = 0

    for i, batch in enumerate(chunked(sorted_days, BATCH_SIZE), start=1):
        first_date = batch[0][0]
        last_date = batch[-1][0]
        print(f"Batch {i}/{total_batches}: {first_date} -> {last_date} ({len(batch)} dagar) ... ", end="", flush=True)

        ok, status = push_batch(session, batch, SYMBOL, INTERVAL)
        if ok and status == "409-already-exists":
            print("redan importerad, hoppar över")
            already_exists_count += len(batch)
        elif ok:
            print(f"OK ({status})")
            success_count += len(batch)
        else:
            print("MISSLYCKADES efter alla försök")
            fail_count += len(batch)

        # Liten paus för att inte överbelasta API:et
        time.sleep(0.15)

    print()
    print("=" * 50)
    print(f"KLART. Nya dagar: {success_count}, Redan importerade (hoppade över): {already_exists_count}, Misslyckade: {fail_count}")
    if fail_count > 0:
        print("OBS: Vissa dagar misslyckades pga riktiga fel (nätverk/server). Kör skriptet igen -")
        print("redan importerade dagar hoppas automatiskt över, så det är säkert att köra om.")


if __name__ == "__main__":
    main()
