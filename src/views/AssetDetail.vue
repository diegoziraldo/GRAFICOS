<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useDesk } from '../composables/useDesk.js'
import { computeMetrics } from '../domain/metrics.js'
import { evValue } from '../domain/engine.js'
import { replay, tradeTotals, holdStats, daysBetween, todayIso } from '../domain/asset.js'
import { money, signedMoney, pct, plainPct, date, num, qty, tone } from '../domain/format.js'
import { C, baseOptions } from '../components/chartTheme.js'
import KpiCard from '../components/KpiCard.vue'
import Panel from '../components/Panel.vue'
import ChartCanvas from '../components/ChartCanvas.vue'

const route = useRoute()
const { ledger, trades, events, openPositions, currencies, portfolioName, filters } = useDesk()
const ticker = computed(() => String(route.params.ticker).toUpperCase())
const scope = ref('all')
watch(ticker, () => (scope.value = 'all'))

const tickerTrades = computed(() => trades.value.filter((t) => t.ticker === ticker.value))
const portfoliosOf = computed(() => [...new Set(tickerTrades.value.map((t) => String(t.portfolioId ?? 'none')))])
const showScope = computed(() => filters.portfolio === 'all' && portfoliosOf.value.length > 1)
const pf = computed(() => (scope.value !== 'all' ? scope.value : filters.portfolio))
const inScope = (x) => pf.value === 'all' || String(x.portfolioId ?? 'none') === pf.value

const myTrades = computed(() => tickerTrades.value.filter(inScope))
const myEvents = computed(() => events.value.filter((e) => e.ticker === ticker.value && inScope(e))) // período global
const allEvents = computed(() => ledger.value.events.filter((e) => e.ticker === ticker.value && inScope(e))) // historial completo
const evById = computed(() => new Map(allEvents.value.map((e) => [e.id, e])))
const myOpen = computed(() => openPositions.value.filter((p) => p.ticker === ticker.value && inScope(p)))
const rows = computed(() => replay(myTrades.value))
const totals = computed(() => tradeTotals(myTrades.value))
const hold = computed(() => holdStats(myEvents.value))
const today = todayIso()
const cur0 = computed(() => currencies.value[0])
const assetType = computed(() => (myTrades.value[0]?.assetType === 'ACCION_AR' ? 'Acción AR' : 'CEDEAR'))

const mets = computed(() => currencies.value.map((cur) => {
  const m = computeMetrics(myEvents.value, cur)
  const total = computeMetrics(events.value, cur).net
  return { cur, m, share: total ? m.net / Math.abs(total) : null }
}))
const openTotal = computed(() => openPositions.value.reduce((a, p) => a + p.invested, 0))
const openRows = computed(() => myOpen.value.map((p) => {
  const last = [...myTrades.value].reverse().find((t) => String(t.portfolioId ?? 'none') === String(p.portfolioId ?? 'none'))
  return { ...p, daysOpen: p.openDate ? daysBetween(p.openDate, today) : null, lastPrice: last?.price ?? null, lastDate: last?.date ?? null,
    vsCost: last ? last.price / p.avgCost - 1 : null, weight: openTotal.value ? p.invested / openTotal.value : null }
}))
const resultOf = (e) => (e ? evValue(e, cur0.value) : null)
const pctOf = (e) => (e ? (cur0.value === 'USD' ? e.plPctUSD : e.plPct) : null)
const sellsList = computed(() => myTrades.value.filter((t) => t.operation === 'VENTA' && evById.value.get(t.id)).map((t) => ({ t, e: evById.value.get(t.id) })))

// ---- Gráfico 1: cada venta como un "palito" desde tu costo hasta el precio de venta
const mainPf = computed(() => {
  const c = new Map()
  for (const t of tickerTrades.value) c.set(String(t.portfolioId ?? 'none'), (c.get(String(t.portfolioId ?? 'none')) || 0) + 1)
  return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'all'
})
watch([ticker, () => trades.value.length], () => { scope.value = showScope.value ? mainPf.value : 'all' }, { immediate: true })
const singlePf = computed(() => portfoliosOf.value.length === 1 || pf.value !== 'all')

