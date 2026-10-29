<script setup>
defineProps({ label: String, value: String, sub: String, tone: String, help: String })
</script>
<template>
  <div class="kpi" tabindex="0">
    <div class="kpi-label">{{ label }}<span v-if="help" class="tip" aria-hidden="true">?<span class="tip-body">{{ help }}</span></span></div>
    <div class="kpi-value num" :class="tone">{{ value }}</div>
    <div v-if="sub" class="kpi-sub">{{ sub }}</div>
  </div>
</template>
