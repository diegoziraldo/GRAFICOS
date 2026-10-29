const pad = (n) => String(n).padStart(2, '0')
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const PRESETS = [
  { id: 'all', label: 'Todo el historial' },
  { id: 'thisMonth', label: 'Este mes' },
  { id: 'prevMonth', label: 'Mes anterior' },
  { id: 'd30', label: 'Últimos 30 días' },
  { id: 'd90', label: 'Últimos 90 días' },
  { id: 'm6', label: 'Últimos 6 meses' },
  { id: 'thisYear', label: 'Año actual' },
  { id: 'prevYear', label: 'Año anterior' },
  { id: 'm12', label: 'Últimos 12 meses' },
  { id: 'custom', label: 'Personalizado' },
]

// Devuelve { from, to } (YYYY-MM-DD, inclusive; null = sin límite).
export function resolvePeriod(id, custom = {}, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth()
  const back = (days) => { const d = new Date(now); d.setDate(d.getDate() - days); return d }
  switch (id) {
    case 'thisMonth': return { from: iso(new Date(y, m, 1)), to: iso(now) }
    case 'prevMonth': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) }
    case 'd30': return { from: iso(back(30)), to: iso(now) }
    case 'd90': return { from: iso(back(90)), to: iso(now) }
    case 'm6': return { from: iso(new Date(y, m - 6, now.getDate())), to: iso(now) }
    case 'thisYear': return { from: `${y}-01-01`, to: iso(now) }
    case 'prevYear': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    case 'm12': return { from: iso(new Date(y - 1, m, now.getDate())), to: iso(now) }
    case 'custom': return { from: custom.from || null, to: custom.to || null }
    default: return { from: null, to: null }
  }
}

export const inRange = (date, { from, to }) => (!from || date >= from) && (!to || date <= to)
