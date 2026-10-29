<script setup>
import { ref, computed } from 'vue'
import { useDesk } from '../composables/useDesk.js'
import { cumulative, drawdown, groupResults, byField } from '../domain/metrics.js'
import { money, signedMoney, pct, plainPct, num, tone } from '../domain/format.js'
import { DEF } from '../domain/definitions.js'
import { C, baseOptions, signColors } from './chartTheme.js'
import KpiCard from './KpiCard.vue'
import Panel from './Panel.vue'
import ChartCanvas from './ChartCanvas.vue'

const props = defineProps({ cur: { type: String, required: true } })
const { events, metricsFor, openPositions, portfolioName } = useDesk()
const m = computed(() => metricsFor(props.cur))
const group = ref('month')
const tab = ref('win')
const GROUPS = [['day', 'Día'], ['week', 'Sem.'], ['month', 'Mes'], ['quarter', 'Trim.'], ['year', 'Año']]

const curve = computed(() => cumulative(events.value, props.cur))
const dd = computed(() => drawdown(curve.value))
const grouped = computed(() => groupResults(events.value, props.cur, group.value))
const openCapital = computed(() => {
  const list = openPositions.value
  if (props.cur === 'ARS') return list.reduce((a, p) => a + p.invested, 0)
  return list.every((p) => p.investedUSD != null) ? list.reduce((a, p) => a + p.investedUSD, 0) : null
})

const area = (rgb) => (ctx) => {
  const a = ctx.chart.chartArea
  if (!a) return 'transparent'
  const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom)
  g.addColorStop(0, `rgba(${rgb},.32)`); g.addColorStop(1, `rgba(${rgb},0)`)
  return g
}
const curveCfg = computed(() => ({
  type: 'line',
  data: { labels: curve.value.map((p) => p.date), datasets: [{ label: 'Realizado acumulado', data: curve.value.map((p) => p.value), borderColor: C.accent, backgroundColor: area('47,107,255'), fill: 'origin', stepped: true, pointRadius: curve.value.length > 60 ? 0 : 2, borderWidth: 2 }] },
  options: baseOptions(props.cur),
}))
const ddCfg = computed(() => ({
  type: 'line',
  data: { labels: dd.value.series.map((p) => p.date), datasets: [{ label: 'Drawdown', data: dd.value.series.map((p) => p.value), borderColor: C.loss, backgroundColor: area('255,77,106'), fill: 'origin', stepped: true, pointRadius: 0, borderWidth: 1.5 }] },
  options: baseOptions(props.cur),
}))
const barCfg = computed(() => ({
  type: 'bar',
  data: { labels: grouped.value.map((g) => g.key), datasets: [{ label: 'Resultado', data: grouped.value.map((g) => g.value), backgroundColor: signColors(grouped.value.map((g) => g.value)), borderRadius: 2 }] },
  options: baseOptions(props.cur),
}))
const donutCfg = computed(() => ({
  type: 'doughnut',
  data: { labels: ['Ganadoras', 'Perdedoras', 'En equilibrio'], datasets: [{ data: [m.value.wins, m.value.losses, m.value.even], backgroundColor: [C.gain, C.loss, '#4b5d82'], borderWidth: 0 }] },
  options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } },
}))
const share = (n) => (m.value.count ? n / m.value.count : null)

const assets = computed(() => {
  const rows = byField(events.value, props.cur, 'ticker')
  const key = tab.value === 'pct' ? 'pct' : 'value'
  rows.sort((a, b) => (tab.value === 'loss' ? (a[key] ?? 0) - (b[key] ?? 0) : (b[key] ?? -Infinity) - (a[key] ?? -Infinity)))
  return rows.slice(0, 5)
})
const portfolios = computed(() => {
  const rows = byField(events.value, props.cur, (e) => e.portfolioId ?? 'none').map((r) => ({ ...r, name: portfolioName(r.key === 'none' ? null : r.key) })).sort((a, b) => b.value - a.value)
  const total = rows.reduce((a, r) => a + r.value, 0)
  return rows.map((r) => ({ ...r, part: total ? r.value / Math.abs(total) : null }))
})