const bandPlugin = {
  id: 'posBands',
  beforeDatasetsDraw(chart, _a, opts) {
    const { ctx, chartArea: a, scales: { x } } = chart
    ctx.save(); ctx.fillStyle = 'rgba(77,131,255,.10)'
    for (const b of opts.list || []) {
      const x0 = Math.max(a.left, x.getPixelForValue(b.from)), x1 = Math.min(a.right, x.getPixelForValue(b.to))
      if (x1 > x0) ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top)
    }
    ctx.restore()
  },
}
const labelPlugin = {
  id: 'tradeLabels',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea: a } = chart
    ctx.save(); ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.5
    const placed = [] // evita que dos etiquetas se pisen
    chart.data.datasets.forEach((ds, i) => {
      if (!ds.sellLabels) return
      chart.getDatasetMeta(i).data.forEach((el, j) => {
        const raw = ds.data[j]
        if (!raw?.label) return
        const w = ctx.measureText(raw.label).width
        const cx = Math.min(a.right - w / 2 - 2, Math.max(a.left + w / 2 + 2, el.x))
        const dir = ds.sellLabels === 'up' ? -1 : 1
        let y = dir < 0 ? el.y - raw.r - 6 : el.y + raw.r + 14
        for (let k = 0; k < 6 && placed.some((r) => Math.abs(r.x - cx) < (r.w + w) / 2 + 2 && Math.abs(r.y - y) < 13); k++) y += dir * 13
        y = Math.min(a.bottom - 4, Math.max(a.top + 12, y))
        placed.push({ x: cx, y, w })
        ctx.strokeStyle = '#0b1325'; ctx.strokeText(raw.label, cx, y)
        ctx.fillStyle = ds.labelColor; ctx.fillText(raw.label, cx, y)
      })
    })
    ctx.restore()
  },
}

