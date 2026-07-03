import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'v2.0.65-dev',
    date: '2026-07-03',
    entries: [
      { type: 'fix', text: 'Integritetspolicy-sidan renderade tom vid navigering i samma flik (fixades bara med en full omladdning). Orsak: v2.0.64 la den villkorliga returnen (#/privacy) FÖRE useAuth() och resten av hooksen i App.jsx – bryter Reacts regel att exakt samma hooks måste köras i samma ordning varje rendering av samma komponent. Antalet hooks skiljde sig kraftigt mellan "vanlig sida" (~10 hooks) och Privacy-grenen (2 hooks), vilket fick React att tappa reconciliation. Alla hooks körs nu alltid – bara JSX-returnen villkoras.' },
    ]
  },
  {
    version: 'v2.0.64-dev',
    date: '2026-07-03',
    entries: [
      { type: 'fix', text: 'Integritetspolicy-länken fungerade bara från Profil (öppnas i ny flik, ger full omladdning). Från AuthPage/"Skapa konto" (samma flik) bytte webbläsaren bara URL-hashen utan att React reagerade – window.location.hash lästes bara av vid appens första rendering. Fix: hashchange-listener håller hash i React-state, så #/privacy fungerar oavsett var länken klickas.' },
    ]
  },
  {
    version: 'v2.0.63-dev',
    date: '2026-07-03',
    entries: [
      { type: 'fix', text: 'AI-analys (Analytics): "✓ Aktuell" visades felaktigt trots nyimporterade trades. Orsak: fingerprinten som avgör om ny data finns byggdes bara på trades med result!=null – importerade trades saknar R-värde helt (se Kanban dev_import_r_value1) och var därför osynliga för kollen. Fingerprint använder nu alla trades (id+result+outcome), så nya importer upptäcks korrekt.' },
    ]
  },
  {
    version: 'v2.0.62-dev',
    date: '2026-07-03',
    entries: [
      { type: 'infra', text: 'Databas-migrationsfil tillagd (supabase/migrations/20260703124700_schema_snapshot.sql) – dokumenterar hela PROD-schemat (tabeller, RLS-policies, funktioner). Ursprungligen framtagen av ChatGPT i en separat PR, verifierad kolumn-för-kolumn mot live information_schema och adopterad av Claude efter att PR:ns övriga innehåll (Changelog-ändring) visat sig trasigt och blivit stoppat.' },
      { type: 'infra', text: 'Städat upp 10 experiment-branches och stängt PR #1 (ej mergad) efter ett ChatGPT-arbetspass mot samma repo som gick snett på Changelog-skrivning.' },
    ]
  },
  {
    version: 'v2.0.61-dev',
    date: '2026-07-03',
    entries: [
      { type: 'feature', text: 'Integritetspolicy-sida porterad från prod v1.9.9 till React (go-live-krav). Egen fristående sida på #/privacy, tillgänglig utan inloggning via hash-routing. Länkad från signup-formuläret (AuthPage) och Profil → Integritet.' },
    ]
  },
  {
    version: 'v2.0.60-dev',
    date: '2026-07-03',
    entries: [
      { type: 'fix', text: 'Dashboard: Operatör-kortet (hälsningen) ligger nu kvar till vänster medan resten av HUD-korten högerställs, så de inte klumpar ihop sig på breda skärmar.' },
      { type: 'feature', text: 'Mer "glow" genomgående – inte bara toppwidgeten: alla kort fick en subtil glow-linje överst, W/L-badges och R-värden (r-pos/r-neg) fick glödande skugga, streak-rutorna (senaste 10 trades) fick färgad glow.' },
    ]
  },
  {
    version: 'v2.0.59-dev',
    date: '2026-07-03',
    entries: [
      { type: 'fix', text: 'Dashboard HUD-kort: instrumentkorten (Guld/Olja/ES-NQ-YM) visade nedräkningen som huvudsiffra och en statisk "stängd"-text utan öppningstid – förvirrande jämfört med marknadskorten. Alla kort visar nu samma mönster: huvudsiffra = aktuell lokal klocktid, sub-rad = "öppnar om HH:MM:SS" / "stänger om HH:MM:SS" tydligt märkt med "om" så det inte kan tolkas som ett klockslag.' },
      { type: 'fix', text: 'Dashboard: "Hej, Admin!"-hälsningen var en avvikande hero-textbubbla som inte matchade HUD-stilen. Nu ett HUD-kort i samma rad som resten (Operatör / namn / veckodag).' },
      { type: 'fix', text: 'Dashboard: dubblett-knappen "+ Log Trade" i Topbar borttagen – fanns redan i hero-raden, syntes bara på Dashboard (försvann på andra sidor) och var förvirrande.' },
    ]
  },
  {
    version: 'v2.0.58-dev',
    date: '2026-07-03',
    entries: [
      { type: 'feature', text: 'Dashboard – ny visuell riktning ("HUD / high-tech"): analoga klockor ersatta med digitala HUD-kort med glödande progress-bar. Stat-korten fick glow-underline och glödande mono-siffror. Equity curve fick glow-effekt. Welcome-hero fick subtil violett/grön gradient-linje. Ny --violet accent-färg tillagd i designsystemet (både dark och light theme).' },
      { type: 'infra', text: 'Ingen mobil/platta-CSS rörd eller borttagen – HUD-remsan återanvänder befintlig .welcome-clocks-wrap-klass så mobil-döljningen fortsätter fungera exakt som innan.' },
    ]
  },
  {
    version: 'v2.0.57-dev',
    date: '2026-07-03',
    entries: [
      { type: 'feature', text: 'Import: ny parser för TopstepX/ProjectX (används av TopStep, Bulenox, Alpha Futures m.fl.) – order-nivå-data med Status/Side/PositionDisposition/CreationDisposition tolkas till Long/Short-trades med korrekt entry/exit-parning.' },
      { type: 'fix', text: 'Import: TradingView Backtesting-parsern skriven om – exporten har en rad per exekvering (Entry/Exit separat, grupperade på Trade number), inte en rad per trade som tidigare antogs. Symbol gissas nu från filnamnet eftersom exporten saknar ticker-kolumn.' },
      { type: 'fix', text: 'Import: Tradovate-parsern (används av FundedNext, Apex, Tradeify m.fl.) matchade fel kolumnnamn mot verklig export (avgPrice/filledQty istället för antagna namn) och saknade filtrering på Status=Filled, vilket importerade avbrutna ordrar som skräpdata. Fixat mot verklig exportfil.' },
    ]
  },
  {
    version: 'v2.0.56-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'Journal: verkliga roten till att Datum/Tid/Exit-fälten "försvann till höger" hittad. .journal-form-card saknade min-width:0 – som CSS Grid-item fick den default min-width:auto (sitt innehålls min-content-bredd), så om något fält i formuläret hade brett innehåll vägrade HELA kortet krympa under det och klipptes av skärmkanten. v2.0.55 fixade bara symptomet på de enskilda fälten, inte orsaken på kortnivå.' },
    ]
  },
  {
    version: 'v2.0.55-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'Journal: Datum/Tid/Exit datum/Exit tid-fälten stack ut till höger om skärmen på mobil (iOS Safari) trots att alla andra fält hade korrekt bredd. Orsak: input[type=date] och input[type=time] kan strunta i width:100% på iOS och behålla sin egen bredd. Explicit CSS-regel tvingar nu dessa fälttyper att respektera containerns bredd.' },
    ]
  },
  {
    version: 'v2.0.54-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'Dashboard: widgetgriden satt permanent till 1 kolumn (var 2 på desktop). Widgets kan därmed aldrig hamna sida vid sida längre, oavsett skärmbredd – löser mobilbuggen på roten istället för fler brytpunkts-hack. Gör även "Anpassa widgets" till en rak lista utan gissningar om vad som legat på samma rad.' },
    ]
  },
  {
    version: 'v2.0.53-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'Dashboard: klockorna (session-ur + RTH-panel) döljs helt på mobil – de kunde aldrig få plats på en telefon och var mest brus där. Snabbknapparna (Logga trade/Checklist/Analytics/Journal) räcker.' },
      { type: 'fix', text: 'Checklist: Redigera/Ny strategi/Återställ-knapparna staplas nu i tydliga rader istället för att wrappa huller om buller.' },
      { type: 'fix', text: 'Skyddsnät mot "läckande" horisontell scroll: om en sida tillfälligt blir bredare än skärmen och gör dokumentet scrollbart i sidled, nollställs det automatiskt vid sidbyte så nästa sida inte visas skiftad.' },
    ]
  },
  {
    version: 'v2.0.52-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'Roten till "nyp ihop"-problemet på mobil hittad: DragGrid fick columns={2} som inline-style från Dashboard, vilket inte kan ha egna CSS-brytpunkter. Widgetgriden tvingas nu till 1 kolumn på mobil oavsett vad sidan begär.' },
      { type: 'infra', text: 'overflow-x:hidden på body/root och min-width:0 genomgående på kort/formulär så innehåll kan krympa istället för att tvinga ut sidbredden.' },
    ]
  },
  {
    version: 'v2.0.51-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'Analytics: statistik-widgeten (5 kolumner) blir 2 kolumner på telefon (≤480px). SL-optimering (3 kolumner), Grade/Emotion (2 kolumner) och Win Rate per veckodag (5 kolumner) blir 1 kolumn på mobil/platta (≤768px) istället för att klämmas ihop.' },
      { type: 'fix', text: 'Journal + PiP Log Trade: fältrader med två fält bredvid varandra (t.ex. Datum/Tid, SL/TP) blir 1 fält per rad på telefon (≤480px), men behåller 2 kolumner på iPad/platta (768px+) där det finns plats.' },
      { type: 'infra', text: 'Ny CSS-brytpunkt vid 480px separat från 768px-brytpunkten – skiljer på "platta i liggande" (gott om plats) och "telefon i stående" (måste bli en kolumn).' },
    ]
  },
  {
    version: 'v2.0.50-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'AuthPage (login/signup) mobilanpassad – missades i förra sessionens mobilarbete. Hade en helt egen fast grid utan brytpunkt. Nu döljs bild-panelen på ≤768px och formuläret fyller skärmen, samma mönster som resten av appen.' },
    ]
  },
  {
    version: 'v2.0.49-dev',
    date: '2026-07-02',
    entries: [
      { type: 'feature', text: 'Full mobil/platta-anpassning: sidebar blir en overlay-drawer med hamburgermeny på skärmar ≤768px, stängs automatiskt vid navigering. Topbar får hamburger-knapp.' },
      { type: 'fix', text: 'Journal: tvåkolumns-layout (Log Trade + tabell) blir en kolumn på mobil/platta. Formuläret slutar vara sticky så det inte låser scroll.' },
      { type: 'fix', text: 'PiP-knappen döljs på mobil/platta – Document Picture-in-Picture stöds inte i mobila webbläsare. Checklist och Logga trade nås istället direkt via huvudnavigeringen.' },
      { type: 'infra', text: 'Nya CSS-brytpunkt vid 768px i globals.css: kort, tabeller och modaler får mindre padding/font-storlek för bättre läsbarhet på små skärmar.' },
    ]
  },
  {
    version: 'v2.0.48-dev',
    date: '2026-07-01',
    entries: [
      { type: 'feature', text: 'Import-sida: stöd för TradingView Backtesting (Strategy Tester CSV), Tradovate (Orders.csv), MetaTrader 4/5 (History CSV) och NinjaTrader 7/8 (Trades CSV). 3-stegs flöde: välj plattform → dra/släpp CSV → granska + importera. Valfri strategi-sättning på alla importerade trades.' },
      { type: 'fix', text: 'PiP: ↺ Rensa-knapp tillagd bredvid Spara-knappen i Logga trade-flödet.' },
      { type: 'fix', text: 'Journal: ↺ Rensa-knapp alltid synlig bredvid Spara-knappen (ersätter tidigare Avbryt som bara syntes vid redigering).' },
    ]
  },
  {
    version: 'v2.0.46-dev',
    date: '2026-07-01',
    entries: [
      { type: 'feature', text: 'Journal: klick på bild i detaljmodalen öppnar lightbox-overlay.' },
      { type: 'feature', text: 'PiP: Logga trade-flödet identiskt med standard Log Trade – scale-ins, targets, R-preview, multiimage, Känsla.' },
    ]
  },
  {
    version: 'v2.0.45-dev',
    date: '2026-07-01',
    entries: [
      { type: 'fix', text: 'Journal: chart-länk display:block – ellipsis-trunkering fungerar korrekt.' },
      { type: 'feature', text: 'Worker: TV “Copy link”-URL:er konverteras auto till S3 PNG-URL.' },
    ]
  },
  {
    version: 'v2.0.44-dev',
    date: '2026-07-01',
    entries: [
      { type: 'fix', text: 'Journal: chart-rad grid-layout (36px | auto | 1fr | 24px).' },
      { type: 'infra', text: 'TV Pine Script Journal Tool parkerad. Profil TV-flik dold.' },
    ]
  },
  {
    version: 'v2.0.43-dev',
    date: '2026-06-30',
    entries: [
      { type: 'feature', text: 'Journal: multiimage-stöd – flera bilder/länkar per trade med tagg. R2-bucket tradelog-trade-images.' },
    ]
  },
  {
    version: 'v2.0.42-dev',
    date: '2026-06-29',
    entries: [
      { type: 'feature', text: 'Ekonomisk kalender: inbäddad TradingView Economic Calendar-widget.' },
    ]
  },
  {
    version: 'v2.0.40-dev',
    date: '2026-06-27',
    entries: [
      { type: 'feature', text: 'Dashboard: analoga sessionsklockor (London/NY/Tokyo + din tid), RTH-instrumentruta.' },
    ]
  },
  {
    version: 'v2.0.36-dev',
    date: '2026-06-25',
    entries: [
      { type: 'feature', text: 'Analytics: CustomFieldsWidget expand/kollaps per fält.' },
      { type: 'fix', text: 'Admin + Profile: maxWidth höjt till 1100px.' },
    ]
  },
  {
    version: 'v2.0.32-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Admin UserProfileModal: e-postbyte, lösenordsåterställning. AuthPage: Glömt lösenord-modal.' },
    ]
  },
  {
    version: 'v2.0.23-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'Dashboard: välkomstbanner, session-countdown. Analytics: Expectancy, Recovery Factor, SL-optimerare.' },
    ]
  },
  {
    version: 'v2.0.19-dev',
    date: '2026-06-22',
    entries: [
      { type: 'feature', text: 'Journal: filter, strategi-dropdown, kolumnsortering. PiP: BroadcastChannel live-uppdatering.' },
    ]
  },
  {
    version: 'v2.0.15-dev',
    date: '2026-06-21',
    entries: [{ type:'feature', text:'PiP-widget, Checklist portad, obligatoriska fält.' }]
  },
  {
    version: 'v2.0.4-dev',
    date: '2026-06-15',
    entries: [{ type:'feature', text:'DragGrid widget-system, Meddelanden/Support, Journal MFE/MAE.' }]
  },
  {
    version: 'v2.0.0-dev',
    date: '2026-06-11',
    entries: [{ type:'infra', text:'React 18 + Vite 5, Cloudflare Workers, Supabase. TradeLog v2.0 grund.' }]
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
      <Topbar title="Changelog" subtitle="Dev v2.0 – versionshistorik" />
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
