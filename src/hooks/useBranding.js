/**
 * useBranding – hämtar branding-inställningar och applicerar bakgrundsbild
 * på nuvarande sida om admin aktiverat det.
 *
 * Används av sidor som ska stödja bakgrundsbilder:
 *   const { bgStyle } = useBranding('dashboard')
 *   <div style={{ ...bgStyle, flex: 1 }}>...</div>
 */
import { useEffect, useState } from 'react'
import { sb } from './supabase'

const ADMIN_USER_ID = 'a55874aa-d36a-4d07-a40f-778b3a66d671'
let _cached = null  // modul-nivå cache – hämtar max en gång per session

export function useBranding(pageId) {
  const [bgStyle, setBgStyle] = useState({})

  useEffect(() => {
    async function load() {
      if (!_cached) {
        const { data } = await sb.from('user_settings').select('settings').eq('user_id', ADMIN_USER_ID).single()
        _cached = data?.settings?.branding || null
      }
      if (!_cached) return
      if (!_cached.showOn?.[pageId]) return
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light'
      const url = isDark ? (_cached.heroImages?.dark || '/images/hero-dark.png') : (_cached.heroImages?.light || '/images/hero-light.png')
      setBgStyle({
        backgroundImage: `url(${url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      })
    }
    load()
  }, [pageId])

  return { bgStyle }
}
