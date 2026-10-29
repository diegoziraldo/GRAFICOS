// Capa de acceso a la API. Solo lectura: esta app nunca modifica operaciones.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

async function get(path) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } })
  } catch {
    throw new Error('No se pudo conectar con el backend. Verificá que esté corriendo y la URL configurada.')
  }
  const text = await res.text()
  if (/^\s*</.test(text)) {
    throw new Error(`${BASE}${path} devolvió una página web (HTML) en lugar de datos. Eso pasa cuando las Functions de la API no están publicadas en ese dominio, o la URL apunta a otro sitio. Abrí esa dirección en el navegador: tiene que mostrar JSON.`)
  }
  if (!res.ok) throw new Error(`El backend respondió ${res.status} en ${path}`)
  try { return JSON.parse(text) } catch { throw new Error(`La respuesta de ${path} no es JSON válido.`) }
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

// Valida y normaliza una fila de /api/trades. Descarta las inválidas y las reporta.
export function normalizeTrade(r) {
  const t = {
    id: Number(r.id),
    date: String(r.date || '').slice(0, 10),
    assetType: r.assetType,
    ticker: String(r.ticker || '').toUpperCase(),
    operation: r.operation,
    quantity: Number(r.quantity),
    price: Number(r.price),
    fee: Number(r.fee) || 0,
    ccl: num(r.ccl) > 0 ? Number(r.ccl) : null,
    sector: r.sector || 'General',
    portfolioId: r.portfolioId ?? null,
    notes: r.notes || '',
  }
  const ok =
    /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    t.ticker &&
    (t.operation === 'COMPRA' || t.operation === 'VENTA') &&
    t.quantity > 0 &&
    t.price > 0
  return ok ? t : null
}

export async function fetchTrades() {
  const raw = await get('/trades')
  if (!Array.isArray(raw)) throw new Error('Respuesta inesperada de /trades')
  const trades = []
  let discarded = 0
  for (const r of raw) {
    const t = normalizeTrade(r)
    t ? trades.push(t) : discarded++
  }
  trades.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id))
  return { trades, discarded }
}

export async function fetchPortfolios() {
  const raw = await get('/portfolios')
  return Array.isArray(raw) ? raw.map((p) => ({ id: p.id, name: p.name })) : []
}
