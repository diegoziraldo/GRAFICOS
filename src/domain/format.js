import { hidden } from '../composables/usePrivacy.js'
export const MASK = '••••••'
const cache = {}
const nf = (cur, digits) => (cache[cur + digits] ??= new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits,
}))
export const money = (v, cur = 'ARS', digits = 2) => (v == null || Number.isNaN(v) ? '—' : hidden.value ? MASK : nf(cur, digits).format(v))
export const signedMoney = (v, cur = 'ARS') => (v == null ? '—' : hidden.value ? MASK : (v > 0 ? '+' : '') + money(v, cur))
export const qty = (v) => (v == null ? '—' : hidden.value ? MASK : v.toLocaleString('es-AR', { maximumFractionDigits: 6 }))
export const pct = (v, digits = 2) =>
  v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
export const plainPct = (v) => (v == null ? '—' : `${(v * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`)
export const num = (v, d = 2) => (v == null ? '—' : v.toLocaleString('es-AR', { maximumFractionDigits: d }))
export const date = (s) => (s ? s.split('-').reverse().join('/') : '—')
export const tone = (v) => (v == null ? '' : v > 0.005 ? 'gain' : v < -0.005 ? 'loss' : '')
