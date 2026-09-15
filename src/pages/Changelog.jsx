import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'v2.4.8',
    date: '2026-09-15',
    entries: [
      { type: 'feature', text: 'Journal: när trade-gränsen nås visas nu en tydlig dialogruta mitt i bild, utöver den befintliga varningstexten under Spara-knappen. Dialogen har en knapp som tar användaren till Profil för att höra av sig om uppgradering.' },
    ]
  },
  {
    version: 'v2.4.7',
    date: '2026-09-15',
    entries: [
      { type: 'feature', text: 'Journal filtrerar nu automatiskt på aktivt konto vid kontobyte – man kan själv byta filtret till "Alla konton", men nästa gång man byter aktivt konto återgår filtret till att visa bara det nya kontots trades, så man inte råkar blanda ihop dem.' },
      { type: 'fix', text: 'Journal bulk-edit: strategiförslagen i "Strategi"-fältet visade bara strategier som redan användes i loggade trades, inte hela den sparade strategilistan (checklist-strategierna). Slog man in flera trades i ett nytt konto syntes därför bara en bråkdel av de riktiga strategierna. Datalistan slår nu ihop båda källorna.' },
      { type: 'fix', text: 'Admin → Användare: "Per konto"-statistik och kontoräknaren i Plan & gränser visade alltid 0 för andra användares konton, oavsett hur många konton de faktiskt hade skapat – en RLS-policy på accounts-tabellen saknade admin-undantag (till skillnad från trades, som redan hade det). Ny SELECT-policy tillagd i DEV-databasen.' },
    ]
  },
  {
    version: 'v2.4.6',
    date: '2026-08-12',
    entries: [
      { type: 'fix', text: 'Journal: bulk-edit-panelen (Konto/Strategi/Grade/Känsla) visar nu alla fält som egna rader direkt istället för att kräva att man först väljer fält i en dropdown – snabbare när man ska sätta samma sak upprepade gånger, och tydligare vilka fält som faktiskt går att sätta.' },
    ]
  },
  {
    version: 'v2.4.5',
    date: '2026-08-12',
    entries: [
      { type: 'feature', text: 'Journal: den tidigare "flytta till konto"-funktionen på markerade trades generaliserades till en riktig multi-edit – välj Konto, Strategi, Grade eller Känsla i en dropdown, sätt värde och tillämpa på alla markerade trades samtidigt. Kryssrutan för markering är nu alltid synlig i tabellen, inte bara vid flera konton.' },
    ]
  },
  {
    version: 'v2.4.4',
    date: '2026-08-12',
    entries: [
      { type: 'feature', text: 'Journal: ny "Planerat R:R"-ruta som visas direkt när Entry/Stop Loss/Take Profit (eller targets) är ifyllda – oavsett om Utfall är valt än. Tidigare krävde R-rutan att Utfall (W/L/BE) valdes först, vilket gjorde att den tilltänkta risk/reward-kvoten inte gick att se förrän i efterhand. Ersätts automatiskt av det faktiska R-resultatet när Utfall väljs.' },
    ]
  },
  {
    version: 'v2.4.3',
    date: '2026-08-12',
    entries: [
      { type: 'feature', text: 'Journal: bulk-flytt av trades mellan konton – markera flera trades med kryssrutor (syns när fler än ett konto finns) och flytta dem till valfritt konto i ett klick. Löser sortering av gamla trades som loggades innan flera-konton-systemet fanns, t.ex. blandad Free/Paid-historik.' },
    ]
  },
  {
    version: 'v2.4.2',
    date: '2026-08-12',
    entries: [
      { type: 'feature', text: 'Admin → Användare → Info-flik: ny "Per konto"-uppdelning (trades/Win Rate/Total R) när en användare har fler än ett trading-konto, utöver totalen över alla konton. Osynlig för användare med bara ett konto.' },
    ]
  },
  {
    version: 'v2.4.1',
    date: '2026-08-12',
    entries: [
      { type: 'fix', text: 'Admin → Användare: bytte den gamla 560px-modalen (fyra flikar, inkl. nya Plan & gränser) mot en sida-vid-sida-layout – sökbar, scrollbar användarlista till vänster (300px), inline detaljpanel till höger som fyller resten av bredden. Löser trångt känslan som uppstod när Plan & gränser-fliken lades till.' },
    ]
  },
  {
    version: 'v2.4.0',
    date: '2026-08-12',
    entries: [
      { type: 'feature', text: 'Flera trading-konton – grunden för att kunna ta betalt för TradeLog. Nytt konto-system (Profil → 💼 Trading-konton) där varje användare kan skapa flera konton (t.ex. TopStep + FundedNext), sätta typ/kontostorlek/status (eval/funded/failed) och byta aktivt konto via en ny kontoväljare i menyraden. Nya trades och importer taggas automatiskt med aktivt konto; Journal fick ett kontofilter och en Konto-kolumn (syns bara när fler än ett konto finns).' },
      { type: 'feature', text: 'Plan- och gränssystem – Free-plan (50 trades, 1 konto) och Paid-plan (obegränsat), med admin-redigerbara overrides per användare (Admin → användare → 💳 Plan & gränser). Gränserna skärms hårt på databasnivå (inte bara i UI), så de går inte att kringgå via API-anrop. Priser/gränser är just nu platshållarvärden, enkla att ändra.' },
    ]
  },
  {
    version: 'v2.3.9',
    date: '2026-08-11',
    entries: [
      { type: 'feature', text: 'Import: ny källa "FundedNext (Futures/CFD)" – hämtar trades direkt via FundedNexts MCP-API istället för manuell CSV-export. Egen API-token sparas per användare under Profil → Integrationer. Dubbletter identifieras via FundedNexts unika ticket-ID och exkluderas automatiskt vid ny hämtning. R-värde saknas fortfarande i källdatan (ingen SL/TP från FundedNext) – estimeras nu istället automatiskt utifrån sparad kontostorlek/risk% och märks tydligt som uppskattat (inte verklig R) i journalen.' },
      { type: 'infra', text: 'Ny Cloudflare Worker (tradelog-fundednext-dev) hanterar MCP-anropet och skrivningen till databasen JWT-skyddat – varje användares FundedNext-token används bara för att hämta det egna kontots trades.' },
    ]
  },
  {
    version: 'v2.3.8',
    date: '2026-08-11',
    entries: [
      { type: 'feature', text: 'Admin → 🤖 AI-analys: ny flik där prompten som skickas till AI-coachen i Analytics blir redigerbar istället för hårdkodad i koden. Prompten sparas globalt (gäller alla användare, inte per-konto) och stöder platshållare ({trades}, {wins}, {losses}, {winRate}, {totalR}, {profitFactor}, {strategies}, {recentTrades}) som fylls i automatiskt med varje användares egen statistik vid analystillfället. Felstavade platshållare (t.ex. fel skiftläge) lämnas synligt orörda i prompten istället för att tyst försvinna, så fel upptäcks direkt.' },
    ]
  },
  {
    version: 'v2.3.7',
    date: '2026-08-11',
    entries: [
      { type: 'fix', text: 'Journal: R/$ i formulärheadern hade ihoptryckt design – en delad box med en tunn vertikal divider, olika font-storlek på R (20px) och P&L (16px). Ersatt med två separata, tydligt separerade kort med matchande gröna/röda borders baserat på tecken (+/-), och samma font-storlek (22px) på båda värdena för konsekvent visuell hierarki.' },
    ]
  },
  {
    version: 'v2.3.6',
    date: '2026-08-10',
    entries: [
      { type: 'fix', text: 'Flera Analytics-widgets (Equity Curve, MFE/MAE, RR-optimerare, AI-analys) hade ett kvarlämnat inline style={{marginBottom:16}} på sitt rot-.card – ett arv från innan griden fanns, då de låg staplade som vanliga syskon-element. Det åt upp 16px av deras tilldelade cellhöjd, så deras synliga kant slutade 16px FÖRE resize-handtaget – motsatt fel mot det som redan fixades för Strategi-breakdown i v2.3.5. margin-bottom:0 !important på alla grid-widget-kort löser det slutgiltigt.' },
    ]
  },
  {
    version: 'v2.3.5',
    date: '2026-08-10',
    entries: [
      { type: 'fix', text: 'Strategi-breakdown (och andra widgets med bara header+rå-tabell, ingen card-body) kunde bli TALLARE än sin tilldelade grid-cell och sticka ut förbi resize-handtaget, eftersom en rå &lt;table&gt; vägrar krympa under sin innehållshöjd trots min-height:0 på förfäder. .card görs nu till en egen flex-kolumn där allt utom card-header krymper och scrollar internt istället.' },
    ]
  },
  {
    version: 'v2.3.4',
    date: '2026-08-10',
    entries: [
      { type: 'fix', text: 'Analytics: "Grade & Emotion" var en enda widget som internt renderade två separata kort (Win Rate per Grade / Win Rate per Emotion) sida vid sida – de såg ut som två oberoende widgets men gick inte att flytta, dölja eller ändra storlek på var för sig. Uppdelad i två riktiga widgets: "grade" och "emotion".' },
      { type: 'fix', text: 'Dashboard/Analytics: stat-mini-korten i Statistik-widgeten (t.ex. Trades, Win Rate, Total R) fick olika radhöjd beroende på om kortet hade en tredje textrad (t.ex. "7V · 2F" under Trades) eller inte – rad 1 blev synligt högre än rad 2 i samma .stats-grid. Fast minimihöjd + grid-auto-rows:1fr så alla rader blir lika höga oavsett innehåll.' },
      { type: 'feature', text: 'Dashboard: tillfällig, dismissible notis om den ombyggda widget-griden (v2.3.0–v2.3.3), synlig till 24 augusti eller tills man stänger den, för att förklara för befintliga användare varför deras layout återställdes till nytt standardläge.' },
    ]
  },
  {
    version: 'v2.3.3',
    date: '2026-08-10',
    entries: [
      { type: 'fix', text: 'Dashboard/Analytics-grid: widgets vars innehåll saknade explicit height:100% på sitt kort (t.ex. Operatör-widgeten) sträckte sig bara till sin naturliga innehållshöjd, inte hela den tilldelade grid-cellen. Två widgets med exakt samma cellhöjd (samma resize-handtags-position) kunde därför få sina synliga kanter på olika nivåer. .widget-grid-item-inner tvingar nu alltid sitt rotelement till full höjd, oavsett om den enskilda widget-definitionen kom ihåg height:100% eller inte.' },
    ]
  },
  {
    version: 'v2.3.2',
    date: '2026-08-10',
    entries: [
      { type: 'fix', text: 'Dashboard/Analytics-grid: drag och resize var alltid aktivt på desktop, oavsett om "Anpassa widgets" var öppen – man kunde råka flytta/ändra ett kort av misstag utan att ha klickat på knappen. Drag/resize (och dra-handtaget) kräver nu att Anpassa-läget faktiskt är påslaget.' },
      { type: 'fix', text: 'Dashboard/Analytics-grid: lade till en LAYOUT_VERSION-spärr så att framtida ändringar av default-storlekar/positioner självläker gamla eller felaktigt sparade layouts automatiskt vid nästa inläsning, istället för att kräva en manuell databas-reset (det som hände med v2.3.1:s bredd-bugg – en kort race condition runt deploy hann spara fel bredder innan fixen var live, och det satt sen kvar permanent tills det åtgärdades för hand).' },
      { type: 'fix', text: 'STAGING-bannern och "Visar som"-bannern (impersonation) kunde hamna delvis under eller överlappa sidomenyns logga/ikoner beroende på vilken kombination av banners som var synlig – Sidebar är position:fixed och påverkades därför inte av app-layouts marginTop, som bara var beräknat för STAGING-bannern. Räknar nu ut en gemensam total bannerhöjd som ges till både Sidebar och app-layout, oavsett vilka banners som visas.' },
    ]
  },
  {
    version: 'v2.3.1',
    date: '2026-07-21',
    entries: [
      { type: 'fix', text: 'Dashboard/Analytics-grid: default-layouten placerade widgets med halva radbredden (w:1 av 4 kolumner på desktop), vilket gav konstiga tomrum bredvid varje kort. Alla widgets får nu full radbredd som default (en per rad, individuell lagom höjd) – bredd/höjd kan fortfarande dras/ändras fritt av användaren efteråt.' },
    ]
  },
  {
    version: 'v2.3.0',
    date: '2026-07-21',
    entries: [
      { type: 'feature', text: 'Dashboard och Analytics – helt ny widget-grid byggd på react-grid-layout istället för den gamla CSS-grid-baserade DragGrid (som bara kunde ändra ORDNING i en fast 1-kolumnslayout). Widgets kan nu dras fritt till valfri position och ändras i storlek (bredd/höjd) genom att dra i hörnet, precis som i t.ex. TradingView eller Notion-dashboards. Storlek och position sparas per widget och per skärmstorlek (lg/md/sm/xs/xxs) i userSettings – varje användares layout är sin egen.' },
      { type: 'infra', text: 'Mobil (≤480px) forcerar fortfarande låst 1-kolumnsläge med drag/resize helt avstängt – samma säkerhetsnivå som tidigare, men hanteras nu av react-grid-layouts breakpoint-system istället för en CSS !important-regel.' },
      { type: 'infra', text: 'Gammalt widget-sparformat ({order, hidden, seenNew}) migreras automatiskt till det nya ({layouts: {lg,md,sm,xs,xxs}, hidden, seenNew}) första gången en användare öppnar Dashboard/Analytics efter uppdateringen – ingen manuell datamigrering krävs, och befintlig visa/dölj-inställning och ordning återanvänds som utgångspunkt för de nya positionerna.' },
      { type: 'infra', text: 'Widget-innehållet (card-body) scrollar nu internt (overflow-y:auto) om användaren gör ett kort mindre än sitt innehåll, istället för att klippa eller se trasigt ut – en förutsättning för att fri resize ska kännas säkert att använda.' },
    ]
  },
  {
    version: 'v2.2.0',
    date: '2026-07-21',
    entries: [
      { type: 'fix', text: 'Import: ingen av de fem parsrarna (TopstepX/ProjectX, TradingView Backtesting, Tradovate, MetaTrader, NinjaTrader) plockade ut klockslag ur sina timestamp-fält – bara datum, via formatDateStr(). Varken entry-tid eller Exit tid sparades därför någonsin för importerade trades, oavsett plattform. Ny formatTimeStr()-hjälpfunktion extraherar nu HH:MM, och alla fem parsrar sätter time/exit_time. handleImport() sparade dessutom inte t.exit_time till custom_data ens i fall parsern hade satt det – fixat i samma veva.' },
    ]
  },
  {
    version: 'v2.1.9',
    date: '2026-07-21',
    entries: [
      { type: 'fix', text: 'Import: Tradovate- och TopstepX/ProjectX-parsrarna sparade alltid pnl:null – de räknade ut en price-diff internt bara för att avgöra W/L/BE, men skrev aldrig ut den som dollar-P&L på traden. Det gjorde att v2.1.8:s R-kolumn-fallback inte hade något att visa för dessa två plattformar trots fixen. Båda parsrarna räknar nu ut faktiskt dollar-P&L via instrumentets point value (t.ex. $2/point för MNQ), med stöd för råa kontraktskoder som MNQU6/MYMM6 (månadsbokstav + årssiffra strippas vid uppslag mot FUTURES_SPECS).' },
    ]
  },
  {
    version: 'v2.1.8',
    date: '2026-07-21',
    entries: [
      { type: 'fix', text: 'Journal: importerade trades (Import.jsx, result: null) visade "—" i R-kolumnen både i tabellen och detaljvyn eftersom futures-trades saknar en pålitlig fast dollarrisk att räkna R ifrån (kontraktsbaserad risk är "trubbig" jämfört med FX). Tillfällig lösning: R-kolumnen faller nu tillbaka på det importerade dollar-P&L:et (custom_data._imported_pnl) när result saknas, istället för att visa en halvbra/felaktig R-approximation. Riktig R-beräkning väntar på beslut om SL-komplettering eller en broker/prop firm-koppling (MCP) som kan ge exakt riskdata per trade.' },
    ]
  },
  {
    version: 'v2.1.7',
    date: '2026-07-21',
    entries: [
      { type: 'fix', text: 'Journal: portat main v2.1.8 hit – tabellen visar nu även Exit tid och Faktisk exit (utöver Exit datum), och alla egna fält som förekommer i datan, med samma dynamiska logik som CSV-exporten.' },
      { type: 'fix', text: 'Journal: R-värdet kunde nollställas/bli fel när en befintlig trade redigerades och sparades utan att fälten rördes (stale-closure-bugg i startEdit(), portat från main v2.1.8).' },
      { type: 'infra', text: 'Staging synkad med main igen på Journal.jsx. Developer-menyn (ChatGPTs område) rörd inte alls.' },
    ]
  },
  {
    version: 'v2.1.6',
    date: '2026-07-18',
    entries: [
      { type: 'feature', text: 'Ny "Developer"-meny (admin-only, under Roadmap) – grundstruktur för projekthantering av Vision/TradeLog/FM Coach: Overview, Vision Blueprint, Architecture, Kanban, Roadmap, Schemas, Decision Log, Releases, Technical Debt och Ideas. Allt lagras i riktiga databastabeller (developer_projects, developer_components, developer_tasks, developer_milestones, developer_decisions, developer_releases, developer_technical_debt, developer_ideas, developer_documents) i DEV-Supabase – inga hårdkodade demo-kort. Admin-only RLS, timestamps, sortering, status och versionsfält på alla tabeller. Byggd som scaffold åt ChatGPT/Vision-utvecklingen att jobba vidare i. DEV-only tills vidare, rörs inte i PROD.' },
    ]
  },
  {
    version: 'v2.1.5',
    date: '2026-07-18',
    entries: [
      { type: 'fix', text: 'Journal: Exit datum, Exit tid, Faktisk exit och egna fält saknades i journal-tabellen och i CSV-exporten – de sparas i custom_data (JSON) men lästes bara ut i popup-rutan, inte i listan/exporten. Journal-tabellen visar nu en "Exit datum"-kolumn, och CSV-exporten är gjord dynamisk: den plockar automatiskt upp exit-fälten och alla egna fält som förekommer i datan. Synkad hit från main (där den heter v2.1.7).' },
      { type: 'infra', text: 'Staging fullt synkad med main igen: unreadBroadcast-fixen (main v2.1.6) och denna Journal-fix (main v2.1.7) är nu båda med här.' },
    ]
  },
  {
    version: 'v2.1.4',
    date: '2026-07-07',
    entries: [
      { type: 'infra', text: 'Grund för riktig staging-miljö: src/lib/supabase.js läser nu Supabase-URL/nyckel från miljövariabler (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) med säker fallback till hårdkodade PROD-värden. Ny branch "staging" skapad från main.' },
      { type: 'feature', text: 'Ovillkorlig STAGING-varningsbanner (rand-randigt orange, alltid överst) som visas när appen pratar mot en annan databas än PROD, baserat på faktisk Supabase-URL.' },
      { type: 'fix', text: 'Admin: unreadBroadcast-badgen rensades inte när admin publicerade ett eget broadcast-meddelande. BroadcastTab markerar nu meddelandet som läst för admin direkt vid publicering.' },
    ]
  },
  {
    version: 'v2.1.3',
    date: '2026-07-07',
    entries: [
      { type: 'fix', text: 'Admin: fliksraden (Användare/Support/Meddelanden/Branding/System) stack ut till höger på mobil – blir nu en horisontellt swipe-bar rad istället (ny .admin-tabs-klass).' },
      { type: 'fix', text: 'Admin: hårdkodad lösenordsåterställnings-URL (samma buggmönster som AuthPage hade före cutover) pekade fortfarande på gamla dev-Workerns egen URL – uppdaterad till journal.smctrading.se.' },
      { type: 'infra', text: '🔴 UPPTÄCKT (ej ännu åtgärdat, kräver manuell Worker-deploy): AI-proxy-Workerns CORS-whitelist (ALLOWED_ORIGINS) innehåller bara gamla dev-adresser, inte journal.smctrading.se. Bryter sannolikt AI-analys, kalender-refresh, bilduppladdning och marknadsdata (MFE/MAE) på den riktiga produktionsdomänen. Fixad kod levererad som fil till Henrik för manuell deploy – se Kanban.' },
    ]
  },
  {
    version: 'v2.1.2',
    date: '2026-07-07',
    entries: [
      { type: 'infra', text: 'Cloudflare Worker döpt om: smc-trading-journal-dev → smc-trading-journal (tar bort "-dev" från det som nu är produktion). wrangler.toml uppdaterad i samma steg så framtida auto-deploys pekar rätt. journal.smctrading.se (Custom Domain) opåverkad av namnbytet.' },
      { type: 'infra', text: 'GitHub-branchernas roller bytta: gamla main (v1.9.9) arkiverad som legacy-v1.9.9-archive, gamla dev (v2.x, den faktiska produktionskoden) döpt om till main och satt som default branch. Cloudflares build-koppling uppdaterad till att bygga från main.' },
      { type: 'infra', text: 'Supabase-projektens visningsnamn uppdaterade: qmmpxupsxdouvoqgvgri → "SMC Trading Journal" (PROD), zmtpgnnqtkkdsrswhrzk → "SMC Trading Journal DEV". Projekt-ID:n oförändrade.' },
    ]
  },
  {
    version: 'v2.1.1',
    date: '2026-07-07',
    entries: [
      { type: 'infra', text: 'Testcommit efter branch-namnbyte – bekräftade att Cloudflare auto-deploy fungerar korrekt mot nya main-branchen.' },
    ]
  },
  {
    version: 'v2.1.0',
    date: '2026-07-07',
    entries: [
      { type: 'infra', text: '🚀 PROD CUTOVER. v1.9.9 (journal.smctrading.se, main-branchen) skrotad – ingen hade riktiga användare. Nuvarande Supabase-projekt qmmpxupsxdouvoqgvgri (all verklig testdata, journal, imports) befordras till permanent produktionsdatabas. Gamla PROD-projektet zmtpgnnqtkkdsrswhrzk (identiskt schema, bara Kanban-data) blir istället den nya Dev-sandlådan framöver – ingen kostnad för Supabase Branching (kräver Pro-plan) behövdes, rollerna byttes bara.' },
      { type: 'infra', text: 'Kanban-board (roadmapTasks) migrerad från gamla PROD till nya PROD under rätt admin-konto (a55874aa…, samma som redan användes för branding-inställningarna).' },
      { type: 'fix', text: 'AuthPage: redirectTo/emailRedirectTo för lösenordsåterställning och kontobekräftelse pekade på dev-Workerns egen URL – uppdaterat till journal.smctrading.se.' },
      { type: 'infra', text: 'DNS-hanteringen för smctrading.se flyttad från Simply.com-namnservrar till Cloudflare (Free plan) för att kunna använda Custom Domains med giltigt SSL. journal.smctrading.se kopplad som Custom Domain mot Workern. Supabase Auth URL Configuration uppdaterad. Backup-secreten (SUPABASE_DB_URL) korrigerad till att peka mot rätt projekt (qmmpxupsxdouvoqgvgri) efter att ha upptäckts peka fel under uppsättningen.' },
    ]
  },
]

