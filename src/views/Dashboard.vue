<script setup>
import { computed } from 'vue'
import { useDesk } from '../composables/useDesk.js'
import { money, signedMoney, pct, date, num, tone, qty } from '../domain/format.js'
import CurrencyBlock from '../components/CurrencyBlock.vue'
import Panel from '../components/Panel.vue'

const { cauciones, caucionMetricsFor, currencies, events, filteredTrades, ledger, discarded, metricsFor, portfolioName } = useDesk()
const cur0 = computed(() => currencies.value[0])
const byId = computed(() => new Map(events.value.map((e) => [e.id, e])))
const recent = computed(() => [...filteredTrades.value].reverse().slice(0, 7).map((t) => {
  const e = byId.value.get(t.id)
  return { ...t, result: e ? (cur0.value === 'USD' ? e.plUSD : e.pl) : null, pctv: e ? (cur0.value === 'USD' ? e.plPctUSD : e.plPct) : null }
}))
const cauSum = computed(() => currencies.value.map((c) => ({ c, total: cauciones.value.filter((x) => x.currency === c).length, m: caucionMetricsFor(c) })).filter((x) => x.total))
const both = computed(() => ['ARS', 'USD'].map((c) => ({ c, m: metricsFor(c) })))
</script>

<template>
  <div>
    <p v-if="discarded" class="warn">{{ discarded }} registro(s) de la API se descartaron por datos inválidos (fecha, cantidad o precio).</p>
    <p v-if="ledger.anomalies.length" class="warn">{{ ledger.anomalies.length }} venta(s) sin posición suficiente fueron recortadas o ignoradas.</p>

    <CurrencyBlock v-for="c in currencies" :key="c" :cur="c" />

    <Panel v-if="cauSum.length" title="Cauciones" note="Intereses netos de comisión. El período se aplica por fecha de vencimiento.">
      <template #actions><router-link to="/cauciones">Ver detalle</router-link></template>
      <div class="cur-sum">
        <div v-for="x in cauSum" :key="x.c"><h4>{{ x.c }}</h4>
          <span>Capital colocado hoy</span><b class="num">{{ money(x.m.capitalActive, x.c) }}</b>
          <span>Ganancia neta cobrada</span><b class="num" :class="tone(x.m.realized)">{{ signedMoney(x.m.realized, x.c) }}</b>
          <span>Ganancia neta proyectada</span><b class="num" :class="tone(x.m.projected)">{{ signedMoney(x.m.projected, x.c) }}</b>
          <span>TNA neta promedio</span><b class="num">{{ x.m.tnaNet == null ? '—' : num(x.m.tnaNet, 2) + '%' }}</b>
        </div>
      </div>
    </Panel>

    <div class="grid-ops">
      <Panel title="Últimas operaciones">
        <template #actions><router-link to="/operaciones">Ver todas</router-link></template>
        <div class="table-wrap"><table class="dense"><thead><tr><th>Fecha</th><th>Ticker</th><th>Operación</th><th>Cartera</th><th class="r">Cantidad</th><th class="r">Precio ARS</th><th class="r">Resultado ({{ cur0 }})</th><th class="r">Rent.</th></tr></thead>
          <tbody><tr v-for="t in recent" :key="t.id"><td>{{ date(t.date) }}</td><td><router-link :to="`/activos/${t.ticker}`">{{ t.ticker }}</router-link></td>
            <td><span class="tag" :class="t.operation === 'VENTA' ? 'sell' : 'buy'">{{ t.operation === 'VENTA' ? 'Venta' : 'Compra' }}</span></td><td>{{ portfolioName(t.portfolioId) }}</td>
            <td class="r num">{{ qty(t.quantity) }}</td><td class="r num">{{ money(t.price) }}</td>
            <td class="r num" :class="tone(t.result)">{{ t.operation === 'VENTA' ? signedMoney(t.result, cur0) : '' }}</td><td class="r num" :class="tone(t.pctv)">{{ t.operation === 'VENTA' ? pct(t.pctv) : '' }}</td></tr></tbody></table></div>
        <p v-if="!recent.length" class="empty">No hay operaciones en el período.</p>
      </Panel>
      <Panel title="Resumen por moneda" note="Importes originales en ARS; USD con el CCL de cada operación.">
        <div class="cur-sum">
          <div v-for="x in both" :key="x.c"><h4>{{ x.c }}</h4>
            <span>Resultado realizado</span><b class="num" :class="tone(x.m.net)">{{ signedMoney(x.m.net, x.c) }}</b>
            <span>Costo de lo vendido</span><b class="num">{{ money(x.m.basis, x.c) }}</b>
            <span>Rentabilidad</span><b class="num" :class="tone(x.m.returnPct)">{{ pct(x.m.returnPct) }}</b>
            <small v-if="x.m.excluded">{{ x.m.excluded }} venta(s) sin CCL</small>
          </div>
        </div>
      </Panel>
    </div>
  </div>
</template>
