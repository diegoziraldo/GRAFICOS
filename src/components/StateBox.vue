<script setup>
import { useDesk } from '../composables/useDesk.js'
import ImportMenu from './ImportMenu.vue'
const { loading, error, load } = useDesk()
</script>
<template>
  <div v-if="loading" class="state">Cargando operaciones…</div>
  <div v-else-if="error" class="state err">
    <p>{{ error }}</p><button class="ghost" @click="load">Reintentar</button>
    <p class="hint">¿Querés ver cómo queda sin conectarte? Importá un archivo o usá datos de muestra.</p><ImportMenu />
  </div>
  <slot v-else />
</template>
