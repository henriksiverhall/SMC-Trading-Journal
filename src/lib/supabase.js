import { createClient } from '@supabase/supabase-js'

// Miljöbaserad konfiguration – v2.1.4 (staging-miljö). Faller tillbaka på PROD
// om inga byggvariabler är satta, så main-branchen/prod-Workern fortsätter
// fungera oförändrat utan att någon extra konfiguration krävs där.
// Staging-Workern sätter VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY som Build
// variables i Cloudflare (Settings → Build → Variables and secrets) för att
// peka mot DEV-projektet (zmtpgnnqtkkdsrswhrzk) istället.
// v2.1.5: SUPABASE_URL exporteras nu så App.jsx kan visa en ovillkorlig
// STAGING-varningsbanner baserat på vilken databas appen faktiskt pratar
// mot – Henrik loggade in på staging-URL:en och kunde inte se någon skillnad
// mot prod, vilket är en verklig säkerhetsrisk (kan blanda ihop miljöer).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qmmpxupsxdouvoqgvgri.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tpaLJ4LBm40xKzXgdVzndQ_iWRHyPw1'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})
