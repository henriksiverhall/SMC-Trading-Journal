/**
 * tradeUtils.js – Normaliserar trades till ett kanoniskt format
 *
 * Kända format:
 *
 *   Format A – Manuellt loggad via UI (standard):
 *     outcome: 'W' | 'L' | 'BE'
 *     result:  R-värde direkt (1.5, -1, 0 osv)
 *
 *   Format B – Importerat backtest (t.ex. Break & Trigger v2):
 *     outcome: 'Win' | 'Loss' | 'BE'
 *     result:  punkter (135.0, -21.3 osv)
 *     custom_data.backtest: true
 *     entry + sl: satta (används för faktisk R-beräkning)
 *
 * R-beräkning: använd alltid abs(entry - sl) som faktisk risk.
 * risk_pts (box-storlek) används bara som fallback om entry/sl saknas.
 *
 * Lägg till fler format-regler här vid behov – ingen per-sida logik.
 */

const OUTCOME_MAP = {
  'W': 'W', 'Win': 'W', 'WIN': 'W', 'win': 'W',
  'L': 'L', 'Loss': 'L', 'LOSS': 'L', 'loss': 'L', 'Lose': 'L',
  'BE': 'BE', 'BreakEven': 'BE', 'Break Even': 'BE', 'be': 'BE',
}

export function normalizeTrade(trade) {
  if (!trade) return trade

  const rawOutcome = trade.outcome
  const outcome = OUTCOME_MAP[rawOutcome] ?? rawOutcome

  let result = trade.result != null ? parseFloat(trade.result) : null
  let normalized = false

  const isBacktest = trade.custom_data?.backtest === true
  const resultAlreadyInR = trade.custom_data?.result_unit === 'R'

  if (resultAlreadyInR) {
    // Result är redan satt i R-enheter – ingen konvertering behövs.
    // Sätts när data fixats manuellt eller importerats med korrekt R-värde.
  } else if (isBacktest && result != null) {
    // Backtest-trade: result är i punkter, konvertera till R.
    // Prioritera abs(entry-sl) framför risk_pts (box-storlek) eftersom
    // SL inte alltid sitter exakt vid box-kanten.
    const actualRisk = (trade.entry != null && trade.sl != null)
      ? Math.abs(parseFloat(trade.entry) - parseFloat(trade.sl))
      : trade.custom_data?.risk_pts != null
        ? parseFloat(trade.custom_data.risk_pts)
        : null

    if (actualRisk != null && actualRisk > 0) {
      result = parseFloat((result / actualRisk).toFixed(4))
      normalized = true
    }
  } else if (!isBacktest && result != null && trade.entry != null && trade.sl != null) {
    // Icke-backtest men result ser ut att vara i punkter (> 10) och entry/sl finns
    // – kan hända vid import från tredjepartskälla
    const actualRisk = Math.abs(parseFloat(trade.entry) - parseFloat(trade.sl))
    if (actualRisk > 0 && Math.abs(result) > 10) {
      result = parseFloat((result / actualRisk).toFixed(4))
      normalized = true
    }
  }

  // Sanity: vinst ska vara positivt R, förlust negativt
  if (outcome === 'W' && result != null && result < 0) result = Math.abs(result)
  if (outcome === 'L' && result != null && result > 0) result = -Math.abs(result)

  const changed = outcome !== rawOutcome || normalized

  return {
    ...trade,
    outcome,
    result,
    ...(changed ? { _originalOutcome: rawOutcome, _originalResult: trade.result, _normalized: true } : {}),
  }
}

export function normalizeTrades(trades) {
  if (!Array.isArray(trades)) return []
  return trades.map(normalizeTrade)
}

/**
 * Beräknar kontraktsantal och dollar-P&L för ett enskilt trade,
 * baserat på kontostorlek och önskad risk %.
 *
 * Returnerar null om nödvändig data saknas (entry, sl, symbol-spec).
 *
 * @param {object} trade          – normaliserat trade-objekt
 * @param {number} accountSize    – kontostorlek i USD
 * @param {number} riskPct        – risk per trade i % (t.ex. 1.0)
 * @param {function} getSpec      – getFuturesSpec(symbol) från constants.js
 */
export function calcTradeSize(trade, accountSize, riskPct, getSpec) {
  if (!trade.entry || !trade.sl || !accountSize || !riskPct) return null

  const spec = getSpec(trade.symbol)
  if (!spec) return null

  const slDistance = Math.abs(parseFloat(trade.entry) - parseFloat(trade.sl))
  if (slDistance === 0) return null

  const riskDollar = accountSize * riskPct / 100
  const contracts = Math.floor(riskDollar / (slDistance * spec.pointValue))
  if (contracts < 1) return null

  const actualRiskDollar = contracts * slDistance * spec.pointValue
  const dollarPnl = trade.result != null
    ? trade.result * actualRiskDollar
    : null

  return {
    contracts,
    slDistance: parseFloat(slDistance.toFixed(2)),
    tickValue: spec.pointValue,
    riskDollar: parseFloat(riskDollar.toFixed(2)),
    actualRiskDollar: parseFloat(actualRiskDollar.toFixed(2)),
    actualRiskPct: parseFloat((actualRiskDollar / accountSize * 100).toFixed(2)),
    dollarPnl: dollarPnl != null ? parseFloat(dollarPnl.toFixed(2)) : null,
    specName: spec.name,
  }
}

export function isNonStandardFormat(trade) {
  return !!(
    trade?.custom_data?.backtest === true ||
    (trade?.outcome && !['W', 'L', 'BE'].includes(trade.outcome))
  )
}
