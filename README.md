# Trading Performance Desk — proyecto completo para Cloudflare Pages

Un solo proyecto con todo lo necesario:

- **Frontend** Vue 3 + Vite (`src/`).
- **Backend** Hono (`worker/index.js` para Workers, `functions/api/[[route]].js` para Pages): API de **solo lectura** (`GET /api/trades`, `GET /api/portfolios`, `GET /api/health`). Usa tus archivos `functions/_lib/trades.js` y `portfolios.js` sin cambios, sobre tu base **D1 existente**.
- **No toca la base**: no hay rutas para crear, editar ni borrar. No hace falta correr migraciones (tu D1 ya tiene `ccl`, `sector` y `portfolio_id`).

> Es un proyecto **nuevo** de Pages: no reemplaza tu bitácora actual (`trader-page`). Los dos pueden compartir la misma base D1.

## ⚠️ Privacidad
Los GET no piden login: cualquiera que conozca la URL puede ver tus operaciones. Protegé el sitio con **Cloudflare Access** (gratis): Zero Trust → Access → Applications → Add → Self-hosted → dominio `tu-proyecto.pages.dev` → política "Allow" solo para tu email.

## Publicar como Worker (el flujo "Connect to Git" con Deploy command)
Este proyecto trae `wrangler.jsonc` y `worker/index.js`, así que el comando por defecto `npx wrangler deploy` funciona sin cambios en el panel.

1. Abrí **`wrangler.jsonc`** y completá 3 datos:
   - `"name"`: tiene que ser **igual al nombre de tu Worker** en Cloudflare (se ve arriba en el panel del proyecto).
   - `"database_name"` y `"database_id"`: los ves en **Workers & Pages → D1 → tu base**. El `binding` debe quedar como `DB`.
2. Subí el proyecto a GitHub (en la raíz: `package.json`, `wrangler.jsonc`, `worker/`, `functions/`, `src/`).
3. Configuración de build en Cloudflare:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
4. Al terminar el deploy, abrí `https://TU-WORKER.workers.dev/api/health` → debe decir `"db": true`.

Alternativa por consola: `npx wrangler login` y luego `npm run cf:deploy`.

### Si preferís Cloudflare *Pages*
Creá el proyecto desde "Looking to deploy Pages? Get started" (build `npm run build`, salida `dist`) y agregá el binding D1 `DB` en Settings → Bindings. En ese caso **borrá `wrangler.jsonc`** del repo. La API de Pages es `functions/api/[[route]].js`.

## Desarrollo local
- Contra tu sitio ya publicado: copiá `.env.example` a `.env`, poné `VITE_API_TARGET=https://TU-PROYECTO.pages.dev` y `npm run dev`.
- Sin conexión: botón **Importar archivo** (acepta `trades.csv` + `portfolios.csv` de tu backup juntos) o **Datos de muestra**.
- Tests de cálculo: `npm test`.

## Si algo falla
- *"devolvió una página web (HTML)"* → el binding o las Functions no están: revisá que exista la carpeta `functions/` en la raíz del repo y que `/api/health` responda JSON.
- `/api/health` dice `"db": false` → falta el binding `DB` (paso 5) o no hiciste el redeploy (paso 6).
- Selector de carteras con `(0)` → esas carteras no tienen operaciones asignadas en la tabla `trades` (`portfolio_id`).

## Método de cálculo y límites
Costo promedio ponderado por (cartera, ticker); comisión de compra suma al costo, comisión de venta resta del resultado; USD con el CCL de cada operación (si falta, no se estima); las ventas se asignan al período por fecha de venta. No hay precios de mercado en la base, así que no se muestran resultado no realizado ni patrimonio a mercado.
