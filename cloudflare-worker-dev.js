// Cloudflare Worker – Anthropic API proxy + Kanban + Market Data + Calendar (EODHD primär, FF fallback)
// Secrets: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, KANBAN_SECRET, EODHD_API_KEY

const ALLOWED_ORIGINS = [
  'https://smc-trading-journal-dev.henrik-siverhall.workers.dev',
  'https://dev.journal.smctrading.se',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Kanban-Secret, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

const ADMIN_USER_ID = 'a55874aa-d36a-4d07-a40f-778b3a66d671';

// ── Impact-mappning för EODHD event-typer ────────────────────────────────────
// High   = typiskt >0.3% prisrörelse, marknadsmovande
// Medium = viktiga men mer förutsägbara, eller regionalt viktiga
// Low    = bakgrundsdata, tal, indikatorer med liten direkt effekt
const IMPACT_MAP = {
  // ── USA – High Impact ────────────────────────────────────────────────────────
  'Non-Farm Payrolls': 'High',
  'Nonfarm Payrolls': 'High',
  'Unemployment Rate': 'High',
  'CPI': 'High',
  'Consumer Price Index': 'High',
  'Core CPI': 'High',
  'Core Consumer Price Index': 'High',
  'PCE Price Index': 'High',
  'Core PCE Price Index': 'High',
  'Personal Consumption Expenditures': 'High',
  'Fed Interest Rate Decision': 'High',
  'Federal Funds Rate': 'High',
  'FOMC Statement': 'High',
  'FOMC Press Conference': 'High',
  'Fed Chair Powell Speech': 'High',
  'Fed Chair Speech': 'High',
  'GDP Growth Rate': 'High',
  'GDP': 'High',
  'Advance GDP': 'High',
  'Preliminary GDP': 'High',
  'Final GDP': 'High',
  'GDP Price Index': 'High',
  'Retail Sales': 'High',
  'Core Retail Sales': 'High',
  'ISM Manufacturing PMI': 'High',
  'ISM Services PMI': 'High',
  'ISM Non-Manufacturing PMI': 'High',
  'PPI': 'High',
  'Producer Price Index': 'High',
  'Core PPI': 'High',
  'Initial Jobless Claims': 'High',
  'Jobless Claims': 'High',
  'Average Hourly Earnings': 'High',
  'JOLTS Job Openings': 'High',
  'ADP Employment Change': 'High',
  'Trade Balance': 'High',
  'Durable Goods Orders': 'High',
  'Consumer Confidence': 'High',
  'CB Consumer Confidence': 'High',
  'Michigan Consumer Sentiment': 'High',
  'UoM Consumer Sentiment': 'High',
  'New Home Sales': 'High',
  'Existing Home Sales': 'High',
  'Housing Starts': 'High',
  'Building Permits': 'High',
  // ── Centralbanker – High Impact ──────────────────────────────────────────────
  'ECB Interest Rate Decision': 'High',
  'ECB Monetary Policy Statement': 'High',
  'ECB Press Conference': 'High',
  'ECB President Lagarde Speech': 'High',
  'BoE Interest Rate Decision': 'High',
  'Bank of England Interest Rate': 'High',
  'MPC Vote': 'High',
  'BoJ Interest Rate Decision': 'High',
  'Bank of Japan Interest Rate': 'High',
  'BoC Interest Rate Decision': 'High',
  'Bank of Canada Interest Rate': 'High',
  'RBA Interest Rate Decision': 'High',
  'Cash Rate': 'High',
  'SNB Interest Rate Decision': 'High',
  'RBNZ Interest Rate Decision': 'High',
  'Riksbank Interest Rate': 'High',
  // ── Europa – High Impact ─────────────────────────────────────────────────────
  'German CPI': 'High',
  'German GDP': 'High',
  'German ZEW Economic Sentiment': 'High',
  'German Ifo Business Climate': 'High',
  'Eurozone CPI': 'High',
  'Euro Area CPI': 'High',
  'Flash CPI': 'High',
  'Eurozone GDP': 'High',
  'Euro Area GDP': 'High',
  'Eurozone Unemployment': 'High',
  'UK CPI': 'High',
  'UK GDP': 'High',
  'UK Unemployment Rate': 'High',
  'Claimant Count Change': 'High',
  'UK Retail Sales': 'High',
  'French CPI': 'High',
  'Italian CPI': 'High',
  'Spanish CPI': 'High',
  // ── Asien/Övrigt – High Impact ───────────────────────────────────────────────
  'Japan CPI': 'High',
  'Tokyo CPI': 'High',
  'Japan GDP': 'High',
  'China CPI': 'High',
  'China GDP': 'High',
  'Caixin Manufacturing PMI': 'High',
  'NBS Manufacturing PMI': 'High',
  'Australia CPI': 'High',
  'Canada Employment Change': 'High',
  'Canada Unemployment Rate': 'High',
  'Canada CPI': 'High',
  'Canada GDP': 'High',
  'Oil Inventories': 'High',
  'Crude Oil Inventories': 'High',
  'EIA Crude Oil Stocks Change': 'High',
  'OPEC Meeting': 'High',
  // ── Medium Impact ────────────────────────────────────────────────────────────
  'Flash Manufacturing PMI': 'Medium',
  'Flash Services PMI': 'Medium',
  'Markit Manufacturing PMI': 'Medium',
  'Markit Services PMI': 'Medium',
  'Manufacturing PMI': 'Medium',
  'Services PMI': 'Medium',
  'Composite PMI': 'Medium',
  'Industrial Production': 'Medium',
  'Manufacturing Production': 'Medium',
  'Capacity Utilization': 'Medium',
  'Factory Orders': 'Medium',
  'Business Inventories': 'Medium',
  'Wholesale Inventories': 'Medium',
  'Import Price Index': 'Medium',
  'Export Price Index': 'Medium',
  'Current Account': 'Medium',
  'Budget Balance': 'Medium',
  'Federal Budget Balance': 'Medium',
  'Goods Trade Balance': 'Medium',
  'Pending Home Sales': 'Medium',
  'Case-Shiller Home Price': 'Medium',
  'NAHB Housing Market Index': 'Medium',
  'Philadelphia Fed Manufacturing': 'Medium',
  'Empire State Manufacturing': 'Medium',
  'Richmond Fed Manufacturing': 'Medium',
  'Kansas City Fed Manufacturing': 'Medium',
  'Chicago PMI': 'Medium',
  'Dallas Fed Manufacturing': 'Medium',
  'Beige Book': 'Medium',
  'FOMC Minutes': 'Medium',
  'Fed Minutes': 'Medium',
  'ECB Minutes': 'Medium',
  'BoE Minutes': 'Medium',
  'BoE Inflation Report': 'Medium',
  'Monetary Policy Report': 'Medium',
  'German Factory Orders': 'Medium',
  'German Industrial Production': 'Medium',
  'German Retail Sales': 'Medium',
  'German Trade Balance': 'Medium',
  'Eurozone Industrial Production': 'Medium',
  'Eurozone Trade Balance': 'Medium',
  'Eurozone Retail Sales': 'Medium',
  'Eurozone Sentix Investor Confidence': 'Medium',
  'GfK Consumer Confidence': 'Medium',
  'ZEW Economic Sentiment': 'Medium',
  'Ifo Business Climate': 'Medium',
  'UK Manufacturing PMI': 'Medium',
  'UK Services PMI': 'Medium',
  'UK Construction PMI': 'Medium',
  'UK Housing Price Index': 'Medium',
  'UK Average Earnings': 'Medium',
  'Japan Tankan': 'Medium',
  'Japan Industrial Production': 'Medium',
  'Japan Retail Sales': 'Medium',
  'Japan Trade Balance': 'Medium',
  'Australia Employment Change': 'Medium',
  'Australia Unemployment Rate': 'Medium',
  'Australia Retail Sales': 'Medium',
  'Australia Trade Balance': 'Medium',
  'China Trade Balance': 'Medium',
  'China Industrial Production': 'Medium',
  'China Retail Sales': 'Medium',
  'Canada Retail Sales': 'Medium',
  'Canada Trade Balance': 'Medium',
  'Canada Manufacturing Sales': 'Medium',
  'Natural Gas Storage': 'Medium',
  'EIA Natural Gas Stocks Change': 'Medium',
  'API Crude Oil Stock Change': 'Medium',
  'Unemployment Claims': 'Medium',
  'Continuing Jobless Claims': 'Medium',
  'Personal Income': 'Medium',
  'Personal Spending': 'Medium',
  'Consumer Spending': 'Medium',
  'Core Durable Goods Orders': 'Medium',
  'Capital Expenditure': 'Medium',
  'GDP Annual Growth Rate': 'Medium',
  'Inflation Rate': 'Medium',
  'Core Inflation Rate': 'Medium',
  'Producer Prices': 'Medium',
  'Retail Price Index': 'Medium',
};

function getImpact(eventType) {
  if (!eventType) return 'Low';
  if (IMPACT_MAP[eventType]) return IMPACT_MAP[eventType];
  const upper = eventType.toUpperCase();
  for (const [key, impact] of Object.entries(IMPACT_MAP)) {
    if (upper.includes(key.toUpperCase())) return impact;
  }
  const highKw = ['INTEREST RATE', 'RATE DECISION', 'NFP', 'NON-FARM', 'CPI', 'INFLATION', 'GDP', 'FOMC', 'FED CHAIR', 'ECB PRESIDENT', 'BOE GOVERNOR', 'BOJ GOVERNOR', 'UNEMPLOYMENT RATE', 'PAYROLL', 'JOLTS'];
  const medKw  = ['PMI', 'RETAIL SALES', 'INDUSTRIAL', 'TRADE BALANCE', 'HOUSING', 'CONSUMER CONFIDENCE', 'SENTIMENT', 'FACTORY', 'INVENTORIES', 'MINUTES', 'BEIGE BOOK', 'EARNINGS', 'PRODUCTION'];
  if (highKw.some(k => upper.includes(k))) return 'High';
  if (medKw.some(k => upper.includes(k)))  return 'Medium';
  return 'Low';
}

const COUNTRY_TO_CURRENCY = {
  US: 'USD', EA: 'EUR', EU: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
  GB: 'GBP', JP: 'JPY', CA: 'CAD', AU: 'AUD', NZ: 'NZD', CH: 'CHF',
  CN: 'CNY', KR: 'KRW', SE: 'SEK', NO: 'NOK', DK: 'DKK', MX: 'MXN',
  BR: 'BRL', IN: 'INR', SG: 'SGD', HK: 'HKD',
};

function normalizeEodhdEvent(ev) {
  const country = COUNTRY_TO_CURRENCY[ev.country] || ev.country || 'USD';
  const impact  = getImpact(ev.type);
  const dateStr = ev.date ? ev.date.replace(' ', 'T') + '-04:00' : null;
  return {
    title:    ev.type     || '',
    country,
    date:     dateStr,
    impact,
    actual:   ev.actual   != null ? String(ev.actual)   : '',
    forecast: ev.estimate != null ? String(ev.estimate) : '',
    previous: ev.previous != null ? String(ev.previous) : '',
  };
}

async function calendarRefreshFromEodhd(env) {
  const today = new Date();
  const from  = today.toISOString().slice(0, 10);
  const to    = new Date(today.getTime() + 13 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const url   = `https://eodhd.com/api/economic-events?api_token=${env.EODHD_API_KEY}&from=${from}&to=${to}&fmt=json`;
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'TradeLog/2.0' } });
    if (!resp.ok) return { ok: false, error: `EODHD HTTP ${resp.status}`, source: 'eodhd' };
    const raw = await resp.json();
    if (!Array.isArray(raw)) return { ok: false, error: 'EODHD non-array response', source: 'eodhd' };
    const normalized = raw.map(normalizeEodhdEvent);
    await calendarWriteCache(env, 'thisweek', normalized);
    return { ok: true, events: normalized.length, source: 'eodhd', from, to };
  } catch (e) { return { ok: false, error: e.message, source: 'eodhd' }; }
}

