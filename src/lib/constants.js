export const APP_VERSION = 'v2.0.30-dev'
export const WORKER_URL = 'https://tradelog-claude-api-dev.henrik-siverhall.workers.dev'

export const YAHOO_SYMBOL_MAP = {
  'NQ':'NQ=F','NQ1!':'NQ=F','MNQ':'NQ=F',
  'ES':'ES=F','ES1!':'ES=F','MES':'ES=F',
  'YM':'YM=F','MYM':'YM=F',
  'RTY':'RTY=F','M2K':'RTY=F',
  'EURUSD':'EURUSD=X','EUR/USD':'EURUSD=X',
  'GBPUSD':'GBPUSD=X','GBP/USD':'GBPUSD=X',
  'USDJPY':'USDJPY=X','USD/JPY':'USDJPY=X',
  'AUDUSD':'AUDUSD=X','AUD/USD':'AUDUSD=X',
  'USDCAD':'USDCAD=X','USD/CAD':'USDCAD=X',
  'USDCHF':'USDCHF=X','USD/CHF':'USDCHF=X',
  'NZDUSD':'NZDUSD=X','NZD/USD':'NZDUSD=X',
  'EURGBP':'EURGBP=X','EUR/GBP':'EURGBP=X',
  'EURJPY':'EURJPY=X','EUR/JPY':'EURJPY=X',
  'GBPJPY':'GBPJPY=X','GBP/JPY':'GBPJPY=X',
}

export function getYahooSymbol(instrument) {
  if (!instrument) return null
  return YAHOO_SYMBOL_MAP[(instrument).toUpperCase().trim()] || null
}

export const FUTURES_SPECS = {
  MNQ: { name: 'Micro Nasdaq',  pointValue: 2,    tickSize: 0.25, exchange: 'CME' },
  NQ:  { name: 'Nasdaq',        pointValue: 20,   tickSize: 0.25, exchange: 'CME' },
  MES: { name: 'Micro S&P 500', pointValue: 5,    tickSize: 0.25, exchange: 'CME' },
  ES:  { name: 'S&P 500',       pointValue: 50,   tickSize: 0.25, exchange: 'CME' },
  MYM: { name: 'Micro Dow',     pointValue: 0.5,  tickSize: 1,    exchange: 'CBOT' },
  YM:  { name: 'Dow Jones',     pointValue: 5,    tickSize: 1,    exchange: 'CBOT' },
}

export const EMOTIONS = [
  { id: 'Disciplined',   emoji: '🎯', label: 'Disciplined' },
  { id: 'Confident',     emoji: '💪', label: 'Confident' },
  { id: 'Hesitant',      emoji: '😟', label: 'Hesitant' },
  { id: 'FOMO',          emoji: '⚡', label: 'FOMO' },
  { id: 'Revenge',       emoji: '😤', label: 'Revenge' },
  { id: 'Overconfident', emoji: '🎰', label: 'Over' },
]

export const GRADES = ['A+', 'A', 'B', 'C']

export function getFuturesSpec(symbol) {
  if (!symbol) return null
  return FUTURES_SPECS[symbol.toUpperCase().trim()] || null
}

export function gradeColor(grade) {
  if (!grade) return 'var(--text3)'
  const map = { 'A+': 'var(--accent)', A: 'var(--green)', B: 'var(--amber)', C: 'var(--red)' }
  return map[grade] || 'var(--text3)'
}

export function formatR(r) {
  if (r == null) return '—'
  const sign = r > 0 ? '+' : ''
  return `${sign}${Number(r).toFixed(2)}R`
}

export function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
