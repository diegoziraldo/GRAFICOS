<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDesk } from '../composables/useDesk.js'
import { cumulative } from '../domain/metrics.js'
import { money, signedMoney, pct, date, num, tone, plainPct, qty } from '../domain/format.js'
import { C, baseOptions } from '../components/chartTheme.js'
import KpiCard from '../components/KpiCard.vue'
import Panel from '../components/Panel.vue'
import ChartCanvas from '../components/ChartCanvas.vue'

const route = useRoute()
const { ledger, trades, events, currencies, metricsFor, portfolioName } = useDesk()
const ticker = computed(() => String(route.params.ticker).toUpperCase())
const myTrades = computed(() => trades.value.filter((t) => t.ticker === ticker.value))
const myEvents = computed(() => events.value.filter((e) => e.ticker === ticker.value))
const myOpen = computed(() => ledger.value.open.filter((p) => p.ticker === ticker.value))
const fees = computed(() => myTrades.value.reduce((a, t) => a + t.fee, 0))
const totalNet = (cur) => metricsFor(cur).net

const priceCfg = computed(() => {
  const pt = (op) => myTrades.value.filter((t) => t.operation === op).map((t) => ({ x: t.date, y: t.price }))
  const o = baseOptions('ARS', { interaction: { mode: 'nearest', intersect: true } })
  o.scales.x = { type: 'category', labels: [...new Set(myTrades.value.map((t) => t.date))], grid: { display: false } }
  o.plugins.tooltip.callbacks.label = (c) => ` ${c.dataset.label}: ${money(c.parsed.y, 'ARS')}`
  return { type: 'line', data: { datasets: [
    { label: 'Compras', data: pt('COMPRA'), borderColor: C.accent, backgroundColor: C.accent, showLine: false, pointRadius: 5 },
    { label: 'Ventas', data: pt('VENTA'), borderColor: C.warn, backgroundColor: C.warn, showLine: false, pointStyle: 'triangle', pointRadius: 6 },
  ] }, options: { ...o, plugins: { ...o.plugins, legend: { display: true } } } }
})
</script>

<template>
  <div>
    <router-link to="/activos" class="back">← Volver al ranking</router-link>
    <h2 class="cur-title">{{ ticker }}</h2>
    <p v-if="!myTrades.length" class="empty">No hay operaciones registradas para {{ ticker }}.</p>
    <template v-else>
      <Panel title="Posición actual (por cartera)" note="Cada cartera tiene su propio costo promedio. Sin precios de mercado: no hay resultado no realizado.">
        <div class="table-wrap" v-if="myOpen.length">
          <table class="dense"><thead><tr><th>Cartera</th><th class="r">Cantidad</th><th class="r">Costo promedio</th><th class="r">Capital a costo</th><th class="r">Capital USD</th><th>Abierta desde</th></tr></thead>
            <tbody><tr v-for="p in myOpen" :key="p.key"><td>{{ portfolioName(p.portfolioId) }}</td><td class="r num">{{ qty(p.qty) }}</td><td class="r num">{{ money(p.avgCost) }}</td><td class="r num">{{ money(p.invested) }}</td><td class="r num">{{ p.investedUSD == null ? 'Sin CCL' : money(p.investedUSD, 'USD') }}</td><td>{{ date(p.openDate) }}</td></tr></tbody>
          </table>
        </div>
        <p v-else class="empty">Sin posición abierta.</p>
      </Panel>

      <div v-for="cur in currencies" :key="cur" class="kpi-grid">
        <KpiCard :label="`Resultado realizado (${cur})`" :value="signedMoney(totalNet(cur), cur)" :tone="tone(totalNet(cur))" help="Suma de ventas de este activo en el período." />
        <KpiCard :label="`Rentabilidad (${cur})`" :value="pct(metricsFor(cur, myEvents).returnPct)" :tone="tone(metricsFor(cur, myEvents).returnPct)" />
        <KpiCard :label="`Aciertos (${cur})`" :value="plainPct(metricsFor(cur, myEvents).winRate)" :sub="`${metricsFor(cur, myEvents).count} ventas`" />
        <KpiCard :label="`Resultado de ${ticker} (${cur})`" :value="signedMoney(metricsFor(cur, myEvents).net, cur)" :tone="tone(metricsFor(cur, myEvents).net)" :sub="`Aporte: ${plainPct(totalNet(cur) ? metricsFor(cur, myEvents).net / Math.abs(totalNet(cur)) : null)} del total filtrado`" />
        <KpiCard label="Comisiones acumuladas (ARS)" :value="money(fees)" help="Compras y ventas de este activo, todo el historial." />
      </div>

      <Panel title="Compras y ventas en el tiempo (precio en ARS)"><ChartCanvas :config="priceCfg" /></Panel>

      <Panel title="Historial de movimientos">
        <div class="table-wrap"><table class="dense">
          <thead><tr><th>Fecha</th><th>Cartera</th><th>Operación</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Comisión</th><th class="r">CCL</th></tr></thead>
          <tbody><tr v-for="t in [...myTrades].reverse()" :key="t.id">
            <td>{{ date(t.date) }}</td><td>{{ portfolioName(t.portfolioId) }}</td>
            <td><span class="tag" :class="t.operation === 'VENTA' ? 'sell' : 'buy'">{{ t.operation === 'VENTA' ? 'Venta' : 'Compra' }}</span></td>
            <td class="r num">{{ qty(t.quantity) }}</td><td class="r num">{{ money(t.price) }}</td><td class="r num">{{ money(t.fee) }}</td><td class="r num">{{ t.ccl ? num(t.ccl) : '—' }}</td>
          </tr></tbody></table></div>
      </Panel>
    </template>
  </div>
</template>
