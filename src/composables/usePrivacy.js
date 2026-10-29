import { ref, watch } from 'vue'

// Modo privado: oculta importes y cantidades. Se recuerda entre sesiones.
const KEY = 'tpd.hideNumbers'
let initial = false
try { initial = localStorage.getItem(KEY) === '1' } catch { /* storage no disponible */ }
export const hidden = ref(initial)
watch(hidden, (v) => { try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* ignorar */ } })
export const togglePrivacy = () => { hidden.value = !hidden.value }
