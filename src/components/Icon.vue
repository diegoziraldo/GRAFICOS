<script setup>
defineProps({ name: String })
const P = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  swap: 'M4 8h14l-3-3M20 16H6l3 3',
  bars: 'M5 20V10M12 20V4M19 20v-7',
  pie: 'M12 3v9h9A9 9 0 1 1 12 3zM15 3.5A9 9 0 0 1 20.5 9H15z',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  cmp: 'M9 4v16M15 4v16M4 9h5M15 15h5',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v10M14.5 9.6c0-1-1-1.6-2.5-1.6s-2.5.7-2.5 1.7 1 1.4 2.5 1.8 2.5.8 2.5 1.8-1 1.7-2.5 1.7-2.5-.6-2.5-1.6',
  mark: 'M4 20l5-6 4 3 7-10',
}
</script>
<template>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="P[name]" /></svg>
</template>
