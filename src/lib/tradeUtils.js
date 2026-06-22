/**
 * tradeUtils.js – Normaliserar trades till ett kanoniskt format
 *
 * Problemet: trades kan komma in med olika format beroende på källan:
 *
 *   Format A – Manuellt loggad via UI (standard):
 *     outcome: 'W' | 'L' | 'BE'
 *     result:  R-värde (1.5, -1, 0 osv)
 *
 *   Format B – Importerat backtest (t.ex. Blackwatch Break&Trigger):
 *     outcome: 'Win' | 'Loss' | 'BE'
 *     result:  punker (135.0, -144.88 osv)
 *     custom_data.risk_pts: antal riskpunkter (33.75 osv)
 *     custom_data.backtest: true
 *
 * Lägg till fler format här när importen introducerar nya varianter.
 * Alla sidor importerar normalizeResult() / normalizeTrades() – ingen
 * per-sida logik för formathantering.
 */

// Kanonisk outcome-mapping – alla kända varianter → 'W' | 'L' | 'BE'
const OUTCOME_MAP = {
  'W': 'W', 'Win': 'W', 'WIN': 'W', 'win': 'W',
  'L': 'L', 'Loss': 'L', 'LOSS': 'L', 'loss': 'L', 'Lose': 'L',
  'BE': 'BE', 'BreakEven': 'BE', 'Break Even': 'BE', 'be': 'BE',
}

/**
 * Normaliserar ett enskilt trade-objekt.
 * Returnerar ett nytt objekt (muterar inte originalet) med:
 *   - outcome: kanonisk 'W' | 'L' | 'BE' | originalvärde om okänt
 *   - result:  R-värde (konverterat från punkter om risk_pts finns)
 *   - _originalResult: originalvärdet, för debugging
 *   - _normalized: true om konvertering skedde
 */
export function normalizeTrade(trade) {
  if (!trade) return trade

  // Outcome
  const rawOutcome = trade.outcome
  const outcome = OUTCOME_MAP[rawOutcome] ?? rawOutcome

  // Result – konvertera punkter → R om risk_pts finns i custom_data
  const riskPts = trade.custom_data?.risk_pts
  let result = trade.result
  let normalized = false

  if (result != null && riskPts != null && riskPts > 0) {
    // Backtest-format: result är punkter, dela på risk_pts för att få R
    result = parseFloat((trade.result / riskPts).toFixed(4))
    normalized = true
  } else if (result != null) {
    result = parseFloat(result)
  }

  // Sanity-check: en förlust ska ha negativt R, vinst positivt
  // Om det är inverterat (kan hända vid import-fel) – rätta tyst
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

/**
 * Normaliserar en lista trades. Snabb no-op om inget behöver ändras.
 */
export function normalizeTrades(trades) {
  if (!Array.isArray(trades)) return []
  return trades.map(normalizeTrade)
}

/**
 * Returnerar true om en trade verkar vara i ett av de kända icke-standard
 * formaten – användbart för att visa en varnings-badge i UI om man vill.
 */
export function isNonStandardFormat(trade) {
  return !!(
    trade?.custom_data?.backtest === true ||
    (trade?.outcome && !['W', 'L', 'BE'].includes(trade.outcome))
  )
}