// Mini calendario: mes de la última venta del período.
const mini = computed(() => {
  const evs = events.value
  const base = evs.length ? evs[evs.length - 1].date : new Date().toISOString().slice(0, 10)
  const y = +base.slice(0, 4), mo = +base.slice(5, 7) - 1
  const day = new Map()
  for (const e of evs) { const v = props.cur === 'USD' ? e.plUSD : e.pl; if (v != null && e.date.slice(0, 7) === base.slice(0, 7)) day.set(e.date, (day.get(e.date) || 0) + v) }
  const out = Array((new Date(y, mo, 1).getDay() + 6) % 7).fill(null)
  for (let d = 1; d <= new Date(y, mo + 1, 0).getDate(); d++) {
    const k = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    out.push({ d, v: day.get(k) })
  }
  return { label: new Date(y, mo, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }), cells: out }
})

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const matrix = computed(() => {
  const rows = new Map()
  for (const g of groupResults(events.value, props.cur, 'month')) {
    const [y, mo] = g.key.split('-')
    if (!rows.has(y)) rows.set(y, { year: y, months: Array(12).fill(null), total: 0 })
    const r = rows.get(y); r.months[+mo - 1] = g.value; r.total += g.value
  }
  return [...rows.values()].sort((a, b) => (a.year < b.year ? -1 : 1))
})
</script>

