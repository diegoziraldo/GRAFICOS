// Cauciones colocadoras. Mismas fórmulas que functions/_lib/cauciones.js
// (interés simple, base 365 días, redondeo a 2 decimales por caución), así los
// totales coinciden con los del backend.
//   interés bruto = monto × TNA/100 × días/365
//   comisión      = % del interés bruto  |  monto fijo
//   ganancia neta = interés bruto − comisión
//   TNA neta      = ganancia neta / monto × 365/días × 100
// Una caución NO tiene tipo de cambio: ARS y USD se mantienen siempre separados.
import { iso } from './periods.js'
import { periodKey } from './metrics.js'

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const pick = (r, ...keys) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== null)

export function addDays(dateStr, days) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0))
  return dt.toISOString().slice(0, 10)
}

// Acepta filas de la API (camelCase) o de un CSV exportado (snake_case).
export function normalizeCaucion(r, fallbackId = 0) {
  const startDate = String(pick(r, 'startDate', 'start_date') ?? '').slice(0, 10)
  const termDays = Number(pick(r, 'termDays', 'term_days'))
  const amount = Number(r.amount)
  const tna = Number(r.tna)
  const feeType = pick(r, 'feeType', 'fee_type')
  const feeValue = Number(pick(r, 'feeValue', 'fee_value') ?? 0)
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && termDays > 0 && amount > 0 && tna >= 0 &&
    (feeType === 'PERCENT' || feeType === 'FIXED') && feeValue >= 0
  if (!ok) return null

  const gross = amount * (tna / 100) * (termDays / 365)
  const fee = feeType === 'PERCENT' ? gross * (feeValue / 100) : feeValue
  const net = gross - fee
  return {
    id: Number(r.id) || fallbackId, startDate, termDays, endDate: addDays(startDate, termDays), amount,
    currency: r.currency === 'USD' ? 'USD' : 'ARS', tna, broker: String(r.broker ?? '').trim() || 'Sin broker',
    feeType, feeValue, status: r.status === 'FINALIZADA' ? 'FINALIZADA' : 'ACTIVA', notes: String(r.notes ?? ''),
    grossInterest: r2(gross), brokerFee: r2(fee), netGain: r2(net),
    netTNA: r2(amount > 0 ? (net / amount) * (365 / termDays) * 100 : 0), totalToReceive: r2(amount + net),
  }
}

// ACTIVA con vencimiento ya pasado: el usuario no la marcó como finalizada.
export const isOverdue = (c, today = iso(new Date())) => c.status === 'ACTIVA' && c.endDate < today
export const statusOf = (c, today) => (isOverdue(c, today) ? 'VENCIDA' : c.status)

export function caucionMetrics(list, today = iso(new Date())) {
  const done = list.filter((c) => c.status === 'FINALIZADA')
  const act = list.filter((c) => c.status === 'ACTIVA')
  const sum = (a, k) => a.reduce((x, c) => x + c[k], 0)
  const gross = sum(list, 'grossInterest'), fees = sum(list, 'brokerFee')
  const net = sum(list, 'netGain')
  const capDays = list.reduce((x, c) => x + c.amount * c.termDays, 0) // capital × días colocado
  const upcoming = act.filter((c) => c.endDate >= today).sort((a, b) => (a.endDate < b.endDate ? -1 : 1))[0] ?? null
  return {
    count: list.length, doneCount: done.length, activeCount: act.length,
    overdueCount: act.filter((c) => c.endDate < today).length,
    capitalActive: sum(act, 'amount'), realized: sum(done, 'netGain'), projected: sum(act, 'netGain'), net, gross, fees,
    feeShare: gross > 0 ? fees / gross : null,
    tnaGross: capDays > 0 ? (gross / capDays) * 365 * 100 : null,
    tnaNet: capDays > 0 ? (net / capDays) * 365 * 100 : null, // ponderada por monto × días
    avgTerm: list.length ? sum(list, 'termDays') / list.length : null,
    avgAmount: list.length ? sum(list, 'amount') / list.length : null,
    bestNetTNA: list.length ? Math.max(...list.map((c) => c.netTNA)) : null,
    worstNetTNA: list.length ? Math.min(...list.map((c) => c.netTNA)) : null,
    next: upcoming,
  }
}

// Ganancia neta por período de vencimiento, separada en cobrada y proyectada.
export function groupCauciones(list, group) {
  const m = new Map()
  for (const c of list) {
    const k = periodKey(c.endDate, group)
    const g = m.get(k) || { key: k, realized: 0, projected: 0, count: 0 }
    g[c.status === 'FINALIZADA' ? 'realized' : 'projected'] += c.netGain
    g.count++; m.set(k, g)
  }
  return [...m.values()].sort((a, b) => (a.key < b.key ? -1 : 1))
}

// Ganancia cobrada acumulada por fecha de vencimiento.
export function cumulativeRealized(list) {
  const byDay = new Map()
  for (const c of list) if (c.status === 'FINALIZADA') byDay.set(c.endDate, (byDay.get(c.endDate) || 0) + c.netGain)
  let acc = 0
  return [...byDay.keys()].sort().map((d) => ({ date: d, daily: byDay.get(d), value: (acc += byDay.get(d)) }))
}
