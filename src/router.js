import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from './views/Dashboard.vue'
import Trades from './views/Trades.vue'
import Assets from './views/Assets.vue'
import AssetDetail from './views/AssetDetail.vue'
import Stats from './views/Stats.vue'
import Calendar from './views/Calendar.vue'
import Compare from './views/Compare.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Dashboard, meta: { title: 'Panel general' } },
    { path: '/operaciones', component: Trades, meta: { title: 'Operaciones' } },
    { path: '/activos', component: Assets, meta: { title: 'Activos' } },
    { path: '/activos/:ticker', component: AssetDetail, meta: { title: 'Detalle de activo' } },
    { path: '/estadisticas', component: Stats, meta: { title: 'Estadísticas' } },
    { path: '/calendario', component: Calendar, meta: { title: 'Calendario' } },
    { path: '/comparar', component: Compare, meta: { title: 'Comparar períodos' } },
  ],
})