<template>
  <div class="cur-block">
    <h2 class="cur-title">Resumen en {{ cur }}
      <small>{{ cur === 'USD' ? 'Convertido operación por operación con el CCL cargado en cada trade' : 'Importes originales en pesos' }}</small>
    </h2>
    <p v-if="m.excluded" class="warn">{{ m.excluded }} venta(s) quedan fuera de las cifras en USD porque la posición no tiene CCL en todas sus compras o en la venta. No se estimó ninguna cotización.</p>

    <div class="row-big">
      <div class="big accent-a"><span>Resultado realizado neto</span><b class="num" :class="tone(m.net)">{{ signedMoney(m.net, cur) }}</b><em class="num" :class="tone(m.returnPct)">{{ pct(m.returnPct) }}</em><small>Ganancias − pérdidas − costos de venta</small></div>
      <div class="big accent-b muted"><span>Resultado no realizado</span><b>No disponible</b><small>El backend no guarda precios de mercado</small></div>
      <div class="big accent-c"><span>Resultado total (solo realizado)</span><b class="num" :class="tone(m.net)">{{ signedMoney(m.net, cur) }}</b><small>Sin duplicar posiciones abiertas</small></div>
      <div class="big accent-d"><span>Capital en posiciones abiertas</span><b class="num">{{ openCapital == null ? 'Faltan CCL' : money(openCapital, cur) }}</b><small>Valuado a costo, no a mercado</small></div>
    </div>

    <div class="row-small">
      <KpiCard label="Costo de lo vendido" :value="money(m.basis, cur)" :help="DEF.basis" />
      <KpiCard label="Rentabilidad sobre costo" :value="pct(m.returnPct)" :tone="tone(m.returnPct)" :help="DEF.returnPct" />
      <KpiCard label="Ventas cerradas" :value="String(m.count)" :help="DEF.count" />
      <KpiCard label="Ganadoras" :value="String(m.wins)" :sub="plainPct(share(m.wins))" tone="gain" :help="DEF.wins" />
      <KpiCard label="Perdedoras" :value="String(m.losses)" :sub="plainPct(share(m.losses))" tone="loss" :help="DEF.losses" />
      <KpiCard label="Comisiones de venta" :value="money(m.fees, cur)" :help="DEF.fees" />
    </div>
    <div class="row-small r4">
      <KpiCard label="Ganancia promedio" :value="money(m.avgWin, cur)" tone="gain" :help="DEF.avgWin" />
      <KpiCard label="Pérdida promedio" :value="m.avgLoss == null ? '—' : '−' + money(m.avgLoss, cur)" tone="loss" :help="DEF.avgLoss" />
      <KpiCard label="Profit factor" :value="num(m.profitFactor)" :sub="m.profitFactor == null ? 'Requiere una pérdida' : ''" :help="DEF.profitFactor" />
      <KpiCard label="Mejor / peor operación" :value="signedMoney(m.best, cur)" :sub="'Peor: ' + signedMoney(m.worst, cur)" :tone="tone(m.best)" :help="DEF.best" />
    </div>

    <div class="grid-3">
      <Panel title="Evolución del resultado realizado">
        <ChartCanvas v-if="curve.length" :config="curveCfg" :height="250" /><p v-else class="empty">No hay ventas en el período.</p>
      </Panel>
      <Panel title="Ganancias y pérdidas por período">
        <template #actions><button v-for="g in GROUPS" :key="g[0]" class="chip" :class="{ on: group === g[0] }" @click="group = g[0]">{{ g[1] }}</button></template>
        <ChartCanvas v-if="grouped.length" :config="barCfg" :height="250" /><p v-else class="empty">No hay ventas en el período.</p>
      </Panel>
      <Panel title="Distribución de resultados">
        <div v-if="m.count" class="donut-wrap">
          <div class="donut"><ChartCanvas :config="donutCfg" :height="190" /><div class="donut-c"><b class="num">{{ m.count }}</b><span>operaciones</span></div></div>
          <ul class="legend">
            <li><i style="background:var(--gain)" />Ganadoras<b class="num">{{ plainPct(share(m.wins)) }}</b></li>
            <li><i style="background:var(--loss)" />Perdedoras<b class="num">{{ plainPct(share(m.losses)) }}</b></li>
            <li><i style="background:#4b5d82" />En equilibrio<b class="num">{{ plainPct(share(m.even)) }}</b></li>
          </ul>
        </div>
        <p v-else class="empty">No hay ventas en el período.</p>
      </Panel>
    </div>

    <div class="grid-4">
      <Panel title="Rendimiento por activo">
        <template #actions><button class="chip" :class="{ on: tab === 'win' }" @click="tab = 'win'">Ganadores</button><button class="chip" :class="{ on: tab === 'loss' }" @click="tab = 'loss'">Perdedores</button><button class="chip" :class="{ on: tab === 'pct' }" @click="tab = 'pct'">Rentab.</button></template>
        <table v-if="assets.length" class="dense"><thead><tr><th>Activo</th><th class="r">Resultado</th><th class="r">Rent.</th><th class="r">Ops.</th></tr></thead>
          <tbody><tr v-for="r in assets" :key="r.key"><td><router-link :to="`/activos/${r.key}`">{{ r.key }}</router-link></td><td class="r num" :class="tone(r.value)">{{ signedMoney(r.value, cur) }}</td><td class="r num" :class="tone(r.pct)">{{ pct(r.pct, 1) }}</td><td class="r num">{{ r.count }}</td></tr></tbody></table>
        <p v-else class="empty">Sin ventas.</p>
        <router-link class="more" to="/activos">Ver todos los activos</router-link>
      </Panel>
      <Panel title="Rendimiento por cartera">
        <table v-if="portfolios.length" class="dense"><thead><tr><th>Cartera</th><th class="r">Resultado</th><th class="r">Rent.</th><th class="r">Part.</th></tr></thead>
          <tbody><tr v-for="r in portfolios" :key="r.key"><td>{{ r.name }}</td><td class="r num" :class="tone(r.value)">{{ signedMoney(r.value, cur) }}</td><td class="r num" :class="tone(r.pct)">{{ pct(r.pct, 1) }}</td><td class="r num">{{ plainPct(r.part) }}</td></tr></tbody></table>
        <p v-else class="empty">Sin ventas.</p>
      </Panel>
      <Panel title="Drawdown">
        <ChartCanvas v-if="curve.length" :config="ddCfg" :height="150" /><p v-else class="empty">Sin datos.</p>
        <div class="dd-foot"><div><span>Drawdown máximo</span><b class="num loss">{{ money(m.maxDrawdown, cur) }}</b></div><div><span>Duración máxima</span><b class="num">{{ m.ddDuration ? m.ddDuration + ' días' : '—' }}</b></div></div>
      </Panel>
      <Panel :title="'Calendario · ' + mini.label">
        <div class="mini"><i v-for="w in ['L','M','M','J','V','S','D']" :key="w" class="dow">{{ w }}</i>
          <template v-for="(c, i) in mini.cells" :key="i"><i v-if="!c" /><i v-else class="d" :class="c.v == null ? '' : c.v >= 0 ? 'pos' : 'neg'" :title="c.v == null ? '' : signedMoney(c.v, cur)">{{ c.d }}</i></template>
        </div>
        <router-link class="more" to="/calendario">Abrir calendario</router-link>
      </Panel>
    </div>

    <Panel title="Resultado mensual">
      <div class="table-wrap" v-if="matrix.length">
        <table class="dense"><thead><tr><th>Año</th><th v-for="mo in MONTHS" :key="mo" class="r">{{ mo }}</th><th class="r">Total</th></tr></thead>
          <tbody><tr v-for="r in matrix" :key="r.year"><th>{{ r.year }}</th><td v-for="(v, i) in r.months" :key="i" class="r num" :class="tone(v)">{{ v == null ? '' : money(v, cur, 0) }}</td><td class="r num strong" :class="tone(r.total)">{{ money(r.total, cur, 0) }}</td></tr></tbody></table>
      </div>
      <p v-else class="empty">Sin ventas para armar la tabla mensual.</p>
    </Panel>
  </div>
</template>