const priceCfg = computed(() => {
  const list = myTrades.value
  if (!list.length) return null
  const x = (d) => Date.parse(d)
  const maxQ = Math.max(...list.map((t) => t.quantity))
  const rad = (t) => 4.5 + Math.sqrt(t.quantity / maxQ) * 5
  const buys = list.filter((t) => t.operation === 'COMPRA').map((t) => ({ x: x(t.date), y: t.price, t, r: rad(t) }))

  const sellsAll = list.filter((t) => t.operation === 'VENTA' && evById.value.get(t.id)).map((t) => {
    const ev = evById.value.get(t.id), cost = ev.costBasis / ev.qty
    return { t, ev, cost, win: ev.pl > 0.005, label: `${pct(ev.plPct, 1)} · ${ev.days ?? '—'} d` }
  })
  const markers = (arr, up) => arr.map((s) => ({ x: x(s.t.date), y: s.t.price, t: s.t, ev: s.ev, r: rad(s.t), label: s.label, up }))
  const sticks = (arr) => { const d = []; for (const s of arr) d.push({ x: x(s.t.date), y: s.cost }, { x: x(s.t.date), y: s.t.price }, { x: x(s.t.date), y: null }); return d }
  const wins = sellsAll.filter((s) => s.win), losses = sellsAll.filter((s) => !s.win)

  // Costo promedio escalonado + tiempo con posición abierta (solo si es una cartera)
  const cost = [], bands = []
  let anyOpen = false
  if (singlePf.value) {
    let start = null, prevQty = 0
    for (const t of list) {
      const r = rows.value.get(t.id)
      if (t.operation === 'COMPRA') { cost.push({ x: x(t.date), y: r.avgAfter }); if (prevQty === 0) start = x(t.date) }
      else if (r.avgBefore != null) { cost.push({ x: x(t.date), y: r.avgBefore }); if (r.qtyAfter === 0) { cost.push({ x: x(t.date), y: null }); if (start != null) bands.push({ from: start, to: x(t.date) }); start = null } }
      prevQty = r.qtyAfter
    }
    if (prevQty > 0) { anyOpen = true; cost.push({ x: x(today), y: rows.value.get(list[list.length - 1].id).avgAfter }); if (start != null) bands.push({ from: start, to: x(today) }) }
  } else anyOpen = myOpen.value.length > 0
  const first = x(list[0].date), last = Math.max(x(list[list.length - 1].date), anyOpen ? x(today) : 0)
  const pad = Math.max(3, (last - first) / 864e5 * 0.05) * 864e5

  const o = baseOptions('ARS', { interaction: { mode: 'nearest', intersect: true } })
  o.layout = { padding: { top: 14, right: 8 } }
  o.scales.x = { type: 'linear', min: first - pad, max: last + pad, grid: { display: false },
    ticks: { maxTicksLimit: 7, maxRotation: 0, callback: (v) => new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) } }
  o.scales.y = { grace: '10%', ticks: { callback: (v) => money(v, 'ARS', Math.abs(v) < 100 ? 2 : 0) } }
  o.plugins.legend = { display: false }
  o.plugins.posBands = { list: bands }
  o.plugins.tooltip.filter = (i) => i.dataset.tip
  o.plugins.tooltip.callbacks = {
    title: (it) => date(new Date(it[0].parsed.x).toISOString().slice(0, 10)),
    label: (c) => { const { t } = c.raw; return `${t.operation === 'COMPRA' ? 'Compra' : 'Venta'} · ${qty(t.quantity)} u. a ${money(t.price)}` },
    afterLabel: (c) => {
      const { t, ev } = c.raw
      const r = rows.value.get(t.id)
      const out = [`Importe: ${money(t.quantity * t.price)} · Comisión: ${money(t.fee)}`]
      if (ev) {
        out.push(`Costo promedio: ${money(ev.costBasis / ev.qty)}`, `Resultado: ${signedMoney(ev.pl, 'ARS')} (${pct(ev.plPct)})`)
        if (currencies.value.includes('USD')) out.push(`Resultado USD: ${ev.plUSD == null ? 'sin CCL' : signedMoney(ev.plUSD, 'USD') + ' (' + pct(ev.plPctUSD) + ')'}`)
        out.push(`Días en posición: ${ev.days ?? '—'}`)
      }
      if (r) out.push(`Posición después: ${qty(r.qtyAfter)} u.${r.avgAfter ? ' · costo prom. ' + money(r.avgAfter) : ''}`)
      return out
    },
  }
  const line = (label, data, color, extra = {}) => ({ label, data, borderColor: color, pointRadius: 0, pointHitRadius: 0, pointHoverRadius: 0, spanGaps: false, tip: false, ...extra })
  const dots = (label, data, color, style, rot, extra = {}) => ({ label, data, tip: true, showLine: false, backgroundColor: color, borderColor: '#050a14', borderWidth: 1.5,
    pointStyle: style, rotation: rot, pointRadius: (c) => c.raw?.r ?? 5, pointHoverRadius: (c) => (c.raw?.r ?? 5) + 2, ...extra })
  return { type: 'line', plugins: [bandPlugin, labelPlugin], data: { datasets: [
    ...(cost.length ? [line('Costo promedio', cost, C.warn, { borderDash: [6, 4], borderWidth: 2, stepped: 'after' })] : []),
    line('Palito ganancia', sticks(wins), C.gain, { borderWidth: 3 }),
    line('Palito pérdida', sticks(losses), C.loss, { borderWidth: 3 }),
    dots('Compras', buys, C.accent, 'circle', 0),
    dots('Ventas ganadoras', markers(wins, true), C.gain, 'triangle', 180, { sellLabels: 'up', labelColor: C.gain }),
    dots('Ventas perdedoras', markers(losses, false), C.loss, 'triangle', 180, { sellLabels: 'down', labelColor: C.loss }),
  ] }, options: o }
})

