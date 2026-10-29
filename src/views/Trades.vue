<script setup>
import { ref, computed, watch } from 'vue'
import { useDesk } from '../composables/useDesk.js'
import { money, signedMoney, pct, date, num, tone, qty } from '../domain/format.js'
import Panel from '../components/Panel.vue'

const { filteredTrades, events, portfolioName, currencies } = useDesk()
const cur = computed(() => currencies.value[0])
const q = ref(''), op = ref('all'), res = ref('all')
const sortKey = ref('date'), sortDir = ref(-1), page = ref(1)
const SIZE = 25

const byId = computed(() => new Map(events.value.map((e) => [e.id, e])))
const rows = computed(() => filteredTrades.value.map((t) => {
  const e = byId.value.get(t.id)
  const v = e ? (cur.value === 'USD' ? e.plUSD : e.pl) : null
  const p = e ? (cur.value === 'USD' ? e.plPctUSD : e.plPct) : null
  return { ...t, gross: t.quantity * t.price, result: v, resultPct: p, days: e?.days ?? null, portfolio: portfolioName(t.portfolioId), isSell: t.operation === 'VENTA' }
}))
const filtered = computed(() => rows.value
  .filter((r) => !q.value || r.ticker.includes(q.value.trim().toUpperCase()))
  .filter((r) => op.value === 'all' || r.operation === op.value)
  .filter((r) => res.value === 'all' || (res.value === 'pos' ? r.result > 0 : r.result < 0))
  .sort((a, b) => {
    const x = a[sortKey.value], y = b[sortKey.value]
    if (x == null) return 1
    if (y == null) return -1
    return (x < y ? -1 : x > y ? 1 : 0) * sortDir.value
  }))
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / SIZE)))
const view = computed(() => filtered.value.slice((page.value - 1) * SIZE, page.value * SIZE))
watch([q, op, res, filtered], () => { if (page.value > pages.value) page.value = 1 })
watch([q, op, res], () => (page.value = 1))

const sortBy = (k) => { sortDir.value = sortKey.value === k ? -sortDir.value : -1; sortKey.value = k }
const COLS = [['date', 'Fecha'], ['ticker', 'Ticker'], ['assetType', 'Instrumento'], ['portfolio', 'Cartera'], ['operation', 'Operación'], ['quantity', 'Cantidad'], ['price', 'Precio ARS'], ['gross', 'Importe ARS'], ['fee', 'Comisión'], ['result', 'Resultado'], ['resultPct', 'Rent.'], ['days', 'Días']]

function exportCsv() {
  const head = ['fecha', 'ticker', 'instrumento', 'cartera', 'operacion', 'cantidad', 'precio_ars', 'importe_ars', 'comision_ars', 'ccl', `resultado_${cur.value}`, 'rentabilidad', 'dias']
  const lines = filtered.value.map((r) => [r.date, r.ticker, r.assetType, r.portfolio, r.operation, r.quantity, r.price, r.gross, r.fee, r.ccl ?? '', r.result ?? '', r.resultPct ?? '', r.days ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'operaciones.csv' })
  a.click(); URL.revokeObjectURL(a.href)
}
</script>

<template>
  <Panel title="Operaciones ejecutadas" note="Cada fila es una compra o venta ejecutada. El resultado se calcula en las ventas (costo promedio de la cartera y ticker). El backend no registra órdenes canceladas ni pendientes en esta tabla.">
    <template #actions>
      <input v-model="q" placeholder="Buscar ticker" class="search" aria-label="Buscar ticker" />
      <select v-model="op"><option value="all">Compras y ventas</option><option value="COMPRA">Compras</option><option value="VENTA">Ventas</option></select>
      <select v-model="res"><option value="all">Todos los resultados</option><option value="pos">Positivos</option><option value="neg">Negativos</option></select>
      <button class="ghost" @click="exportCsv" :disabled="!filtered.length">Exportar CSV</button>
    </template>
    <div class="table-wrap" v-if="filtered.length">
      <table class="dense sortable">
        <thead><tr>
          <th v-for="c in COLS" :key="c[0]" :class="{ r: !['date','ticker','assetType','portfolio','operation'].includes(c[0]) }" @click="sortBy(c[0])">
            {{ c[1] }}<i v-if="sortKey === c[0]">{{ sortDir > 0 ? ' ▲' : ' ▼' }}</i>
          </th>
        </tr></thead>
        <tbody>
          <tr v-for="r in view" :key="r.id">
            <td>{{ date(r.date) }}</td>
            <td><router-link :to="`/activos/${r.ticker}`">{{ r.ticker }}</router-link></td>
            <td>{{ r.assetType === 'CEDEAR' ? 'CEDEAR' : 'Acción AR' }}</td>
            <td>{{ r.portfolio }}</td>
            <td><span class="tag" :class="r.isSell ? 'sell' : 'buy'">{{ r.isSell ? 'Venta' : 'Compra' }}</span></td>
            <td class="r num">{{ qty(r.quantity) }}</td>
            <td class="r num">{{ money(r.price, 'ARS') }}</td>
            <td class="r num">{{ money(r.gross, 'ARS') }}</td>
            <td class="r num">{{ money(r.fee, 'ARS') }}</td>
            <td class="r num" :class="tone(r.result)">{{ r.isSell ? signedMoney(r.result, cur) : '' }}</td>
            <td class="r num" :class="tone(r.resultPct)">{{ r.isSell ? pct(r.resultPct) : '' }}</td>
            <td class="r num">{{ r.days ?? '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="empty">No hay operaciones que coincidan con los filtros.</p>
    <div class="pager" v-if="filtered.length">
      <button class="ghost" :disabled="page <= 1" @click="page--">Anterior</button>
      <span>Página {{ page }} de {{ pages }} · {{ filtered.length }} operaciones</span>
      <button class="ghost" :disabled="page >= pages" @click="page++">Siguiente</button>
    </div>
  </Panel>
</template>
