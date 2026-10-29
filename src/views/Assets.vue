<script setup>
import { ref, computed } from 'vue'
import { useDesk } from '../composables/useDesk.js'
import { byField } from '../domain/metrics.js'
import { signedMoney, pct, plainPct, tone } from '../domain/format.js'
import { C, baseOptions, signColors } from '../components/chartTheme.js'
import Panel from '../components/Panel.vue'
import ChartCanvas from '../components/ChartCanvas.vue'

const { events, currencies } = useDesk()
const sortKey = ref('value'), dir = ref(-1)
const sortBy = (k) => { dir.value = sortKey.value === k ? -dir.value : -1; sortKey.value = k }
const tables = computed(() => currencies.value.map((cur) => {
  const rows = byField(events.value, cur, 'ticker').map((r) => ({ ...r, winRate: r.count ? r.wins / r.count : null }))
  const total = rows.reduce((a, r) => a + r.value, 0)
  rows.forEach((r) => (r.share = total !== 0 ? r.value / Math.abs(total) : null))
  rows.sort((a, b) => ((a[sortKey.value] ?? -Infinity) - (b[sortKey.value] ?? -Infinity)) * dir.value)
  const cfg = { type: 'bar', data: { labels: rows.map((r) => r.key), datasets: [{ data: rows.map((r) => r.value), backgroundColor: signColors(rows.map((r) => r.value)) }] }, options: baseOptions(cur) }
  return { cur, rows, cfg }
}))
const COLS = [['key', 'Ticker'], ['value', 'Resultado'], ['pct', 'Rentabilidad'], ['count', 'Ventas'], ['winRate', 'Aciertos'], ['share', 'Aporte al total']]
</script>

<template>
  <div>
    <Panel v-for="t in tables" :key="t.cur" :title="`Rendimiento por activo (${t.cur})`" note="Resultado realizado por ticker en el período. 'Aporte al total' = resultado del activo ÷ |resultado total|.">
      <template v-if="t.rows.length">
        <ChartCanvas :config="t.cfg" :height="220" />
        <div class="table-wrap">
          <table class="dense sortable">
            <thead><tr><th v-for="c in COLS" :key="c[0]" :class="{ r: c[0] !== 'key' }" @click="sortBy(c[0])">{{ c[1] }}<i v-if="sortKey === c[0]">{{ dir > 0 ? ' ▲' : ' ▼' }}</i></th></tr></thead>
            <tbody><tr v-for="r in t.rows" :key="r.key">
              <td><router-link :to="`/activos/${r.key}`">{{ r.key }}</router-link></td>
              <td class="r num" :class="tone(r.value)">{{ signedMoney(r.value, t.cur) }}</td>
              <td class="r num" :class="tone(r.pct)">{{ pct(r.pct) }}</td>
              <td class="r num">{{ r.count }}</td>
              <td class="r num">{{ plainPct(r.winRate) }}</td>
              <td class="r num">{{ plainPct(r.share) }}</td>
            </tr></tbody>
          </table>
        </div>
      </template>
      <p v-else class="empty">No hay ventas en el período para rankear activos.</p>
    </Panel>
  </div>
</template>
