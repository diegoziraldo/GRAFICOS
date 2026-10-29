<script setup>
import { computed } from 'vue'
import { useDesk } from '../composables/useDesk.js'
import { histogram, byField, weekdayOf, WEEKDAYS } from '../domain/metrics.js'
import { evValue } from '../domain/engine.js'
import { money, signedMoney, num, plainPct, tone } from '../domain/format.js'
import { DEF } from '../domain/definitions.js'
import { C, baseOptions, signColors } from '../components/chartTheme.js'
import Panel from '../components/Panel.vue'
import ChartCanvas from '../components/ChartCanvas.vue'

const { events, currencies, metricsFor } = useDesk()
const blocks = computed(() => currencies.value.map((cur) => {
  const m = metricsFor(cur)
  const vals = events.value.map((e) => evValue(e, cur)).filter((v) => v != null)
  const h = histogram(vals, 12)
  const hOpts = baseOptions(cur)
  hOpts.scales.y = { ticks: { precision: 0 } }
  hOpts.plugins.tooltip.callbacks.label = (c) => ` ${c.parsed.y} operaciones`
  const hist = { type: 'bar', data: { labels: h.map((b) => `${money(b.from, cur, 0)}`), datasets: [{ data: h.map((b) => b.count), backgroundColor: h.map((b) => ((b.from + b.to) / 2 >= 0 ? C.gain : C.loss)) }] }, options: hOpts }
  const wd = byField(events.value, cur, (e) => weekdayOf(e.date))
  const wdv = WEEKDAYS.map((_, i) => wd.find((x) => x.key === i)?.value ?? 0)
  const wdCfg = { type: 'bar', data: { labels: WEEKDAYS, datasets: [{ data: wdv, backgroundColor: signColors(wdv) }] }, options: baseOptions(cur) }
  const days = events.value.map((e) => e.days).filter((d) => d != null)
  const dh = histogram(days, Math.min(10, Math.max(1, new Set(days).size)))
  const dOpts = baseOptions(cur)
  dOpts.scales.y = { ticks: { precision: 0 } }
  dOpts.scales.x.ticks.callback = undefined
  dOpts.plugins.tooltip.callbacks.label = (c) => ` ${c.parsed.y} operaciones`
  const durCfg = { type: 'bar', data: { labels: dh.map((b) => `${Math.round(b.from)}–${Math.round(b.to)} d`), datasets: [{ data: dh.map((b) => b.count), backgroundColor: C.accent }] }, options: dOpts }
  return { cur, m, hasData: vals.length > 0, hist, wdCfg, durCfg, hasDays: days.length > 0 }
}))
</script>

<template>
  <div>
    <p class="note pad">Estas métricas se calculan sobre <b>ventas cerradas</b>, no sobre una curva de patrimonio. No se muestran ratios ajustados por riesgo (Sharpe, Sortino): requieren una serie diaria de valor de cartera que el backend no guarda.</p>
    <template v-for="b in blocks" :key="b.cur">
      <h2 class="cur-title">Estadísticas en {{ b.cur }}</h2>
      <Panel title="Métricas de trading">
        <dl class="defs">
          <div><dt>Win rate</dt><dd class="num">{{ plainPct(b.m.winRate) }}<small>{{ DEF.winRate }}</small></dd></div>
          <div><dt>Profit factor</dt><dd class="num">{{ num(b.m.profitFactor) }}<small>{{ DEF.profitFactor }}</small></dd></div>
          <div><dt>Expectativa por operación</dt><dd class="num" :class="tone(b.m.expectancy)">{{ signedMoney(b.m.expectancy, b.cur) }}<small>{{ DEF.expectancy }}</small></dd></div>
          <div><dt>Ganancia media / pérdida media</dt><dd class="num">{{ money(b.m.avgWin, b.cur) }} / {{ b.m.avgLoss == null ? '—' : money(b.m.avgLoss, b.cur) }}<small>Relación: {{ num(b.m.payoff) }}. {{ DEF.payoff }}</small></dd></div>
          <div><dt>Máximo drawdown</dt><dd class="num loss">{{ money(b.m.maxDrawdown, b.cur) }}<small>{{ DEF.maxDD }}</small></dd></div>
          <div><dt>Racha de ganancias / pérdidas</dt><dd class="num">{{ b.m.maxWinStreak }} / {{ b.m.maxLossStreak }}<small>{{ DEF.streakW }} {{ DEF.streakL }}</small></dd></div>
        </dl>
      </Panel>
      <div class="grid-2">
        <Panel title="Distribución de resultados por operación" note="Eje X: resultado (inicio de cada rango). Eje Y: cantidad de ventas.">
          <ChartCanvas v-if="b.hasData" :config="b.hist" /><p v-else class="empty">Sin ventas en el período.</p>
        </Panel>
        <Panel title="Resultado por día de la semana" note="Según fecha de venta.">
          <ChartCanvas v-if="b.hasData" :config="b.wdCfg" /><p v-else class="empty">Sin ventas en el período.</p>
        </Panel>
      </div>
      <Panel title="Duración de las operaciones" note="Días desde la apertura de la posición (primera compra tras estar en cero) hasta cada venta.">
        <ChartCanvas v-if="b.hasDays" :config="b.durCfg" :height="220" /><p v-else class="empty">Sin ventas en el período.</p>
      </Panel>
    </template>
  </div>
</template>
