<script setup>
import { onMounted } from 'vue'
import { useDesk } from './composables/useDesk.js'
import FilterBar from './components/FilterBar.vue'
import StateBox from './components/StateBox.vue'
import Icon from './components/Icon.vue'
import ImportMenu from './components/ImportMenu.vue'

const { load, trades, loading, source, sourceLabel, portfoliosError, portfolioOptions, unassigned } = useDesk()
onMounted(load)
const NAV = [['/', 'Panel general', 'home'], ['/operaciones', 'Operaciones', 'swap'], ['/activos', 'Activos', 'bars'], ['/estadisticas', 'Estadísticas', 'pie'], ['/calendario', 'Calendario', 'cal'], ['/comparar', 'Comparar períodos', 'cmp']]
</script>

<template>
  <div class="shell">
    <aside class="side">
      <div class="brand"><span class="logo"><Icon name="mark" /></span><span>Trading Performance Desk<small>Analizá · Evaluá · Mejorá</small></span></div>
      <nav><router-link v-for="n in NAV" :key="n[0]" :to="n[0]" exact-active-class="active"><Icon :name="n[2]" />{{ n[1] }}</router-link></nav>
      <div class="side-import"><ImportMenu /></div>
      <p class="side-foot">{{ loading ? '' : trades.length + ' operaciones cargadas' }}</p>
    </aside>
    <div class="main">
      <FilterBar />
      <main>
        <p v-if="source === 'file'" class="banner">Mostrando datos importados de <b>{{ sourceLabel }}</b>. Viven solo en este navegador; no se guardan en tu base. <button class="ghost" @click="load">Volver a mi base</button></p>
        <p v-if="portfoliosError" class="warn">No se pudieron cargar las carteras ({{ portfoliosError }}). Se muestran solo las que figuran en las operaciones.</p>
        <p v-else-if="!loading && trades.length && portfolioOptions.length && unassigned === trades.length" class="warn">Tenés {{ portfolioOptions.length }} cartera(s), pero ninguna operación está asignada a una. El filtro por cartera solo separa operaciones que tengan cartera asignada en tu bitácora de trades.</p>
        <StateBox>
          <p v-if="!trades.length" class="empty big">Todavía no hay operaciones en la base. Cargalas desde tu bitácora de trades, o importá un archivo para probar.</p>
          <router-view v-else />
        </StateBox>
      </main>
    </div>
  </div>
</template>