// ---- Gráfico 2: resultado de cada venta + acumulado (por moneda)
const salesCfgs = computed(() => currencies.value.map((cur) => {
  const list = sellsList.value.filter((s) => evValue(s.e, cur) != null)
  let acc = 0
  const cum = list.map((s) => (acc += evValue(s.e, cur)))
  const vals = list.map((s) => evValue(s.e, cur))
  const o = baseOptions(cur)
  o.plugins.legend = { display: true, labels: { usePointStyle: true, boxWidth: 8 } }
  o.plugins.tooltip.callbacks = {
    title: (it) => date(list[it[0].dataIndex].t.date),
    label: (c) => ` ${c.dataset.label}: ${signedMoney(c.parsed.y, cur)}`,
    afterBody: (it) => { const s = list[it[0].dataIndex]; const p = cur === 'USD' ? s.e.plPctUSD : s.e.plPct
      return [`Rentabilidad: ${pct(p)}`, `Días en posición: ${s.e.days ?? '—'}`, `${qty(s.e.qty)} u. a ${money(s.e.price)}`] },
  }
  return { cur, n: list.length, cfg: { data: {
    labels: list.map((s) => date(s.t.date).slice(0, 5) + '/' + s.t.date.slice(2, 4)),
    datasets: [
      { type: 'bar', label: 'Resultado de la venta', data: vals, backgroundColor: vals.map((v) => (v >= 0 ? C.gain : C.loss)), borderRadius: 2, order: 2 },
      { type: 'line', label: 'Acumulado del activo', data: cum, borderColor: C.accent, backgroundColor: C.accent, borderWidth: 2, pointRadius: 3, tension: 0, order: 1 },
    ] }, options: o } }
}))

