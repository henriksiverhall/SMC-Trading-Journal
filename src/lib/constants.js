export const APP_VERSION = 'v2.0.3-dev'
export const WORKER_URL = 'https://tradelog-claude-api-dev.henrik-siverhall.workers.dev'
export const TWELVE_KEY = '6834415a3a0745989f7ed475a5c7f418'

export const TWELVE_SYMBOL_MAP = {
  'NQ':'QQQ','NQ1!':'QQQ','MNQ':'QQQ',
  'ES':'SPY','ES1!':'SPY','MES':'SPY',
  'YM':'DIA','MYM':'DIA','RTY':'IWM',
  'GC':'GLD','GC1!':'GLD','XAUUSD':'GLD',
  'CL':'USO','SI':'SLV',
  'EURUSD':'EUR/USD','EUR/USD':'EUR/USD',
  'GBPUSD':'GBP/USD','GBP/USD':'GBP/USD',
  'USDJPY':'USD/JPY','USD/JPY':'USD/JPY',
  'AUDUSD':'AUD/USD','AUD/USD':'AUD/USD',
  'USDCAD':'USD/CAD','USD/CAD':'USD/CAD',
  'USDCHF':'USD/CHF','USD/CHF':'USD/CHF',
  'NZDUSD':'NZD/USD','NZD/USD':'NZD/USD',
  'EURGBP':'EUR/GBP','EUR/GBP':'EUR/GBP',
  'EURJPY':'EUR/JPY','EUR/JPY':'EUR/JPY',
  'GBPJPY':'GBP/JPY','GBP/JPY':'GBP/JPY',
}

export function getTwelveSymbol(instrument) {
  if (!instrument) return null
  return TWELVE_SYMBOL_MAP[(instrument).toUpperCase().trim()] || null
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
