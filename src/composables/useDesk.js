import { reactive, ref, computed } from 'vue'
import { fetchTrades, fetchPortfolios } from '../api/client.js'
import { buildLedger } from '../domain/engine.js'
import { computeMetrics } from '../domain/metrics.js'
import { resolvePeriod, inRange } from '../domain/periods.js'

// Estado global único (singleton): datos crudos, filtros y derivados.
const loading = ref(true)
const error = ref('')
const trades = ref([])
const portfolios = ref([])
const discarded = ref(0)
const portfoliosError = ref('')
const source = ref('api') // 'api' | 'file'
const sourceLabel = ref('')

const defaults = () => ({ preset: 'all', from: '', to: '', currency: 'ARS', portfolio: 'all', assetType: 'all' })
const filters = reactive(defaults())

// El libro se calcula sobre TODO el historial: el costo promedio depende de
// compras anteriores al período. El filtro de fechas se aplica a las ventas.
const ledger = computed(() => buildLedger(trades.value))
const range = computed(() => resolvePeriod(filters.preset, { from: filters.from, to: filters.to }))
const currencies = computed(() => (filters.currency === 'BOTH' ? ['ARS', 'USD'] : [filters.currency]))

const passes = (x) =>
  (filters.portfolio === 'all' || String(x.portfolioId ?? 'none') === filters.portfolio) &&
  (filters.assetType === 'all' || x.assetType === filters.assetType)

const events = computed(() => ledger.value.events.filter((e) => passes(e) && inRange(e.date, range.value)))
const openPositions = computed(() => ledger.value.open.filter(passes))
const filteredTrades = computed(() => trades.value.filter((t) => passes(t) && inRange(t.date, range.value)))
const metricsFor = (cur, evs = events.value) => computeMetrics(evs, cur)

// Carteras de la API + cualquier cartera referenciada por operaciones que la API no listó.
const portfolioOptions = computed(() => {
  const counts = new Map()
  for (const t of trades.value) counts.set(t.portfolioId, (counts.get(t.portfolioId) || 0) + 1)
  const list = portfolios.value.map((p) => ({ id: p.id, name: p.name, count: counts.get(p.id) || 0 }))
  for (const [id, count] of counts) if (id != null && !list.some((p) => p.id === id)) list.push({ id, name: `Cartera ${id}`, count })
  return list
})
const unassigned = computed(() => trades.value.filter((t) => t.portfolioId == null).length)
const portfolioName = (id) => (id == null ? 'Sin cartera' : portfolioOptions.value.find((p) => p.id === id)?.name || `Cartera ${id}`)

async function load() {
  source.value = 'api'
  loading.value = true
  error.value = ''
  try {
    portfoliosError.value = ''
    const [t, p] = await Promise.all([
      fetchTrades(),
      fetchPortfolios().catch((e) => { portfoliosError.value = e.message; return [] }),
    ])
    trades.value = t.trades
    discarded.value = t.discarded
    portfolios.value = p
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
function useImported(data, label) {
  trades.value = data.trades; portfolios.value = data.portfolios; discarded.value = data.discarded
  error.value = ''; portfoliosError.value = ''; loading.value = false; source.value = 'file'; sourceLabel.value = label
  filters.portfolio = 'all'
}
const resetFilters = () => Object.assign(filters, defaults())

export function useDesk() {
  return {
    loading, error, portfoliosError, portfolioOptions, unassigned, source, sourceLabel, useImported, trades, portfolios, discarded, filters, ledger, range, currencies,
    events, openPositions, filteredTrades, metricsFor, portfolioName, load, resetFilters,
  }
}