async function calendarRefreshFromFF(env) {
  const ffUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
  try {
    const resp = await fetch(ffUrl, { headers: { 'User-Agent': 'TradeLog/2.0' } });
    if (!resp.ok) return { ok: false, error: `FF HTTP ${resp.status}`, source: 'ff' };
    const text = await resp.text();
    if (text.trim().startsWith('<')) return { ok: false, error: 'FF rate-limited', source: 'ff' };
    let data; try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'JSON parse failed', source: 'ff' }; }
    await calendarWriteCache(env, 'thisweek', data);
    return { ok: true, events: data.length, source: 'ff' };
  } catch (e) { return { ok: false, error: e.message, source: 'ff' }; }
}

async function calendarRefresh(env) {
  const eodhd = await calendarRefreshFromEodhd(env);
  if (eodhd.ok) return { primary: eodhd, fallback: null };
  const ff = await calendarRefreshFromFF(env);
  return { primary: eodhd, fallback: ff };
}

const TRACKED_SYMBOLS = [
  { symbol: 'NQ=F',     label: 'NQ/MNQ – Nasdaq-100 futures' },
  { symbol: 'ES=F',     label: 'ES/MES – S&P 500 futures' },
  { symbol: 'YM=F',     label: 'YM/MYM – Dow Jones futures' },
  { symbol: 'RTY=F',    label: 'RTY/M2K – Russell 2000 futures' },
  { symbol: 'EURUSD=X', label: 'EUR/USD' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD' },
  { symbol: 'USDJPY=X', label: 'USD/JPY' },
  { symbol: 'AUDUSD=X', label: 'AUD/USD' },
  { symbol: 'USDCAD=X', label: 'USD/CAD' },
  { symbol: 'USDCHF=X', label: 'USD/CHF' },
  { symbol: 'NZDUSD=X', label: 'NZD/USD' },
  { symbol: 'EURGBP=X', label: 'EUR/GBP' },
  { symbol: 'EURJPY=X', label: 'EUR/JPY' },
  { symbol: 'GBPJPY=X', label: 'GBP/JPY' },
];

const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

async function verifyAdminJWT(env, authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data?.id === ADMIN_USER_ID;
}

async function calendarReadCache(env, weekKey) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/calendar_cache?week_key=eq.${weekKey}&select=data,fetched_at`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

async function calendarWriteCache(env, weekKey, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/calendar_cache`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ week_key: weekKey, data, fetched_at: new Date().toISOString() }),
  });
  return res.ok;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403, headers: cors });
    const url = new URL(request.url);

    if (url.pathname === '/calendar') {
      try {
        const cached = await calendarReadCache(env, 'thisweek');
        if (!cached) return json(cors, { error: 'Ingen kalenderdata i cache.' }, 503);
        return new Response(JSON.stringify(cached.data), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=3600', ...cors },
        });
      } catch (e) { return json(cors, { error: e.message }, 500); }
    }

    if (url.pathname === '/calendar/refresh') {
      const secret = request.headers.get('X-Kanban-Secret');
      if (secret !== env.KANBAN_SECRET) return json(cors, { error: 'Unauthorized' }, 401);
      return json(cors, await calendarRefresh(env));
    }

    if (url.pathname === '/calendar/refresh-admin') {
      const isAdmin = await verifyAdminJWT(env, request.headers.get('Authorization'));
      if (!isAdmin) return json(cors, { error: 'Unauthorized' }, 401);
      return json(cors, await calendarRefresh(env));
    }

    if (url.pathname === '/test-yahoo') {
      const symbol = url.searchParams.get('symbol') || 'NQ=F';
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`, { headers: YAHOO_HEADERS });
        const text = await res.text();
        return json(cors, { status: res.status, ok: res.ok, bodyPreview: text.slice(0, 1500) });
      } catch (err) { return json(cors, { error: err.message }, 500); }
    }

    if (url.pathname === '/sync-market-data') {
      const secret = request.headers.get('X-Kanban-Secret');
      if (secret !== env.KANBAN_SECRET) return json(cors, { error: 'Unauthorized' }, 401);
      const symbolParam = url.searchParams.get('symbol');
      if (!symbolParam) return json(cors, { info: 'Specify ?symbol=XXX', availableSymbols: TRACKED_SYMBOLS.map(s => s.symbol) });
      const entry = TRACKED_SYMBOLS.find(s => s.symbol === symbolParam);
      if (!entry) return json(cors, { error: 'Unknown symbol' }, 400);
      return json(cors, await syncOneSymbol(env, entry));
    }

    if (url.pathname === '/sync-group') {
      const secret = request.headers.get('X-Kanban-Secret');
      if (secret !== env.KANBAN_SECRET) return json(cors, { error: 'Unauthorized' }, 401);
      const groupIndex = parseInt(url.searchParams.get('group') ?? '', 10);
      if (isNaN(groupIndex)) return json(cors, { error: 'Specify ?group=0 through ?group=4' }, 400);
      const group = TRACKED_SYMBOLS.slice(groupIndex * 3, groupIndex * 3 + 3);
      if (!group.length) return json(cors, { error: 'No symbols in that group' }, 400);
      const results = [];
      for (const entry of group) results.push(await syncOneSymbol(env, entry));
      return json(cors, { groupIndex, results });
    }

    if (url.pathname === '/sync-status') {
      const secret = request.headers.get('X-Kanban-Secret');
      if (secret !== env.KANBAN_SECRET) return json(cors, { error: 'Unauthorized' }, 401);
      const statuses = [];
      for (const { symbol, label } of TRACKED_SYMBOLS) {
        const existing = await supabaseFetch(env, `market_bars?symbol=eq.${encodeURIComponent(symbol)}&interval=eq.5m&select=date&order=date.desc&limit=1`);
        const earliest = await supabaseFetch(env, `market_bars?symbol=eq.${encodeURIComponent(symbol)}&interval=eq.5m&select=date&order=date.asc&limit=1`);
        statuses.push({ symbol, label, latestDate: existing?.[0]?.date || null, earliestDate: earliest?.[0]?.date || null });
      }
      return json(cors, { statuses });
    }

    if (url.pathname === '/market-data') {
      const symbol = url.searchParams.get('symbol'), from = url.searchParams.get('from'), to = url.searchParams.get('to');
      if (!symbol || !from || !to) return json(cors, { error: 'symbol, from, to required' }, 400);
      const data = await supabaseFetch(env, `market_bars?symbol=eq.${encodeURIComponent(symbol)}&interval=eq.5m&date=gte.${from}&date=lte.${to}&select=date,bars&order=date.asc`);
      return json(cors, { symbol, from, to, days: data });
    }

    if (url.pathname === '/admin/update-user') {
      const isAdmin = await verifyAdminJWT(env, request.headers.get('Authorization'));
      if (!isAdmin) return json(cors, { error: 'Unauthorized' }, 401);
      const body = await request.json().catch(() => ({}));
      const { userId, updates } = body;
      if (!userId || !updates) return json(cors, { error: 'userId och updates krävs' }, 400);
      const safeUpdates = {};
      if (updates.email) safeUpdates.email = updates.email;
      if (Object.keys(safeUpdates).length === 0) return json(cors, { error: 'Inget giltigt fält' }, 400);
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` },
        body: JSON.stringify(safeUpdates),
      });
      const data = await res.json();
      if (!res.ok) return json(cors, { error: data.message || 'Supabase-fel' }, res.status);
      return json(cors, { success: true, email: data.email });
    }

    if (url.pathname.startsWith('/kanban')) {
      const secret = request.headers.get('X-Kanban-Secret');
      if (secret !== env.KANBAN_SECRET) return json(cors, { error: 'Unauthorized' }, 401);
      if (url.pathname === '/kanban/read') return await kanbanRead(env, cors);
      const body = await request.json().catch(() => ({}));
      if (url.pathname === '/kanban/update') return await kanbanUpdate(env, body, cors);
      if (url.pathname === '/kanban/add')    return await kanbanAdd(env, body, cors);
      if (url.pathname === '/kanban/delete') return await kanbanDelete(env, body, cors);
      return json(cors, { error: 'Unknown endpoint' }, 404);
    }

    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    try {
      const body = await request.json();
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      return json(cors, await response.json());
    } catch (err) { return json(cors, { error: err.message }, 500); }
  },

  async scheduled(event, env, ctx) {
    const result = await calendarRefresh(env);
    console.log('Calendar refresh:', JSON.stringify(result));
    const cronExpr = event.cron;
    const minuteMatch = cronExpr.match(/^(\d+)\s/);
    const minute = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
    const group = TRACKED_SYMBOLS.slice(Math.round(minute / 5) * 3, Math.round(minute / 5) * 3 + 3);
    if (group.length) {
      const results = [];
      for (const entry of group) results.push(await syncOneSymbol(env, entry));
      console.log('Market sync:', JSON.stringify(results));
    }
  },
};

