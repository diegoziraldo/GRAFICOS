<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Chart } from 'chart.js'
import { hidden } from '../composables/usePrivacy.js'

const props = defineProps({ config: { type: Object, required: true }, height: { type: Number, default: 260 } })
const el = ref(null)
let chart = null

const draw = (animate = true) => {
  chart?.destroy()
  const cfg = { ...props.config }
  if (!animate) cfg.options = { ...cfg.options, animation: false }
  chart = new Chart(el.value, cfg)
}
onMounted(() => draw())
watch(() => props.config, () => draw())
watch(hidden, () => draw(false))
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div class="chart" :style="{ height: height + 'px' }"><canvas ref="el" /></div>
</template>
