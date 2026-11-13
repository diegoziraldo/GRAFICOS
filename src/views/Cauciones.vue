<script setup>
import { ref, computed } from 'vue'
import { useDesk } from '../composables/useDesk.js'
import { caucionMetrics, groupCauciones, cumulativeRealized, statusOf } from '../domain/cauciones.js'
import { daysBetween } from '../domain/asset.js'
import { iso } from '../domain/periods.js'
import { money, signedMoney, plainPct, num, date, tone } from '../domain/format.js'
import { C, baseOptions } from '../components/chartTheme.js'
import KpiCard from '../components/KpiCard.vue'
import Panel from '../components/Panel.vue'
import ChartCanvas from '../components/ChartCanvas.vue'

const { cauciones, caucionesError, caucionesFor, currencies } = useDesk()
const today = iso(new Date())
const group = ref('month')
const GROUPS = [['day', 'Día'], ['week', 'Sem.'], ['month', 'Mes'], ['quarter', 'Trim.'], ['year', 'Año']]
const brokerSel = ref('all'), statusSel = ref('all'), sortKey = ref('endDate'), dir = ref(-1)
const shown = ref(25)
const brokers = computed(() => [...new Set(cauciones.value.map((c) => c.broker))].sort())
const sortBy = (k) => { dir.value = sortKey.value === k ? -dir.value : -1; sortKey.value = k }
const pctTxt = (v) => (v == null ? '—' : num(v, 2) + '%')
const STATUS_TXT = { ACTIVA: 'Activa', FINALIZADA: 'Finalizada', VENCIDA: 'Vencida sin finalizar' }

const blocks = computed(() => currencies.value.map((cur) => {
  const total = cauciones.value.filter((c) => c.currency === cur).length
  const list = caucionesFor(cur)
  const m = caucionMetrics(list, today)

  const grouped = groupCauciones(list, group.value)
  const bo = baseOptions(cur)
  bo.scales.x.stacked = true; bo.scales.y.stacked = true
  bo.plugins.legend = { display: true, labels: { usePointStyle: true, boxWidth: 8 } }
  bo.plugins.tooltip.callbacks.label = (c) => ` ${c.dataset.label}: ${money(c.parsed.y, cur)}`
  const bars = { type: 'bar', data: { labels: grouped.map((g) => g.key), datasets: [
    { label: 'Cobrada', data: grouped.map((g) => g.realized), backgroundColor: C.gain, borderRadius: 2 },
    { label: 'Proyectada (activas)', data: grouped.map((g) => g.projected), backgroundColor: C.accent, borderRadius: 2 },
  ] }, options: bo }

  const cum = cumulativeRealized(list)
  const area = (ctx) => { const a = ctx.chart.chartArea; if (!a) return 'transparent'; const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, 'rgba(53,224,160,.30)'); g.addColorStop(1, 'rgba(53,224,160,0)'); return g }
  const line = { type: 'line', data: { labels: cum.map((p) => p.date), datasets: [{ label: 'Ganancia neta cobrada acumulada', data: cum.map((p) => p.value), borderColor: C.gain, backgroundColor: area, fill: 'origin', stepped: true, pointRadius: cum.length > 60 ? 0 : 2, borderWidth: 2 }] }, options: baseOptions(cur) }

  const sorted = [...list].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.id - b.id))
  const to = baseOptions(cur)
  to.scales.y = { ticks: { callback: (v) => v + '%' } }
  to.plugins.legend = { display: true, labels: { usePointStyle: true, boxWidth: 8 } }
  to.plugins.tooltip.callbacks.label = (c) => ` ${c.dataset.label}: ${num(c.parsed.y, 2)}%`
  const rates = { type: 'line', data: { labels: sorted.map((c) => date(c.startDate).slice(0, 5)), datasets: [
    { label: 'TNA bruta pactada', data: sorted.map((c) => c.tna), borderColor: C.accent, backgroundColor: C.accent, borderWidth: 2, pointRadius: sorted.length > 60 ? 0 : 3, tension: 0 },
    { label: 'TNA neta (después de comisión)', data: sorted.map((c) => c.netTNA), borderColor: C.warn, backgroundColor: C.warn, borderWidth: 2, pointRadius: sorted.length > 60 ? 0 : 3, tension: 0 },
  ] }, options: to }

  const rows = list.filter((c) => (brokerSel.value === 'all' || c.broker === brokerSel.value) && (statusSel.value === 'all' || statusOf(c, today) === statusSel.value))
    .map((c) => ({ ...c, st: statusOf(c, today) }))
    .sort((a, b) => { const x = a[sortKey.value], y = b[sortKey.value]; return (x < y ? -1 : x > y ? 1 : 0) * dir.value })
  return { cur, total, list, m, bars, line, rates, grouped, cum, rows }
}))

