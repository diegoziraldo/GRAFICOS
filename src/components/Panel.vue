<script setup>
defineProps({ title: String, note: String })
</script>
<template>
  <section class="panel">
    <header v-if="title || $slots.actions"><h3>{{ title }}</h3><div class="actions"><slot name="actions" /></div></header>
    <p v-if="note" class="note">{{ note }}</p>
    <slot />
  </section>
</template>
