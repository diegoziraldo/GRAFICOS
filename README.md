# Trading Performance Desk — proyecto completo para Cloudflare Pages

Un solo proyecto con todo lo necesario:

- **Frontend** Vue 3 + Vite (`src/`).
- **Backend** Pages Functions + Hono (`functions/`): API de **solo lectura** (`GET /api/trades`, `GET /api/portfolios`, `GET /api/health`). Usa tus archivos `functions/_lib/trades.js` y `portfolios.js` sin cambios, sobre tu base **D1 existente**.
- **No toca la base**: no hay rutas para crear, editar ni borrar. No hace falta correr migraciones (tu D1 ya tiene `ccl`, `sector` y `portfolio_id`).

> Es un proyecto **nuevo** de Pages: no reemplaza tu bitácora actual (`trader-page`). Los dos pueden compartir la misma base D1.

## ⚠️ Privacidad
Los GET no piden login: cualquiera que conozca la URL puede ver tus operaciones. Protegé el sitio con **Cloudflare Access** (gratis): Zero Trust → Access → Applications → Add → Self-hosted → dominio `tu-proyecto.pages.dev` → política "Allow" solo para tu email.

## Publicar (con GitHub) — recomendado
1. Subí **el contenido de esta carpeta** a un repo de GitHub (en la raíz tienen que quedar `package.json`, `src/` y `functions/`). Si usás el repo `GRAFICOS`, reemplazá su contenido (borrá la carpeta `backend/` vieja: no se usa).
2. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → elegí el repo.
3. Configuración de build:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: (vacío)
4. **Save and Deploy**. (La primera vez la API todavía no ve la base: es normal.)
5. En el proyecto: **Settings → Bindings → Add → D1 database**
   - Variable name: **`DB`** (exactamente así, en mayúsculas)
   - D1 database: elegí la base que ya usás.
   - Agregalo en **Production** (y en Preview si querés).
6. **Deployments → Retry deployment** (o hacé un push) para que tome el binding.
7. Verificá: `https://TU-PROYECTO.pages.dev/api/health` → `{"status":"ok","mode":"read-only","db":true}` y `/api/trades` → JSON con tus operaciones.

## Publicar por consola (alternativa)
```bash
npm install
cp wrangler.toml.example wrangler.toml   # completá database_name y database_id de tu D1
npx wrangler login
npm run cf:deploy
```
(No uses `wrangler.toml` si conectás por Git: ahí el binding se configura en el panel.)

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
