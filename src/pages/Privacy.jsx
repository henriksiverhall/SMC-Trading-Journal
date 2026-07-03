import { APP_VERSION } from '../lib/constants'

// Fristående sida, tillgänglig utan inloggning via #/privacy (se App.jsx – routas
// innan auth-koll). Innehåll porterat oförändrat i sak från prod v1.9.9 (main-
// branch index.html, sektion #page-policy), formaterat till v2.0-designsystemet.
export default function Privacy() {
  function goBack() {
    window.location.hash = ''
    window.location.reload()
  }

  const h2 = { fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '28px 0 8px' }
  const p  = { fontSize: 14, color: 'var(--text2)', marginBottom: 4, lineHeight: 1.8 }
  const ul = { fontSize: 14, color: 'var(--text2)', marginBottom: 4, paddingLeft: 20, lineHeight: 1.8 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button className="btn btn-ghost btn-sm" onClick={goBack}>← Tillbaka</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 800, fontSize: 12 }}>TL</div>
            <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>🔒 Integritetspolicy</span>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ padding: '28px 32px' }}>
            <p style={{ fontSize: 12, color: 'var(--text4)', marginBottom: 24 }}>Senast uppdaterad: juli 2026</p>

            <h2 style={h2}>1. Om TradeLog</h2>
            <p style={p}>TradeLog är en webbaserad trading-journaltjänst tillgänglig på journal.smctrading.se. Tjänsten är inte ett mäkleri, hanterar inga riktiga trades och förvaltar inga klientmedel. Allt innehåll är uteslutande för personlig journalföring och utbildningsändamål.</p>

            <h2 style={h2}>2. Vilka uppgifter samlar vi in?</h2>
            <ul style={ul}>
              <li><strong>Kontouppgifter:</strong> E-postadress samt valfritt visningsnamn</li>
              <li><strong>Tradingdata:</strong> Trades du väljer att logga – datum, nivåer, strategi, utfall och noteringar</li>
              <li><strong>Inloggningsaktivitet:</strong> Tidpunkt och enhetstyp, uteslutande för säkerhetsändamål</li>
              <li><strong>Appinställningar:</strong> Dina personliga inställningar, checklistor och strategier</li>
            </ul>

            <h2 style={h2}>3. Hur används dina uppgifter?</h2>
            <ul style={ul}>
              <li>För att tillhandahålla och driva tjänsten</li>
              <li>För att skicka transaktionella systemmeddelanden (t.ex. kontobekräftelse)</li>
              <li>För att skydda tjänstens integritet och förebygga missbruk</li>
            </ul>
            <p style={{ ...p, marginTop: 12 }}>Vi skickar inga marknadsförings- eller reklamutskick. Inga personuppgifter används för annonsering.</p>

            <h2 style={h2}>4. Delning med tredje part</h2>
            <p style={p}>Vi delar inte dina personuppgifter med tredje part i marknadsföringssyfte. För att kunna driva tjänsten anlitar vi ett begränsat antal betrodda infrastrukturleverantörer som behandlar data uteslutande på vårt uppdrag och under avtal. Dessa leverantörer tillhandahåller tjänster inom hosting, autentisering och e-postleverans. Ingen av dem får använda dina uppgifter för egna ändamål.</p>
            <p style={{ ...p, marginTop: 12 }}>Om du använder AI-analysfunktionen bearbetas enbart aggregerad, icke-personidentifierbar statistik. Inga rådata, namn eller kontaktuppgifter överförs.</p>

            <h2 style={h2}>5. Datalagring och radering</h2>
            <p style={p}>Dina uppgifter lagras så länge ditt konto är aktivt. Du kan när som helst begära fullständig radering via <strong style={{ color: 'var(--text)' }}>Profil → Farlig zon → Radera konto och data</strong>. All data tas bort inom 30 dagar från begäran.</p>

            <h2 style={h2}>6. Dina rättigheter (GDPR)</h2>
            <ul style={ul}>
              <li><strong>Tillgång:</strong> Du kan se all din data direkt i appen</li>
              <li><strong>Rättelse:</strong> Redigera dina uppgifter under Profil</li>
              <li><strong>Radering:</strong> Begär borttagning via Profil → Farlig zon</li>
              <li><strong>Dataportabilitet:</strong> Exportera dina trades som CSV-fil via Journal</li>
              <li><strong>Invändning eller klagomål:</strong> Kontakta oss via den kanal som anges nedan</li>
            </ul>

            <h2 style={h2}>7. Cookies och lokal lagring</h2>
            <p style={p}>TradeLog använder ingen spårning, inga reklamcookies och inga tredjepartscookies. Enbart teknisk sessionsdata lagras lokalt i din webbläsare för att hålla dig inloggad och komma ihåg aktiv vy.</p>

            <h2 style={h2}>8. Säkerhet</h2>
            <p style={p}>All kommunikation sker krypterat via HTTPS. Åtkomst till data styrs av strikta behörighetskontroller – varje användare kan enbart se och ändra sina egna uppgifter. Lösenord lagras aldrig i läsbart format.</p>

            <h2 style={h2}>9. Kontakt</h2>
            <p style={p}>Logga in på ditt konto och använd raderingsflödet under Profil för att utöva dina rättigheter direkt. För övriga frågor – kontakta oss via den e-postadress som är kopplad till ditt konto och märk meddelandet "Integritetsfråga" så återkommer vi inom 5 arbetsdagar.</p>
            <p style={{ fontSize: 12, color: 'var(--text4)', marginTop: 12 }}>Du har även rätt att lämna klagomål till Integritetsskyddsmyndigheten (IMY), imy.se.</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text4)', marginTop: 20 }}>TradeLog {APP_VERSION}</div>
      </div>
    </div>
  )
}
