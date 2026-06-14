# TradeLog v2.0 – Changelog

> Dev-miljö: smc-trading-journal-dev.henrik-siverhall.workers.dev  
> Branch: `dev` | Prod branch: `main`

---

## v2.0.2-dev – 2026-06-12

### Journal
- **Scale-in** – Lägg till flera entry-nivåer med antal kontrakt per nivå. Weighted average entry och totalt antal kontrakt beräknas och visas live.
- **Partial exits** – Registrera delvinsttagningar med pris och kontrakt. R beräknas som viktat genomsnitt av alla exits.
- **Monetärt resultat** – Visar +$X.XX i formulärheadern för futures-instrument baserat på pointValue × kontrakt × R.
- **Redigera trade** – Klicka trade i tabellen → detaljmodal → Redigera. Formuläret fylls inkl. scale-ins och partial exits.
- **Ta bort trade** – Ta bort-knapp i detaljmodal med bekräftelsedialog.
- **CSV-export** – Exportknappen i journaltabellen fungerar nu.

---

## v2.0.1-dev – 2026-06-12

### Infrastruktur
- **Auto-deploy** – Cloudflare Worker (`smc-trading-journal-dev`) kopplad till `dev`-branchen på GitHub. Push triggar automatisk build och deploy.
- **sessionStorage page-state** – Aktiv sida sparas i `sessionStorage` och återställs vid refresh (App.jsx).

### Kanban / Roadmap
- **Roadmap-sida** – Kanban med 6 kolumner: Att göra, Buggar, Pågående, Väntar, Klar, Parkerad.
- **Drag-and-drop** – Flytta kort mellan kolumner.
- **Taggar** – `[DEV]`, `[PROD]`, `[IDÉ]` med färgkodning (blå/röd/gul).
- **Admin-redigering** – Lägg till, redigera, ta bort kort (endast admin). Redigera-modal med kolumnbyte.
- **Prod Supabase-koppling** – Kanban läser/skriver alltid mot prod admin-användaren (`zmtpgnnqtkkdsrswhrzk`), oavsett miljö. En gemensam Kanban för dev och prod.
- **RLS-policy** – Public read på admin-raden i `user_settings` för att tillåta dev-appen att läsa utan auth.
- **Datamigrering** – `roadmapTasks` migrerades från gammalt array-format (med `status`-fält) till nytt objekt-format (`{todo:[], bugs:[], ...}`).

---

## v2.0.0-dev – 2026-06-11

### Grundstruktur
- React 18 + Vite 5, Recharts, Lucide React.
- Routing via React state (ingen React Router).
- Cloudflare Workers hosting (statisk deploy av `dist/`).
- Separat dev Supabase-instans (`qmmpxupsxdouvoqgvgri`).

### Auth
- Login, signup, logout via Supabase Auth.
- AuthContext (`useAuth`) med `user`, `userSettings`, `isAdmin`, `aiEnabled`, `saveSettings`.
- Protected pages – ej inloggad → AuthPage.

### Design system
- `globals.css` med CSS-variabler: `--bg`, `--bg2`, `--bg3`, `--accent` (#00d4aa), `--green`, `--red`.
- Font: Inter + JetBrains Mono.
- Sidebar (kollapsbar, 64px/220px) + Topbar.

### Sidor
- **Dashboard** – Stats-grid (WR, total R, PF, trades), senaste trades-lista.
- **Journal** – Trade-formulär (datum, tid, symbol, direction, entry/SL/TP, outcome, grade, emotion, strategi, anteckningar), trades-tabell, detaljmodal. Futures-spec badge (MNQ/NQ/MES/ES/MYM/YM).
- **Analytics** – Filter (outcome, direction, strategi), stats-grid, Grade-breakdown (bar chart), Emotion-breakdown (progress bars), Strategi-breakdown (tabell).
- **Profil** – Visningsnamn, risk%, kontostorlek, valuta, byt lösenord, radera konto.
- **Admin** – Användartabell, AI-toggle per användare, radera användare.
- **Checklist** – Platshållare (v2.0 TODO).

---

*Uppdateras vid varje ny deploy till dev-branchen.*
