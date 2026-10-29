// Motor contable: costo promedio ponderado (mismo método que el backend en
// /api/trades/summary) con tres diferencias documentadas:
//  1. Las posiciones se separan por (cartera, ticker), no solo por ticker.
//  2. Cuando una posición llega a 0 se reinicia (costo y marca USD), así una
//     recompra posterior no hereda costos viejos ni "contamina" el USD.
//  3. Una venta mayor a lo que hay en posición se recorta y se reporta.
// El resultado en USD usa el CCL de cada operación; si falta en una compra de
// la posición vigente o en la venta, ese resultado USD es null (no se inventa).

const r6 = (n) => Math.round(n * 1e6) / 1e6
export const posKey = (t) => `${t.portfolioId ?? 'none'}|${t.ticker}`

export function buildLedger(trades) {
  const pos = new Map()
  const events = []
  const anomalies = []

  for (const t of trades) {
    const k = posKey(t)
    if (!pos.has(k)) {
      pos.set(k, {
        key: k, ticker: t.ticker, assetType: t.assetType, portfolioId: t.portfolioId ?? null,
        qty: 0, cost: 0, costUSD: 0, usdTainted: false, openDate: null,
      })
    }
    const p = pos.get(k)
    const usd = t.ccl ? { price: t.price / t.ccl, fee: t.fee / t.ccl } : null

    if (t.operation === 'COMPRA') {
      if (p.qty === 0) { p.openDate = t.date; p.cost = 0; p.costUSD = 0; p.usdTainted = false }
      p.qty += t.quantity
      p.cost += t.quantity * t.price + t.fee
      if (usd) p.costUSD += t.quantity * usd.price + usd.fee
      else p.usdTainted = true
    } else {
      if (p.qty <= 0) { anomalies.push({ tradeId: t.id, ticker: t.ticker, reason: 'Venta sin posición previa' }); continue }
      const q = Math.min(t.quantity, p.qty)
      if (q < t.quantity) anomalies.push({ tradeId: t.id, ticker: t.ticker, reason: 'Venta mayor a la posición; se recortó' })
      const feePart = t.fee * (q / t.quantity)
      const avg = p.cost / p.qty
      const costBasis = q * avg
      const proceeds = q * t.price
      const pl = proceeds - costBasis - feePart
      let plUSD = null, costBasisUSD = null
      if (usd && !p.usdTainted) {
        const avgU = p.costUSD / p.qty
        costBasisUSD = q * avgU
        plUSD = q * usd.price - costBasisUSD - feePart / t.ccl
      }
      events.push({
        id: t.id, date: t.date, ticker: t.ticker, assetType: t.assetType, portfolioId: t.portfolioId ?? null,
        qty: q, price: t.price, proceeds, costBasis, fee: feePart, pl,
        plPct: costBasis > 0 ? pl / costBasis : null,
        plUSD, costBasisUSD, plPctUSD: plUSD != null && costBasisUSD > 0 ? plUSD / costBasisUSD : null,
        openDate: p.openDate,
        days: p.openDate ? Math.max(0, Math.round((Date.parse(t.date) - Date.parse(p.openDate)) / 864e5)) : null,
      })
      p.cost -= costBasis
      p.costUSD -= p.usdTainted ? 0 : (p.costUSD / p.qty) * q
      p.qty = r6(p.qty - q)
      if (p.qty === 0) { p.cost = 0; p.costUSD = 0; p.usdTainted = false; p.openDate = null }
    }
  }

  const open = [...pos.values()]
    .filter((p) => p.qty > 0)
    .map((p) => ({
      key: p.key, ticker: p.ticker, assetType: p.assetType, portfolioId: p.portfolioId,
      qty: p.qty, avgCost: p.cost / p.qty, invested: p.cost,
      investedUSD: p.usdTainted ? null : p.costUSD, openDate: p.openDate,
    }))
  return { events, open, anomalies }
}

// Valor de un evento en la moneda pedida (null = no calculable).
export const evValue = (e, cur) => (cur === 'USD' ? e.plUSD : e.pl)
export const evBasis = (e, cur) => (cur === 'USD' ? e.costBasisUSD : e.costBasis)
