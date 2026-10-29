<script setup>
import { reactive, computed } from 'vue'
import { useDesk } from '../composables/useDesk.js'
import { PRESETS, resolvePeriod, inRange } from '../domain/periods.js'
import { computeMetrics } from '../domain/metrics.js'
import { money, signedMoney, pct, plainPct, num, tone } from '../domain/format.js'
import Panel from '../components/Panel.vue'

const { ledger, filters, currencies } = useDesk()
const A = reactive({ preset: 'prevMonth', from: '', to: '' })
const B = reactive({ preset: 'thisMonth', from: '', to: '' })
const presets = PRESETS.filter((p) => p.id !== 'all')

// Compara solo períodos (la cartera/instrumento del filtro global sí se respetan).
const calc = (s, cur) => {
  const r = resolvePeriod(s.preset, s)
  const evs = ledger.value.events.filter((e) =>
    inRange(e.date, r) &&
    (filters.portfolio === 'all' || String(e.portfolioId ?? 'none') === filters.portfolio) &&
    (filters.assetType === 'all' || e.assetType === filters.assetType))
  return computeMetrics(evs, cur)
}
const ROWS = [
  ['Resultado neto', 'net', 'money'], ['Rentabilidad sobre costo', 'returnPct', 'pct'], ['Ventas', 'count', 'int'],
  ['Win rate', 'winRate', 'plain'], ['Profit factor', 'profitFactor', 'num'], ['Expectativa por operación', 'expectancy', 'money'],
]
const fmt = (v, kind, cur) => (kind === 'money' ? signedMoney(v, cur) : kind === 'pct' ? pct(v) : kind === 'plain' ? plainPct(v) : kind === 'int' ? String(v) : num(v))
const tables = computed(() => currencies.value.map((cur) => {
  const a = calc(A, cur), b = calc(B, cur)
  return { cur, rows: ROWS.map(([label, k, kind]) => {
    const abs = a[k] != null && b[k] != null ? b[k] - a[k] : null
    // La variación % solo es válida si el período base no es cero y ambos tienen el mismo signo.
    const valid = a[k] && b[k] != null && Math.sign(a[k]) === Math.sign(b[k]) && ['money', 'int', 'num'].includes(kind)
    return { label, a: fmt(a[k], kind, cur), b: fmt(b[k], kind, cur), abs, absTxt: abs == null ? '—' : kind === 'money' ? signedMoney(abs, cur) : kind === 'int' || kind === 'num' ? (abs > 0 ? '+' : '') + num(abs) : (abs > 0 ? '+' : '') + (abs * 100).toFixed(1) + ' pp', rel: valid ? (b[k] - a[k]) / Math.abs(a[k]) : null }
  }) }
}))
</script>

<template>
  <Panel title="Comparación entre períodos" note="La variación porcentual solo se muestra cuando el período base no es cero y ambos resultados tienen el mismo signo; si no, el porcentaje no tiene sentido matemático. Para tasas (win rate, rentabilidad) se informa la diferencia en puntos porcentuales.">
    <div class="compare-pick">
      <fieldset><legend>Período A (base)</legend>
        <select v-model="A.preset"><option v-for="p in presets" :key="p.id" :value="p.id">{{ p.label }}</option></select>
        <template v-if="A.preset === 'custom'"><input type="date" v-model="A.from" /><input type="date" v-model="A.to" /></template>
      </fieldset>
      <fieldset><legend>Período B</legend>
        <select v-model="B.preset"><option v-for="p in presets" :key="p.id" :value="p.id">{{ p.label }}</option></select>
        <template v-if="B.preset === 'custom'"><input type="date" v-model="B.from" /><input type="date" v-model="B.to" /></template>
      </fieldset>
    </div>
    <div v-for="t in tables" :key="t.cur" class="table-wrap">
      <h4>{{ t.cur }}</h4>
      <table class="dense"><thead><tr><th>Indicador</th><th class="r">A</th><th class="r">B</th><th class="r">Diferencia</th><th class="r">Variación %</th></tr></thead>
        <tbody><tr v-for="r in t.rows" :key="r.label"><td>{{ r.label }}</td><td class="r num">{{ r.a }}</td><td class="r num">{{ r.b }}</td><td class="r num" :class="tone(r.abs)">{{ r.absTxt }}</td><td class="r num">{{ r.rel == null ? 'n/d' : pct(r.rel) }}</td></tr></tbody></table>
    </div>
  </Panel>
</template>
