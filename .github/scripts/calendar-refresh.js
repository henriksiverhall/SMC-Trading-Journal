// GitHub Actions script: hämtar FF-kalenderdata och skriver till Supabase
// Körs på Microsofts IP-ranges – inte blockerade av ForexFactory

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Saknar SUPABASE_URL eller SUPABASE_SERVICE_KEY')
  process.exit(1)
}

async function fetchFF() {
  const urls = [
    'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
    'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json',
  ]
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.forexfactory.com/',
        }
      })
      if (!resp.ok) { console.log(`${url} → HTTP ${resp.status}`); continue }
      const text = await resp.text()
      if (text.trim().startsWith('<')) { console.log(`${url} → HTML (blockerad)`); continue }
      const data = JSON.parse(text)
      if (!Array.isArray(data) || data.length === 0) { console.log(`${url} → tom`); continue }
      console.log(`✓ Hämtade ${data.length} event från ${url}`)
      return data
    } catch (e) { console.log(`${url} → fel: ${e.message}`) }
  }
  throw new Error('Alla FF-URLs misslyckades')
}

async function writeToSupabase(data) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/calendar_cache`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ week_key: 'thisweek', data, fetched_at: new Date().toISOString() })
  })
  if (!resp.ok) throw new Error(`Supabase: ${resp.status} ${await resp.text()}`)
  console.log(`✓ Supabase uppdaterad med ${data.length} event`)
}

async function main() {
  console.log(`Startar: ${new Date().toISOString()}`)
  try {
    const data = await fetchFF()
    await writeToSupabase(data)
    console.log('✓ Klar!')
  } catch (e) {
    console.error(`✗ ${e.message}`)
    process.exit(1)
  }
}

main()
