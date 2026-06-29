import { useEffect, useRef, memo } from 'react'
import Topbar from '../components/Topbar'

const TradingViewWidget = memo(function TradingViewWidget() {
  const container = useRef()

  useEffect(() => {
    // Rensa container vid re-render
    if (container.current) container.current.innerHTML = ''

    const wrapper = document.createElement('div')
    wrapper.className = 'tradingview-widget-container__widget'
    wrapper.style.height = '800px'
    wrapper.style.width = '100%'
    container.current.appendChild(wrapper)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      isTransparent: false,
      locale: 'en',
      countryFilter: 'us,ca,eu,fr,de,gb,au,nz,jp,ch',
      importanceFilter: '-1,0,1',
      width: '100%',
      height: '800',
    })
    container.current.appendChild(script)
  }, [])

  return (
    <div
      ref={container}
      className="tradingview-widget-container"
      style={{ minHeight: 800, width: '100%' }}
    />
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
