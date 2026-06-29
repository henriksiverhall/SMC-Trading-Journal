import { useEffect, useRef, memo } from 'react'
import Topbar from '../components/Topbar'

const TradingViewWidget = memo(function TradingViewWidget() {
  const container = useRef()

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      isTransparent: true,
      locale: 'en',
      countryFilter: 'us,ca,eu,fr,de,gb,au,nz,jp,ch',
      importanceFilter: '-1,0,1',
      width: '100%',
      height: '100%',
    })
    container.current.appendChild(script)
  }, [])

  return (
    <div className="tradingview-widget-container" ref={container} style={{ height: '100%', minHeight: 700 }}>
      <div className="tradingview-widget-container__widget" style={{ height: 'calc(100% - 32px)' }} />
      <div className="tradingview-widget-copyright" style={{ fontSize: 11, color: 'var(--text4)', padding: '6px 0' }}>
        <a href="https://www.tradingview.com/economic-calendar/" rel="noopener nofollow" target="_blank"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}>Economic Calendar</a>
        <span> by TradingView</span>
      </div>
    </div>
  )
})

export default function Calendar() {
  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Ekonomisk kalender" subtitle="TradingView · realtidsdata" />
      <div className="page-content">
        <TradingViewWidget />
      </div>
    </div>
  )
}
