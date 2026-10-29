<script setup>
import { computed } from 'vue'
import { useDesk } from '../composables/useDesk.js'
import { PRESETS } from '../domain/periods.js'
import { date } from '../domain/format.js'
import { hidden, togglePrivacy } from '../composables/usePrivacy.js'
const { filters, portfolioOptions, unassigned, range, resetFilters } = useDesk()
const label = computed(() => (range.value.from || range.value.to ? `${date(range.value.from)} – ${date(range.value.to)}` : 'Todo el historial'))
const SHORT = { all: 'Todo', thisMonth: 'Este mes', prevMonth: 'Mes anterior', d30: '30 días', d90: '90 días', m6: '6 meses', thisYear: 'Año actual', prevYear: 'Año anterior', m12: '12 meses', custom: 'Personalizado' }
</script>
<template>
  <div class="topbar">
    <div class="range-pill" title="Las ventas se asignan al período por fecha de venta">{{ label }}<small>por fecha de venta</small></div>
    <div class="seg wrap" role="group" aria-label="Período">
      <button v-for="p in PRESETS" :key="p.id" :class="{ on: filters.preset === p.id }" @click="filters.preset = p.id">{{ SHORT[p.id] }}</button>
    </div>
    <div v-if="filters.preset === 'custom'" class="custom">
      <label>Desde <input type="date" v-model="filters.from" :max="filters.to || undefined" /></label>
      <label>Hasta <input type="date" v-model="filters.to" :min="filters.from || undefined" /></label>
    </div>
    <div class="spacer" />
    <select v-model="filters.portfolio" aria-label="Cartera">
      <option value="all">Todas las carteras</option><option value="none">Sin cartera ({{ unassigned }})</option>
      <option v-for="p in portfolioOptions" :key="p.id" :value="String(p.id)">{{ p.name }} ({{ p.count }})</option>
    </select>
    <select v-model="filters.assetType" aria-label="Instrumento"><option value="all">Todos los instrumentos</option><option value="CEDEAR">CEDEAR</option><option value="ACCION_AR">Acción AR</option></select>
    <div class="seg" role="group" aria-label="Moneda">
      <button v-for="c in [['ARS','ARS'],['USD','USD'],['BOTH','Ambas']]" :key="c[0]" :class="{ on: filters.currency === c[0] }" @click="filters.currency = c[0]">{{ c[1] }}</button>
    </div>
    <button class="ghost" @click="resetFilters">Restablecer</button>
    <button class="eye" :class="{ on: hidden }" :aria-pressed="hidden" :title="hidden ? 'Mostrar importes' : 'Ocultar importes'" :aria-label="hidden ? 'Mostrar importes' : 'Ocultar importes'" @click="togglePrivacy">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <template v-if="!hidden"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></template>
        <template v-else><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2" /></template>
      </svg>
    </button>
  </div>
</template>
