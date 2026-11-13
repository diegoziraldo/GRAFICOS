<script setup>
import { onMounted } from 'vue'
import { useDesk } from './composables/useDesk.js'
import FilterBar from './components/FilterBar.vue'
import StateBox from './components/StateBox.vue'
import Icon from './components/Icon.vue'
import ImportMenu from './components/ImportMenu.vue'

const { load, trades, cauciones, loading, source, sourceLabel, portfoliosError, portfolioOptions, unassigned } = useDesk()
onMounted(load)
const NAV = [['/', 'Panel general', 'home', 'Panel'], ['/operaciones', 'Operaciones', 'swap', 'Ops.'], ['/activos', 'Activos', 'bars', 'Activos'], ['/cauciones', 'Cauciones', 'coin', 'Cauc.'], ['/estadisticas', 'Estadísticas', 'pie', 'Métricas'], ['/calendario', 'Calendario', 'cal', 'Calend.'], ['/comparar', 'Comparar períodos', 'cmp', 'Comparar']]
</script>

<template>
  <div class="shell">
    <aside class="side">
      <div class="brand"><span class="logo"><Icon name="mark" /></span><span class="brand-text">Trading Performance Desk<small>Analizá · Evaluá · Mejorá</small></span></div>
      <nav><router-link v-for="n in NAV" :key="n[0]" :to="n[0]" exact-active-class="active" :title="n[1]"><Icon :name="n[2]" /><span class="nl nl-full">{{ n[1] }}</span><span class="nl nl-short">{{ n[3] }}</span></router-link></nav>
      <div class="side-import"><ImportMenu /></div>
      <p class="side-foot">{{ loading ? '' : trades.length + ' operaciones cargadas' }}</p>
    </aside>
    <div class="main">
      <FilterBar />
      <main>
        <p v-if="source === 'file'" class="banner"><span>Mostrando datos importados de <b>{{ sourceLabel }}</b>. Viven solo en este navegador; no se guardan en tu base.</span> <button class="ghost" @click="load">Volver a mi base</button></p>
        <p v-if="portfoliosError" class="warn">No se pudieron cargar las carteras ({{ portfoliosError }}). Se muestran solo las que figuran en las operaciones.</p>
        <p v-else-if="!loading && trades.length && portfolioOptions.length && unassigned === trades.length" class="warn">Tenés {{ portfolioOptions.length }} cartera(s), pero ninguna operación está asignada a una. El filtro por cartera solo separa operaciones que tengan cartera asignada en tu bitácora de trades.</p>
        <StateBox>
          <p v-if="!trades.length && !cauciones.length" class="empty big">Todavía no hay operaciones en la base. Cargalas desde tu bitácora de trades, o importá un archivo para probar.</p>
          <router-view v-else />
        </StateBox>
      </main>
    </div>
  </div>
</template>
