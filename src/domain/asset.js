// Cálculos del detalle de un activo. Misma contabilidad que engine.js
// (costo promedio, reinicio al llegar a 0, ventas excedidas recortadas).
import { iso } from './periods.js'

const r6 = (n) => Math.round(n * 1e6) / 1e6
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)
export const todayIso = () => iso(new Date())

// Reproduce las operaciones (ordenadas) y devuelve, por id de operación, el
// estado de SU posición (cartera) antes y después de ejecutarse.
export function replay(trades) {
  const pos = new Map()
  const rows = new Map()
  for (const t of trades) {
    const k = t.portfolioId ?? 'none'
    const p = pos.get(k) || { qty: 0, cost: 0 }
    pos.set(k, p)
    const avgBefore = p.qty > 0 ? p.cost / p.qty : null
    if (t.operation === 'COMPRA') {
      p.qty = r6(p.qty + t.quantity)
      p.cost += t.quantity * t.price + t.fee
    } else if (p.qty > 0) {
      const q = Math.min(t.quantity, p.qty)
      p.cost -= q * (p.cost / p.qty)
      p.qty = r6(p.qty - q)
      if (p.qty === 0) p.cost = 0
    }
    rows.set(t.id, { qtyAfter: p.qty, avgBefore, avgAfter: p.qty > 0 ? p.cost / p.qty : null })
  }
  return rows
}

export function tradeTotals(trades) {
  const side = (op) => {
    const l = trades.filter((t) => t.operation === op)
    const q = l.reduce((a, t) => a + t.quantity, 0)
    const gross = l.reduce((a, t) => a + t.quantity * t.price, 0)
    return { count: l.length, qty: q, gross, avg: q > 0 ? gross / q : null }
  }
  const buys = side('COMPRA'), sells = side('VENTA')
  const fees = trades.reduce((a, t) => a + t.fee, 0)
  const traded = buys.gross + sells.gross
  return { buys, sells, fees, feePct: traded > 0 ? fees / traded : null, first: trades[0]?.date ?? null, last: trades.at(-1)?.date ?? null }
}

// Días entre la apertura de la posición y cada venta.
export function holdStats(events) {
  const d = events.map((e) => e.days).filter((x) => x != null).sort((a, b) => a - b)
  if (!d.length) return null
  const mid = Math.floor(d.length / 2)
  return { avg: d.reduce((a, b) => a + b, 0) / d.length, min: d[0], max: d[d.length - 1], median: d.length % 2 ? d[mid] : (d[mid - 1] + d[mid]) / 2 }
}