const TYPE_CONFIG = {
  feature:     { label:'Feature',     bg:'rgba(0,212,170,0.12)',  color:'var(--accent)' },
  fix:         { label:'Fix',         bg:'rgba(239,68,68,0.12)',  color:'#ef4444' },
  infra:       { label:'Infra',       bg:'rgba(99,102,241,0.12)', color:'#818cf8' },
  improvement: { label:'Förbättring', bg:'rgba(245,158,11,0.12)', color:'#f59e0b' },
}

export default function Changelog() {
  return (
    <div style={{ flex:1 }}>
      <Topbar title="Changelog" subtitle="v2.0 – versionshistorik" />
      <div className="page-content" style={{ maxWidth:760 }}>
        {CHANGELOG.map((release,ri) => (
          <div key={release.version} style={{ marginBottom:36 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:14 }}>
              <span style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:700, color:ri===0?'var(--accent)':'var(--text)', ...(ri===0?{textShadow:'0 0 20px rgba(0,212,170,0.25)'}:{}) }}>{release.version}</span>
              <span style={{ fontSize:12, color:'var(--text4)', fontFamily:'var(--mono)' }}>{release.date}</span>
              {ri===0&&<span style={{ fontSize:10, fontWeight:700, color:'var(--accent)', background:'var(--accent-dim)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:20, padding:'2px 8px' }}>SENASTE</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {release.entries.map((entry,ei)=>{
                const cfg=TYPE_CONFIG[entry.type]||TYPE_CONFIG.feature
                return(
                  <div key={ei} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:4, background:cfg.bg, color:cfg.color, flexShrink:0, marginTop:1, letterSpacing:.3, minWidth:46, textAlign:'center' }}>{cfg.label}</span>
                    <span style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>{entry.text}</span>
                  </div>
                )
              })}
            </div>
            {ri<CHANGELOG.length-1&&<div style={{ borderBottom:'1px solid var(--border)', marginTop:28 }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
