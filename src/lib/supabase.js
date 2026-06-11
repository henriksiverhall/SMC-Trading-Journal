import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qmmpxupsxdouvoqgvgri.supabase.co'
const SUPABASE_KEY = 'sb_publishable_tpaLJ4LBm40xKzXgdVzndQ_iWRHyPw1'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})
