import { evValue, evBasis } from './engine.js'

const sum = (a) => a.reduce((x, y) => x + y, 0)
const EPS = 0.005

export function computeMetrics(events, cur) {
  const valid = events.filter((e) => evValue(e, cur) != null)
  const vals = valid.map((e) => evValue(e, cur))
  const wins = vals.filter((v) => v > EPS)
  const losses = vals.filter((v) => v < -EPS)
  const even = vals.length - wins.length - losses.length
  const grossWin = sum(wins)
  const grossLoss = Math.abs(sum(losses))
  const net = sum(vals)
  const basis = sum(valid.map((e) => evBasis(e, cur)))
  const avgWin = wins.length ? grossWin / wins.length : null
  const avgLoss = losses.length ? grossLoss / losses.length : null

  let curW = 0, curL = 0, maxW = 0, maxL = 0
  for (const v of vals) {
    if (v > EPS) { curW++; curL = 0 } else if (v < -EPS) { curL++; curW = 0 } else { curW = 0; curL = 0 }
    maxW = Math.max(maxW, curW); maxL = Math.max(maxL, curL)
  }
  const dd = drawdown(cumulative(valid, cur))
  return {
    count: vals.length,
    excluded: events.length - vals.length, // eventos sin dato USD confiable
    wins: wins.length, losses: losses.length, even,
    winRate: vals.length ? wins.length / vals.length : null,
    net, grossWin, grossLoss, basis,
    returnPct: basis > 0 ? net / basis : null,
    avgWin, avgLoss,
    payoff: avgWin != null && avgLoss ? avgWin / avgLoss : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    expectancy: vals.length ? net / vals.length : null,
    best: vals.length ? Math.max(...vals) : null,
    worst: vals.length ? Math.min(...vals) : null,
    maxWinStreak: maxW, maxLossStreak: maxL,
    maxDrawdown: dd.max, ddDuration: dd.durationDays,
    fees: sum(valid.map((e) => e.fee)),
  }
}

// Curva de resultado realizado acumulado (un punto por día con ventas).
export function cumulative(events, cur) {
  const byDay = new Map()
  for (const e of events) {
    const v = evValue(e, cur)
    if (v == null) continue
    byDay.set(e.date, (byDay.get(e.date) || 0) + v)
  }
  let acc = 0
  return [...byDay.keys()].sort().map((d) => ({ date: d, daily: byDay.get(d), value: (acc += byDay.get(d)) }))
}

// Drawdown en unidades monetarias sobre la curva de resultado realizado
// (el pico inicial es 0). No es drawdown de patrimonio: no hay serie de valor.
export function drawdown(curve) {
  let peak = 0, peakDate = null, max = 0, maxDuration = 0
  const series = []
  for (const p of curve) {
    if (p.value >= peak) { peak = p.value; peakDate = p.date }
    const dd = p.value - peak
    series.push({ date: p.date, value: dd })
    if (dd < max) max = dd
    if (peakDate && dd < 0) {
      maxDuration = Math.max(maxDuration, Math.round((Date.parse(p.date) - Date.parse(peakDate)) / 864e5))
    }
  }
  return { series, max, durationDays: maxDuration }
}

function isoWeekStart(d) {
  const dt = new Date(d + 'T00:00:00Z')
  const day = (dt.getUTCDay() + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - day)
  return dt.toISOString().slice(0, 10)
}

export function periodKey(date, group) {
  if (group === 'day') return date
  if (group === 'week') return isoWeekStart(date)
  if (group === 'month') return date.slice(0, 7)
  if (group === 'quarter') return `${date.slice(0, 4)}-T${Math.floor((+date.slice(5, 7) - 1) / 3) + 1}`
  return date.slice(0, 4)
}

export function groupResults(events, cur, group) {
  const m = new Map()
  for (const e of events) {
    const v = evValue(e, cur)
    if (v == null) continue
    const k = periodKey(e.date, group)
    const g = m.get(k) || { key: k, value: 0, count: 0 }
    g.value += v; g.count++
    m.set(k, g)
  }
  return [...m.values()].sort((a, b) => (a.key < b.key ? -1 : 1))
}

export function byField(events, cur, field) {
  const m = new Map()
  for (const e of events) {
    const v = evValue(e, cur)
    if (v == null) continue
    const k = typeof field === 'function' ? field(e) : e[field]
    const g = m.get(k) || { key: k, value: 0, basis: 0, count: 0, wins: 0 }
    g.value += v; g.basis += evBasis(e, cur) || 0; g.count++
    if (v > EPS) g.wins++
    m.set(k, g)
  }
  return [...m.values()].map((g) => ({ ...g, pct: g.basis > 0 ? g.value / g.basis : null }))
}

export function histogram(values, bins = 12) {
  if (!values.length) return []
  const min = Math.min(...values), max = Math.max(...values)
  if (min === max) return [{ from: min, to: max, count: values.length }]
  const w = (max - min) / bins
  const out = Array.from({ length: bins }, (_, i) => ({ from: min + i * w, to: min + (i + 1) * w, count: 0 }))
  for (const v of values) out[Math.min(bins - 1, Math.floor((v - min) / w))].count++
  return out
}

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const weekdayOf = (date) => (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7