function json(cors, data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}

async function supabaseFetch(env, path, method = 'GET', body = null) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : undefined },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Supabase ${method} ${path}: ${res.status} ${t}`); }
  return res.json();
}

async function syncOneSymbol(env, { symbol, label }) {
  const yesterday = new Date(); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  try {
    const existing = await supabaseFetch(env, `market_bars?symbol=eq.${encodeURIComponent(symbol)}&interval=eq.5m&select=date&order=date.desc&limit=1`);
    const latestCached = existing?.[0]?.date || null;
    if (latestCached && latestCached >= yesterdayStr) return { symbol, label, status: 'up_to_date', latestCached };
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=60d`, { headers: YAHOO_HEADERS });
    const rawText = await res.text();
    if (!res.ok) return { symbol, label, status: 'error', error: `Yahoo HTTP ${res.status}` };
    if (!rawText?.trim()) return { symbol, label, status: 'error', error: 'Empty response' };
    let data; try { data = JSON.parse(rawText); } catch (e) { return { symbol, label, status: 'error', error: 'JSON parse failed' }; }
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return { symbol, label, status: 'error', error: 'No timestamp data' };
    const quote = result.indicators.quote[0], timestamps = result.timestamp;
    const gmtOffset = result.meta?.gmtoffset || -18000, byDate = {};
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] == null) continue;
      const dateStr = new Date((timestamps[i] + gmtOffset) * 1000).toISOString().slice(0, 10);
      if (!byDate[dateStr]) byDate[dateStr] = [];
      const t = new Date(timestamps[i] * 1000);
      byDate[dateStr].push({ time: `${String(t.getUTCHours()).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')}`, open: quote.open[i], high: quote.high[i], low: quote.low[i], close: quote.close[i], volume: quote.volume[i] });
    }
    const datesToSave = Object.keys(byDate).filter(d => (!latestCached || d > latestCached) && d <= yesterdayStr);
    if (datesToSave.length > 0) await supabaseFetch(env, 'market_bars', 'POST', datesToSave.map(d => ({ symbol, interval: '5m', date: d, bars: byDate[d] })));
    return { symbol, label, status: 'synced', daysSaved: datesToSave.length };
  } catch (err) { return { symbol, label, status: 'error', error: err.message }; }
}

