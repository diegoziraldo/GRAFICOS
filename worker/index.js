// worker/index.js
//
// Entrada para despliegue como Cloudflare Worker (npx wrangler deploy).
// - /api/*  -> API de SOLO LECTURA sobre tu base D1 (binding "DB").
// - resto   -> archivos estáticos de la app (carpeta dist, binding "ASSETS").
// Reutiliza functions/_lib/trades.js y portfolios.js sin cambios.
import { Hono } from 'hono';
import * as trades from '../functions/_lib/trades.js';
import * as portfolios from '../functions/_lib/portfolios.js';

const app = new Hono().basePath('/api');

app.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

function h(fn) {
  return async (c) => {
    try {
      return await fn(c);
    } catch (err) {
      if (err && err.status) return c.json({ error: err.message }, err.status);
      console.error(err);
      return c.json({ error: 'Error interno' }, 500);
    }
  };
}

app.get('/health', (c) => c.json({ status: 'ok', mode: 'read-only', db: Boolean(c.env.DB) }));
app.get('/trades', h(async (c) => c.json(await trades.getAll(c.env.DB))));
app.get('/portfolios', h(async (c) => c.json(await portfolios.getAllPortfolios(c.env.DB))));
app.notFound((c) => c.json({ error: 'No encontrado (API de solo lectura)' }, 404));

export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
