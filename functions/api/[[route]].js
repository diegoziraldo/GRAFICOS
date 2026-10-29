// functions/api/[[route]].js
//
// API de SOLO LECTURA para el Trading Performance Desk.
// Expone únicamente GET /api/trades, GET /api/portfolios y GET /api/health,
// usando la misma lógica (functions/_lib/trades.js y portfolios.js) que tu
// bitácora. No hay rutas POST/PUT/DELETE: este despliegue no puede modificar
// ni borrar operaciones de la base D1.
import { Hono } from 'hono';
import * as trades from '../_lib/trades.js';
import * as portfolios from '../_lib/portfolios.js';

const app = new Hono().basePath('/api');

// Los datos cambian cuando cargás operaciones: nunca cachear.
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

// Cualquier otra ruta /api/* (incluidas escrituras) responde JSON, nunca HTML.
app.notFound((c) => c.json({ error: 'No encontrado (API de solo lectura)' }, 404));

export const onRequest = (context) => app.fetch(context.request, context.env, context);
