<script setup>
import { ref, computed, watchEffect } from 'vue'
import { useDesk } from '../composables/useDesk.js'
import { evValue } from '../domain/engine.js'
import { money, signedMoney, pct, date, tone, qty } from '../domain/format.js'
import Panel from '../components/Panel.vue'

const { events, currencies, filters } = useDesk()
const cur = computed(() => currencies.value[0])
const now = new Date()
const ym = ref({ y: now.getFullYear(), m: now.getMonth() })
const selected = ref('')

// Al abrir, salta al mes de la última venta para no mostrar un mes vacío.
const jumped = ref(false)
watchEffect(() => {
  if (jumped.value || !events.value.length) return
  const last = events.value[events.value.length - 1].date
  ym.value = { y: +last.slice(0, 4), m: +last.slice(5, 7) - 1 }
  jumped.value = true
})

const byDay = computed(() => {
  const m = new Map()
  for (const e of events.value) {
    const v = evValue(e, cur.value)
    if (v == null) continue
    const d = m.get(e.date) || { value: 0, list: [] }
    d.value += v; d.list.push(e); m.set(e.date, d)
  }
  return m
})
const label = computed(() => new Date(ym.value.y, ym.value.m, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }))
const cells = computed(() => {
  const { y, m } = ym.value
  const lead = (new Date(y, m, 1).getDay() + 6) % 7
  const days = new Date(y, m + 1, 0).getDate()
  const out = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    out.push({ d, key, info: byDay.value.get(key) })
  }
  return out
})
const monthTotal = computed(() => cells.value.reduce((a, c) => a + (c?.info?.value || 0), 0))
const move = (n) => { const d = new Date(ym.value.y, ym.value.m + n, 1); ym.value = { y: d.getFullYear(), m: d.getMonth() }; selected.value = '' }
const detail = computed(() => byDay.value.get(selected.value)?.list || [])
</script>

<template>
  <Panel :title="`Calendario de resultados (${cur})`" note="Cada día suma las ventas de esa fecha. Respeta cartera e instrumento; el calendario navega por mes más allá del período elegido.">
    <div class="cal-head">
      <button class="ghost" @click="move(-1)">Mes anterior</button>
      <b class="cal-title">{{ label }}</b>
      <button class="ghost" @click="move(1)">Mes siguiente</button>
      <span class="num" :class="tone(monthTotal)">{{ signedMoney(monthTotal, cur) }}</span>
    </div>
    <div class="cal">
      <div v-for="w in ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']" :key="w" class="cal-dow">{{ w }}</div>
      <template v-for="(c, i) in cells" :key="i">
        <div v-if="!c" class="cal-cell blank" />
        <button v-else class="cal-cell" :class="[c.info ? (c.info.value >= 0 ? 'pos' : 'neg') : '', { sel: selected === c.key }]" :disabled="!c.info" @click="selected = c.key">
          <span class="d">{{ c.d }}</span><span v-if="c.info" class="v num">{{ money(c.info.value, cur, 0) }}</span>
        </button>
      </template>
    </div>
  </Panel>
  <Panel v-if="selected" :title="`Operaciones del ${date(selected)}`">
    <table class="dense"><thead><tr><th>Ticker</th><th class="r">Cantidad</th><th class="r">Precio venta</th><th class="r">Resultado</th><th class="r">Rent.</th></tr></thead>
      <tbody><tr v-for="e in detail" :key="e.id">
        <td><router-link :to="`/activos/${e.ticker}`">{{ e.ticker }}</router-link></td><td class="r num">{{ qty(e.qty) }}</td><td class="r num">{{ money(e.price) }}</td>
        <td class="r num" :class="tone(evValue(e, cur))">{{ signedMoney(evValue(e, cur), cur) }}</td>
        <td class="r num">{{ pct(cur === 'USD' ? e.plPctUSD : e.plPct) }}</td>
      </tr></tbody></table>
  </Panel>
</template>
