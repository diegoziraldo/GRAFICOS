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

// ---- Gráfico 1: precio operado, costo promedio y operaciones sobre el eje del tiempo real
const priceCfg = computed(() => {
  const list = myTrades.value
  if (!list.length) return null
  const x = (d) => Date.parse(d)
  const maxQ = Math.max(...list.map((t) => t.quantity))
  const radius = (t) => 4 + Math.sqrt(t.quantity / maxQ) * 7
  const mk = (t) => ({ x: x(t.date), y: t.price, t, r: radius(t), ev: evById.value.get(t.id) })
  const buys = list.filter((t) => t.operation === 'COMPRA').map(mk)
  const sells = list.filter((t) => t.operation === 'VENTA').map(mk)
  const win = sells.filter((s) => s.ev && s.ev.pl > 0.005), loss = sells.filter((s) => s.ev && s.ev.pl <= 0.005), other = sells.filter((s) => !s.ev)

  // Una línea de costo promedio por cartera (cada cartera tiene su propio costo).
  const groups = new Map()
  for (const t of list) { const k = String(t.portfolioId ?? 'none'); groups.set(k, [...(groups.get(k) || []), t]) }
  const COLORS = [C.warn, '#c792ea', '#5ad1e6', '#ff9f68', '#9be15d']
  let anyOpen = false
  const costSets = [...groups].map(([k, ts], i) => {
    const pts = []
    for (const t of ts) {
      const r = rows.value.get(t.id)
      if (t.operation === 'COMPRA') pts.push({ x: x(t.date), y: r.avgAfter })
      else if (r.avgBefore != null) { pts.push({ x: x(t.date), y: r.avgBefore }); if (r.qtyAfter === 0) pts.push({ x: x(t.date), y: null }) }
    }
    if (rows.value.get(ts[ts.length - 1].id).qtyAfter > 0) { pts.push({ x: x(today), y: rows.value.get(ts[ts.length - 1].id).avgAfter }); anyOpen = true }
    const label = groups.size > 1 ? `Costo prom. · ${portfolioName(k === 'none' ? null : Number(k))}` : 'Costo promedio'
    return { label, data: pts, borderColor: COLORS[i % COLORS.length], borderDash: [6, 4], borderWidth: 2, stepped: 'after', pointRadius: 0, pointHitRadius: 0, pointHoverRadius: 0, spanGaps: false, tip: false }
  })
  const first = x(list[0].date), last = Math.max(x(list[list.length - 1].date), anyOpen ? x(today) : 0)
  const pad = Math.max(2, (last - first) / 864e5 * 0.04) * 864e5

  const o = baseOptions('ARS', { interaction: { mode: 'nearest', intersect: true } })
  o.scales.x = { type: 'linear', min: first - pad, max: last + pad, grid: { display: false },
    ticks: { maxTicksLimit: 7, maxRotation: 0, callback: (v) => new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) } }
  o.scales.y = { ticks: { callback: (v) => money(v, 'ARS', Math.abs(v) < 100 ? 2 : 0) } }
  o.plugins.legend = { display: true, labels: { usePointStyle: true, boxWidth: 8, filter: (i) => !i.text.startsWith('_') } }
  o.plugins.tooltip.filter = (i) => i.dataset.tip
  o.plugins.tooltip.callbacks = {
    title: (it) => date(new Date(it[0].parsed.x).toISOString().slice(0, 10)),
    label: (c) => {
      const { t, ev } = c.raw
      const head = `${t.operation === 'COMPRA' ? 'Compra' : 'Venta'} · ${qty(t.quantity)} u. a ${money(t.price)}`
      return head
    },
    afterLabel: (c) => {
      const { t, ev } = c.raw
      const r = rows.value.get(t.id)
      const out = [`Importe: ${money(t.quantity * t.price)} · Comisión: ${money(t.fee)}`]
      if (ev) out.push(`Resultado: ${signedMoney(resultOf(ev), cur0.value)} (${pct(pctOf(ev))})`, `Días en posición: ${ev.days ?? '—'}`)
      if (r) out.push(`Posición después: ${qty(r.qtyAfter)} u.${r.avgAfter ? ' · costo prom. ' + money(r.avgAfter) : ''}`)
      return out
    },
  }
  const pts = (label, data, color, style, rot) => ({ label, data, tip: true, showLine: false, backgroundColor: color, borderColor: '#050a14', borderWidth: 1.5,
    pointStyle: style, rotation: rot, pointRadius: (c) => c.raw?.r ?? 5, pointHoverRadius: (c) => (c.raw?.r ?? 5) + 2 })
  return { type: 'line', data: { datasets: [
    { label: '_precio', data: list.map((t) => ({ x: x(t.date), y: t.price })), borderColor: 'rgba(169,184,214,.45)', borderWidth: 1.5, pointRadius: 0, pointHitRadius: 0, pointHoverRadius: 0, tip: false },
    ...costSets,
    pts('Compras', buys, C.accent, 'triangle', 0),
    pts('Ventas ganadoras', win, C.gain, 'triangle', 180),
    pts('Ventas perdedoras', loss, C.loss, 'triangle', 180),
    ...(other.length ? [pts('Ventas sin costo', other, '#8ea0c0', 'rectRot', 0)] : []),
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

      <Panel title="Compras y ventas sobre el precio" note="Eje horizontal con fechas reales. Triángulo azul = compra · triángulo hacia abajo verde/rojo = venta con ganancia/pérdida · el tamaño indica la cantidad. Las líneas escalonadas punteadas son tu costo promedio (una por cartera): una venta por encima de la línea gana. Pasá el mouse por cada marca para ver el detalle.">
        <ChartCanvas v-if="priceCfg" :config="priceCfg" :height="340" />
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
