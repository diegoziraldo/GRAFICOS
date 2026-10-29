<script setup>
import { ref } from 'vue'
import { useDesk } from '../composables/useDesk.js'
import { importFromText, importFiles } from '../domain/importer.js'
import sample from '../assets/sample-trades.csv?raw'

const { useImported } = useDesk()
const input = ref(null)
const msg = ref('')

async function onFile(e) {
  const list = [...(e.target.files || [])]
  e.target.value = ''
  if (!list.length) return
  try {
    const files = await Promise.all(list.map(async (f) => ({ name: f.name, text: await f.text() })))
    useImported(importFiles(files), files.map((f) => f.name).join(' + ')); msg.value = ''
  }
  catch (err) { msg.value = err.message }
}
function loadSample() { useImported(importFromText(sample, 'sample.csv'), 'datos de muestra'); msg.value = '' }
</script>
<template>
  <div class="import-menu">
    <button class="ghost" @click="input.click()">Importar archivo</button>
    <button class="ghost" @click="loadSample">Datos de muestra</button>
    <input ref="input" type="file" accept=".csv,.json,.txt" multiple hidden @change="onFile" />
    <p v-if="msg" class="warn">{{ msg }}</p>
  </div>
</template>