const COLS = [['startDate', 'Inicio'], ['endDate', 'Vence'], ['termDays', 'Plazo'], ['amount', 'Monto'], ['tna', 'TNA'], ['broker', 'Broker'], ['grossInterest', 'Interés bruto'], ['brokerFee', 'Comisión'], ['netGain', 'Ganancia neta'], ['netTNA', 'TNA neta'], ['totalToReceive', 'Total a cobrar'], ['st', 'Estado']]
const LEFT = ['startDate', 'endDate', 'broker', 'st']
</script>

<template>
  <div>
    <p class="note pad">Una caución genera interés al <b>vencimiento</b>: por eso el período de la barra superior se aplica por <b>fecha de vencimiento</b>. Cartera e instrumento no aplican a cauciones. Las cauciones en ARS y en USD se muestran por separado: no se convierten entre sí.</p>
    <p v-if="caucionesError" class="warn">No se pudieron cargar las cauciones ({{ caucionesError }}).</p>
    <p v-else-if="!cauciones.length" class="empty">No hay cauciones cargadas en tu base.</p>

    <template v-for="b in blocks" :key="b.cur">
      <template v-if="cauciones.length">
        <h2 class="cur-title">Cauciones en {{ b.cur }}<small>Ganancia neta = interés bruto − comisión del broker · interés simple, base 365 días</small></h2>
        <p v-if="!b.total" class="empty">No tenés cauciones colocadas en {{ b.cur }}.</p>
        <p v-else-if="!b.list.length" class="empty">No hay cauciones en {{ b.cur }} que venzan en el período seleccionado.</p>
        <template v-else>
          <p v-if="b.m.overdueCount" class="warn">{{ b.m.overdueCount }} caución(es) figuran como activas pero ya vencieron. Marcalas como finalizadas en tu bitácora: hasta entonces se cuentan como proyectadas, no como cobradas.</p>
          <div class="kpi-grid">
            <KpiCard :label="`Capital colocado hoy`" :value="money(b.m.capitalActive, b.cur)" :sub="`${b.m.activeCount} activa(s)`" help="Suma del monto de las cauciones con estado Activa (incluye las vencidas aún sin finalizar)." />
            <KpiCard label="Ganancia neta cobrada" :value="signedMoney(b.m.realized, b.cur)" :tone="tone(b.m.realized)" :sub="`${b.m.doneCount} finalizada(s)`" help="Ganancia neta (después de comisión) de las cauciones Finalizadas que vencen en el período." />
            <KpiCard label="Ganancia neta proyectada" :value="signedMoney(b.m.projected, b.cur)" :tone="tone(b.m.projected)" help="Ganancia neta que van a dejar las cauciones Activas del período, si se cumplen las condiciones pactadas." />
            <KpiCard label="Ganancia neta total" :value="signedMoney(b.m.net, b.cur)" :tone="tone(b.m.net)" help="Cobrada + proyectada." />
            <KpiCard label="Interés bruto" :value="money(b.m.gross, b.cur)" help="Monto × TNA × días/365, antes de comisiones." />
            <KpiCard label="Comisiones del broker" :value="money(b.m.fees, b.cur)" :sub="b.m.feeShare != null ? plainPct(b.m.feeShare) + ' del interés bruto' : ''" help="Comisión fija o porcentual sobre el interés bruto, según lo cargado en cada caución." />
            <KpiCard label="TNA bruta promedio" :value="pctTxt(b.m.tnaGross)" help="Promedio ponderado por monto × días colocado (capital-días)." />
            <KpiCard label="TNA neta promedio" :value="pctTxt(b.m.tnaNet)" :tone="tone(b.m.tnaNet)" help="Ganancia neta total ÷ capital-días × 365. Es la tasa que realmente te quedó después de la comisión." />
            <KpiCard label="Cauciones del período" :value="String(b.m.count)" :sub="`Plazo prom. ${num(b.m.avgTerm, 1)} d · monto prom. ${money(b.m.avgAmount, b.cur, 0)}`" />
            <KpiCard label="Mejor / peor TNA neta" :value="pctTxt(b.m.bestNetTNA)" :sub="'Peor: ' + pctTxt(b.m.worstNetTNA)" help="TNA neta más alta y más baja entre las cauciones del período." />
            <KpiCard label="Próximo vencimiento" :value="b.m.next ? date(b.m.next.endDate) : '—'" :sub="b.m.next ? `en ${daysBetween(today, b.m.next.endDate)} día(s) · ${money(b.m.next.totalToReceive, b.cur)} a cobrar` : 'Sin cauciones activas por vencer'" help="Caución activa con el vencimiento más cercano (hoy o después)." />
          </div>

          <div class="grid-2">
            <Panel title="Ganancia neta por período">
              <template #actions><button v-for="g in GROUPS" :key="g[0]" class="chip" :class="{ on: group === g[0] }" @click="group = g[0]">{{ g[1] }}</button></template>
              <ChartCanvas :config="b.bars" :height="260" />
            </Panel>
            <Panel title="Ganancia neta cobrada acumulada" note="Por fecha de vencimiento, solo cauciones finalizadas.">
              <ChartCanvas v-if="b.cum.length" :config="b.line" :height="260" /><p v-else class="empty">Todavía no hay cauciones finalizadas en el período.</p>
            </Panel>
          </div>
          <Panel title="TNA pactada vs. TNA neta" note="La distancia entre las dos líneas es lo que se lleva la comisión. Las comisiones fijas pesan mucho más en cauciones chicas y de pocos días.">
            <ChartCanvas :config="b.rates" :height="260" />
          </Panel>

          <Panel :title="`Detalle de cauciones (${b.rows.length})`">
            <template #actions>
              <select v-model="brokerSel" aria-label="Broker"><option value="all">Todos los brokers</option><option v-for="x in brokers" :key="x" :value="x">{{ x }}</option></select>
              <select v-model="statusSel" aria-label="Estado"><option value="all">Todos los estados</option><option value="FINALIZADA">Finalizadas</option><option value="ACTIVA">Activas</option><option value="VENCIDA">Vencidas sin finalizar</option></select>
            </template>
            <div class="table-wrap" v-if="b.rows.length">
              <table class="dense sortable">
                <thead><tr><th v-for="c in COLS" :key="c[0]" :class="{ r: !LEFT.includes(c[0]) }" @click="sortBy(c[0])">{{ c[1] }}<i v-if="sortKey === c[0]">{{ dir > 0 ? ' ▲' : ' ▼' }}</i></th><th>Notas</th></tr></thead>
                <tbody>
                  <tr v-for="r in b.rows.slice(0, shown)" :key="r.id">
                    <td>{{ date(r.startDate) }}</td><td>{{ date(r.endDate) }}</td><td class="r num">{{ r.termDays }} d</td>
                    <td class="r num">{{ money(r.amount, b.cur) }}</td><td class="r num">{{ num(r.tna, 2) }}%</td><td>{{ r.broker }}</td>
                    <td class="r num">{{ money(r.grossInterest, b.cur) }}</td><td class="r num">{{ money(r.brokerFee, b.cur) }}<small class="sub blk">{{ r.feeType === 'PERCENT' ? num(r.feeValue, 2) + '%' : 'fija' }}</small></td>
                    <td class="r num strong" :class="tone(r.netGain)">{{ signedMoney(r.netGain, b.cur) }}</td><td class="r num">{{ num(r.netTNA, 2) }}%</td>
                    <td class="r num">{{ money(r.totalToReceive, b.cur) }}</td>
                    <td><span class="tag" :class="r.st === 'FINALIZADA' ? 'done' : r.st === 'VENCIDA' ? 'sell' : 'buy'">{{ STATUS_TXT[r.st] }}</span></td>
                    <td class="notes" :title="r.notes">{{ r.notes }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="empty">Ninguna caución coincide con los filtros.</p>
            <div class="pager" v-if="b.rows.length > shown"><button class="ghost" @click="shown += 25">Ver más ({{ b.rows.length - shown }} restantes)</button></div>
          </Panel>
        </template>
      </template>
    </template>
  </div>
</template>
