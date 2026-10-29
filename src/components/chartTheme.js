import { Chart, registerables } from 'chart.js'
import { money } from '../domain/format.js'
Chart.register(...registerables)

export const C = {
  gain: '#35e0a0', loss: '#ff7189', accent: '#4d83ff', muted: '#a9b8d6', grid: '#1b2c52', text: '#dbe5f7', warn: '#f0b429',
}
Chart.defaults.color = C.muted
Chart.defaults.borderColor = C.grid
Chart.defaults.font.family = 'system-ui, "Segoe UI", sans-serif'
Chart.defaults.font.size = 11

export const baseOptions = (cur, extra = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#050a14', borderColor: '#1d2f55', borderWidth: 1, titleColor: C.text, bodyColor: C.text, padding: 10,
      callbacks: { label: (c) => ` ${c.dataset.label ? c.dataset.label + ': ' : ''}${money(c.parsed.y ?? c.parsed.x, cur, 2)}` },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
    y: { ticks: { callback: (v) => money(v, cur, 0) } },
  },
  ...extra,
})
export const signColors = (vals) => vals.map((v) => (v >= 0 ? C.gain : C.loss))