async function getSettings(env) {
  const data = await supabaseFetch(env, `user_settings?user_id=eq.${ADMIN_USER_ID}&select=settings`);
  return data?.[0]?.settings || {};
}
async function saveSettings(env, settings) {
  await supabaseFetch(env, `user_settings?user_id=eq.${ADMIN_USER_ID}`, 'PATCH', { settings, updated_at: new Date().toISOString() });
}
async function kanbanRead(env, cors) { const s = await getSettings(env); return json(cors, { tasks: s.roadmapTasks || [] }); }
async function kanbanUpdate(env, body, cors) {
  const { id, ...updates } = body; if (!id) return json(cors, { error: 'id required' }, 400);
  const s = await getSettings(env); const tasks = s.roadmapTasks || [];
  const idx = tasks.findIndex(t => t.id === id); if (idx === -1) return json(cors, { error: 'Not found' }, 404);
  tasks[idx] = { ...tasks[idx], ...updates, updated_at: new Date().toISOString() };
  await saveSettings(env, { ...s, roadmapTasks: tasks }); return json(cors, { success: true, task: tasks[idx] });
}
async function kanbanAdd(env, body, cors) {
  const { title, desc = '', category = 'feature', priority = 'medium', status = 'todo' } = body;
  if (!title) return json(cors, { error: 'title required' }, 400);
  const s = await getSettings(env); const tasks = s.roadmapTasks || [];
  const t = { id: 't' + Date.now(), title, desc, category, priority, status, created_at: new Date().toISOString(), updated_at: '' };
  tasks.push(t); await saveSettings(env, { ...s, roadmapTasks: tasks }); return json(cors, { success: true, task: t });
}
async function kanbanDelete(env, body, cors) {
  const { id } = body; if (!id) return json(cors, { error: 'id required' }, 400);
  const s = await getSettings(env);
  await saveSettings(env, { ...s, roadmapTasks: (s.roadmapTasks || []).filter(t => t.id !== id) });
  return json(cors, { success: true });
}
