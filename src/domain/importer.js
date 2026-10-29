// Importación local (CSV/JSON). No escribe en ninguna base: solo carga datos
// en memoria para explorar la app. Reutiliza la misma validación que la API.
import { normalizeTrade } from '../api/client.js'

const strip = (h) => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/[\s-]+/g, '_')
const ALIAS = {
  date: ['fecha', 'date', 'trade_date'], ticker: ['ticker', 'simbolo', 'activo', 'symbol'],
  operation: ['operacion', 'operation', 'tipo', 'compra_venta', 'side'], quantity: ['cantidad', 'quantity', 'qty'],
  price: ['precio', 'price', 'precio_ars'], fee: ['comision', 'comisiones', 'fee'], ccl: ['ccl', 'dolar', 'dolar_ccl'],
  assetType: ['instrumento', 'tipo_activo', 'assettype', 'asset_type'], portfolio: ['cartera', 'portfolio'],
  portfolioId: ['portfolio_id', 'portfolioid', 'cartera_id', 'id_cartera'],
}

export function parseNumber(v) {
  if (v == null) return null
  let s = String(v).trim().replace(/[$\s]|ARS|USD/gi, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseDate(v) {
  const s = String(v || '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}

const op = (v) => {
  const s = strip(String(v || ''))
  return /^(compra|buy|c)$/.test(s) ? 'COMPRA' : /^(venta|sell|v)$/.test(s) ? 'VENTA' : ''
}

export function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '')
  const first = clean.split(/\r?\n/, 1)[0] || ''
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ','
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (q) { if (c === '"') { if (clean[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === sep) { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && clean[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim())) rows.push(row); row = [] }
    else cur += c
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row)
  return rows
}

export function importFromText(text, filename = '', portfolioNames = new Map()) {
  const isJson = /\.json$/i.test(filename) || /^\s*[[{]/.test(text)
  let raw = []
  const names = new Map()
  const pidFor = (name) => {
    const n = String(name ?? '').trim()
    if (!n) return null
    if (!names.has(n)) names.set(n, names.size + 1)
    return names.get(n)
  }
  if (isJson) {
    let j
    try { j = JSON.parse(text) } catch { throw new Error('El archivo JSON no es válido.') }
    raw = Array.isArray(j) ? j : Array.isArray(j?.trades) ? j.trades : []
  } else {
    const table = parseCsv(text)
    if (table.length < 2) throw new Error('El archivo no tiene filas de datos.')
    const head = table[0].map(strip)
    const idx = {}
    for (const [k, list] of Object.entries(ALIAS)) idx[k] = head.findIndex((h) => list.includes(h))
    const missing = ['date', 'ticker', 'operation', 'quantity', 'price'].filter((k) => idx[k] < 0)
    if (missing.length) throw new Error(`Faltan columnas: ${missing.map((k) => ALIAS[k][0]).join(', ')}. Encabezados esperados: fecha, ticker, operacion, cantidad, precio (opcionales: instrumento, comision, ccl, cartera).`)
    raw = table.slice(1).map((r, i) => ({
      id: i + 1, date: parseDate(r[idx.date]), ticker: (r[idx.ticker] || '').trim(), operation: op(r[idx.operation]),
      quantity: parseNumber(r[idx.quantity]), price: parseNumber(r[idx.price]), fee: idx.fee >= 0 ? parseNumber(r[idx.fee]) || 0 : 0,
      ccl: idx.ccl >= 0 ? parseNumber(r[idx.ccl]) : null,
      assetType: idx.assetType >= 0 && /acc/i.test(r[idx.assetType] || '') ? 'ACCION_AR' : 'CEDEAR',
      portfolioId: idx.portfolioId >= 0 ? (Number(r[idx.portfolioId]) > 0 ? Number(r[idx.portfolioId]) : null) : idx.portfolio >= 0 ? pidFor(r[idx.portfolio]) : null,
    }))
  }
  const trades = []; let discarded = 0
  raw.forEach((r, i) => { const t = normalizeTrade({ id: i + 1, ...r }); t ? trades.push(t) : discarded++ })
  if (!trades.length) throw new Error('No se encontró ninguna operación válida (revisá fechas, cantidades y precios).')
  trades.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id))
  let portfolios = [...names].map(([name, id]) => ({ id, name }))
  if (!portfolios.length) {
    const ids = new Set([...trades.map((t) => t.portfolioId).filter((x) => x != null), ...portfolioNames.keys()])
    portfolios = [...ids].sort((a, b) => a - b)
      .map((id) => ({ id, name: portfolioNames.get(id) || `Cartera ${id}` }))
  }
  return { trades, portfolios, discarded }
}

// id -> nombre desde un CSV (id,name,...) o JSON [{id,name}] de carteras.
export function parsePortfolioNames(text) {
  const out = new Map()
  if (/^\s*[[{]/.test(text)) {
    try { const j = JSON.parse(text); for (const p of Array.isArray(j) ? j : []) out.set(Number(p.id), String(p.name)) } catch { /* ignorar */ }
    return out
  }
  const t = parseCsv(text)
  const h = (t[0] || []).map(strip)
  const i = h.indexOf('id'), n = h.findIndex((x) => x === 'name' || x === 'nombre')
  if (i >= 0 && n >= 0) for (const r of t.slice(1)) out.set(Number(r[i]), String(r[n]))
  return out
}

const isPortfolioFile = (text) => {
  if (/^\s*[[{]/.test(text)) return /"name"/.test(text) && !/"ticker"/.test(text)
  const h = (parseCsv(text)[0] || []).map(strip)
  return (h.includes('name') || h.includes('nombre')) && !h.includes('ticker')
}

// Acepta varios archivos a la vez: operaciones (obligatorio) + carteras (opcional).
export function importFiles(files) {
  const portfolioFile = files.find((f) => isPortfolioFile(f.text))
  const tradesFile = files.find((f) => f !== portfolioFile)
  if (!tradesFile) throw new Error('Falta el archivo de operaciones (trades).')
  const names = portfolioFile ? parsePortfolioNames(portfolioFile.text) : new Map()
  return importFromText(tradesFile.text, tradesFile.name, names)
}