const history = computed(() => [...myTrades.value].reverse().map((t) => {
  const r = rows.value.get(t.id), e = evById.value.get(t.id)
  return { ...t, gross: t.quantity * t.price, qtyAfter: r?.qtyAfter, avgAfter: r?.avgAfter, result: resultOf(e), rpct: pctOf(e), days: e?.days ?? null, ago: daysBetween(t.date, today) }
}))
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`
</script>

<template>
  <div>
    <router-link to="/activos" class="back">← Volver al ranking</router-link>
    <p v-if="!tickerTrades.length" class="empty">No hay operaciones registradas para {{ ticker }}.</p>
    <template v-else>
      <div class="asset-head">
        <h2 class="cur-title">{{ ticker }}</h2>
        <span class="tag buy">{{ assetType }}</span>
        <span v-for="p in portfoliosOf" :key="p" class="tag pf">{{ portfolioName(p === 'none' ? null : Number(p)) }}</span>
        <select v-if="showScope" v-model="scope" aria-label="Cartera del activo">
          <option value="all">Todas las carteras</option>
          <option v-for="p in portfoliosOf" :key="p" :value="p">{{ portfolioName(p === 'none' ? null : Number(p)) }}</option>
        </select>
      </div>
      <p v-if="totals.first" class="note">Primera operación {{ date(totals.first) }} (hace {{ plural(daysBetween(totals.first, today), 'día', 'días') }}) · última {{ date(totals.last) }} (hace {{ plural(daysBetween(totals.last, today), 'día', 'días') }}) · {{ plural(totals.buys.count, 'compra', 'compras') }} y {{ plural(totals.sells.count, 'venta', 'ventas') }}</p>

      <Panel title="Posición actual" note="Cada cartera tiene su propio costo promedio. «Último precio operado» es el de tu última operación, no una cotización de mercado.">
        <div class="table-wrap" v-if="openRows.length">
          <table class="dense"><thead><tr><th>Cartera</th><th class="r">Cantidad</th><th class="r">Costo promedio</th><th class="r">Capital a costo</th><th class="r">Capital USD</th><th class="r">Peso en capital abierto</th><th>Abierta desde</th><th class="r">Días abierta</th><th class="r">Último precio operado</th><th class="r">vs costo prom.</th></tr></thead>
            <tbody><tr v-for="p in openRows" :key="p.key"><td>{{ portfolioName(p.portfolioId) }}</td><td class="r num">{{ qty(p.qty) }}</td><td class="r num">{{ money(p.avgCost) }}</td><td class="r num">{{ money(p.invested) }}</td>
              <td class="r num">{{ p.investedUSD == null ? 'Sin CCL' : money(p.investedUSD, 'USD') }}</td><td class="r num">{{ plainPct(p.weight) }}</td><td>{{ date(p.openDate) }}</td><td class="r num">{{ p.daysOpen ?? '—' }}</td>
              <td class="r num">{{ money(p.lastPrice) }}<small class="sub blk">{{ date(p.lastDate) }}</small></td><td class="r num" :class="tone(p.vsCost)">{{ pct(p.vsCost) }}</td></tr></tbody>
          </table>
        </div>
        <p v-else class="empty">Sin posición abierta: todo lo comprado ya se vendió.</p>
      </Panel>

      <h3 class="sec">Resultado de las ventas <small>(período seleccionado en la barra superior)</small></h3>
      <template v-for="x in mets" :key="x.cur">
        <div class="kpi-grid">
          <KpiCard :label="`Resultado realizado (${x.cur})`" :value="signedMoney(x.m.net, x.cur)" :tone="tone(x.m.net)" help="Suma del resultado neto de las ventas del activo en el período, con comisiones." />
          <KpiCard :label="`Rentabilidad sobre costo (${x.cur})`" :value="pct(x.m.returnPct)" :tone="tone(x.m.returnPct)" help="Resultado ÷ costo de lo vendido en el período." />
          <KpiCard label="Aporte al resultado total" :value="plainPct(x.share)" :sub="`Resultado del activo ÷ |resultado total filtrado| (${x.cur})`" help="Qué parte del resultado total (con los filtros actuales) explica este activo." />
          <KpiCard label="Ventas ganadoras / perdedoras" :value="`${x.m.wins} / ${x.m.losses}`" :sub="`Aciertos: ${plainPct(x.m.winRate)}${x.m.even ? ' · ' + x.m.even + ' neutras' : ''}`" help="Cantidad de ventas con ganancia y con pérdida." />
          <KpiCard label="Ganancia / pérdida promedio" :value="money(x.m.avgWin, x.cur)" :sub="'Pérdida: ' + (x.m.avgLoss == null ? '—' : '−' + money(x.m.avgLoss, x.cur))" tone="gain" help="Promedio de las ventas ganadoras y de las perdedoras." />
          <KpiCard label="Profit factor" :value="num(x.m.profitFactor)" :sub="x.m.profitFactor == null ? 'Requiere una pérdida' : 'Ganancia bruta ÷ pérdida bruta'" help="Mayor a 1: lo ganado supera lo perdido." />
          <KpiCard label="Relación ganancia / pérdida" :value="num(x.m.payoff)" help="Ganancia promedio ÷ pérdida promedio." />
          <KpiCard label="Expectativa por venta" :value="signedMoney(x.m.expectancy, x.cur)" :tone="tone(x.m.expectancy)" help="Resultado neto ÷ cantidad de ventas." />
          <KpiCard label="Mejor / peor venta" :value="signedMoney(x.m.best, x.cur)" :sub="'Peor: ' + signedMoney(x.m.worst, x.cur)" :tone="tone(x.m.best)" help="Resultado individual más alto y más bajo." />
          <KpiCard label="Rachas (ganando / perdiendo)" :value="`${x.m.maxWinStreak} / ${x.m.maxLossStreak}`" help="Máximo de ventas ganadoras y perdedoras consecutivas." />
        </div>
      </template>

      <h3 class="sec">Actividad e historial del activo <small>(todas las operaciones, en ARS)</small></h3>
      <div class="kpi-grid">
        <KpiCard label="Total comprado" :value="money(totals.buys.gross)" :sub="`${qty(totals.buys.qty)} u. en ${plural(totals.buys.count, 'compra', 'compras')}`" />
        <KpiCard label="Total vendido" :value="money(totals.sells.gross)" :sub="`${qty(totals.sells.qty)} u. en ${plural(totals.sells.count, 'venta', 'ventas')}`" />
        <KpiCard label="Precio promedio de compra" :value="money(totals.buys.avg)" help="Importe comprado ÷ unidades compradas (sin comisiones)." />
        <KpiCard label="Precio promedio de venta" :value="money(totals.sells.avg)" :sub="totals.buys.avg && totals.sells.avg ? 'vs compra: ' + pct(totals.sells.avg / totals.buys.avg - 1) : ''" :tone="tone(totals.sells.avg && totals.buys.avg ? totals.sells.avg - totals.buys.avg : null)" help="Importe vendido ÷ unidades vendidas. Compara promedios simples: el resultado real usa el costo promedio de cada momento." />
        <KpiCard label="Comisiones acumuladas" :value="money(totals.fees)" :sub="totals.feePct != null ? plainPct(totals.feePct) + ' de lo operado' : ''" help="Comisiones de compras y ventas de este activo (campo fee de cada operación)." />
        <KpiCard label="Tenencia promedio" :value="hold ? num(hold.avg, 1) + ' días' : '—'" :sub="hold ? `Mediana ${num(hold.median, 1)} · mín ${hold.min} · máx ${hold.max}` : 'Sin ventas en el período'" help="Días desde que se abrió la posición hasta cada venta (promedio simple)." />
      </div>

      <Panel title="Compras y ventas sobre el precio" note="Cómo leerlo: cada palito vertical une tu costo promedio con el precio al que vendiste. Verde hacia arriba = ganaste, rojo hacia abajo = perdiste. El texto indica la rentabilidad neta y los días que tuviste la posición. Precios en ARS.">
        <ul class="chart-legend">
          <li><i class="lg-dot" /> Compra <small>(tamaño = cantidad)</small></li>
          <li><i class="lg-tri win" /> Venta con ganancia</li>
          <li><i class="lg-tri loss" /> Venta con pérdida</li>
          <li v-if="singlePf"><i class="lg-dash" /> Costo promedio</li>
          <li v-if="singlePf"><i class="lg-band" /> Posición abierta</li>
        </ul>
        <ChartCanvas v-if="priceCfg" :config="priceCfg" :height="360" />
        <p v-if="!singlePf" class="note">Elegí una cartera en el selector de arriba para ver también la línea de costo promedio y el tiempo con posición abierta.</p>
      </Panel>

      <div class="grid-2">
        <Panel v-for="s in salesCfgs" :key="s.cur" :title="`Resultado de cada venta (${s.cur})`" note="Las barras son cada venta; la línea azul es el resultado acumulado del activo en el historial completo.">
          <ChartCanvas v-if="s.n" :config="s.cfg" :height="260" /><p v-else class="empty">Sin ventas con resultado calculable.</p>
        </Panel>
      </div>

      <Panel :title="`Historial de movimientos (${myTrades.length})`" :note="`Resultado y rentabilidad en ${cur0}. «Días en posición» cuenta desde que se abrió la posición hasta la venta.`">
        <div class="table-wrap"><table class="dense">
          <thead><tr><th>Fecha</th><th class="r">Hace (días)</th><th>Cartera</th><th>Operación</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Importe</th><th class="r">Comisión</th><th class="r">CCL</th><th class="r">Posición después</th><th class="r">Costo prom. después</th><th class="r">Resultado</th><th class="r">Rent.</th><th class="r">Días en posición</th></tr></thead>
          <tbody><tr v-for="t in history" :key="t.id">
            <td>{{ date(t.date) }}</td><td class="r num">{{ t.ago }}</td><td>{{ portfolioName(t.portfolioId) }}</td>
            <td><span class="tag" :class="t.operation === 'VENTA' ? 'sell' : 'buy'">{{ t.operation === 'VENTA' ? 'Venta' : 'Compra' }}</span></td>
            <td class="r num">{{ qty(t.quantity) }}</td><td class="r num">{{ money(t.price) }}</td><td class="r num">{{ money(t.gross) }}</td><td class="r num">{{ money(t.fee) }}</td><td class="r num">{{ t.ccl ? num(t.ccl) : '—' }}</td>
            <td class="r num">{{ qty(t.qtyAfter) }}</td><td class="r num">{{ t.avgAfter ? money(t.avgAfter) : '—' }}</td>
            <td class="r num" :class="tone(t.result)">{{ t.operation === 'VENTA' ? signedMoney(t.result, cur0) : '' }}</td><td class="r num" :class="tone(t.rpct)">{{ t.operation === 'VENTA' ? pct(t.rpct) : '' }}</td><td class="r num">{{ t.days ?? '' }}</td>
          </tr></tbody></table></div>
      </Panel>
    </template>
  </div>
</template>
