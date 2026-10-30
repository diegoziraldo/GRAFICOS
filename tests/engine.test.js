import { describe, it, expect } from 'vitest'
import { buildLedger } from '../src/domain/engine.js'
import { computeMetrics, drawdown, cumulative, groupResults } from '../src/domain/metrics.js'
import { resolvePeriod, inRange } from '../src/domain/periods.js'

let id = 0
const T = (o) => ({ id: ++id, assetType: 'CEDEAR', fee: 0, ccl: null, portfolioId: null, ...o })
const buy = (date, ticker, quantity, price, x = {}) => T({ date, ticker, operation: 'COMPRA', quantity, price, ...x })
const sell = (date, ticker, quantity, price, x = {}) => T({ date, ticker, operation: 'VENTA', quantity, price, ...x })

describe('motor contable', () => {
  it('1. operación ganadora', () => {
    const { events } = buildLedger([buy('2025-01-02', 'AAPL', 10, 100), sell('2025-01-10', 'AAPL', 10, 120)])
    expect(events[0].pl).toBeCloseTo(200)
    expect(events[0].plPct).toBeCloseTo(0.2)
    expect(events[0].days).toBe(8)
  })
  it('2. operación perdedora', () => {
    const { events } = buildLedger([buy('2025-01-02', 'AAPL', 10, 100), sell('2025-01-03', 'AAPL', 10, 90)])
    expect(events[0].pl).toBeCloseTo(-100)
  })
  it('3. con comisiones (compra suma al costo, venta resta)', () => {
    const { events } = buildLedger([buy('2025-01-02', 'X', 10, 100, { fee: 10 }), sell('2025-01-03', 'X', 10, 120, { fee: 12 })])
    expect(events[0].costBasis).toBeCloseTo(1010)
    expect(events[0].pl).toBeCloseTo(1200 - 1010 - 12)
  })
  it('4. varias compras y una venta parcial (costo promedio)', () => {
    const { events, open } = buildLedger([
      buy('2025-01-02', 'X', 10, 100), buy('2025-01-05', 'X', 10, 120), sell('2025-01-09', 'X', 5, 130),
    ])
    expect(events[0].pl).toBeCloseTo(5 * (130 - 110))
    expect(open[0].qty).toBe(15)
    expect(open[0].avgCost).toBeCloseTo(110)
  })
  it('5. posición abierta: sin eventos realizados', () => {
    const { events, open } = buildLedger([buy('2025-01-02', 'X', 3, 50)])
    expect(events).toHaveLength(0)
    expect(open[0].invested).toBeCloseTo(150)
  })
  it('6. USD con CCL por operación; sin CCL => null, no inventado', () => {
    const ok = buildLedger([buy('2025-01-02', 'X', 10, 1000, { ccl: 1000 }), sell('2025-01-03', 'X', 10, 1200, { ccl: 1200 })])
    expect(ok.events[0].pl).toBeCloseTo(2000)
    expect(ok.events[0].plUSD).toBeCloseTo(10 * (1 - 1))
    const miss = buildLedger([buy('2025-01-02', 'Y', 10, 1000), sell('2025-01-03', 'Y', 10, 1200, { ccl: 1200 })])
    expect(miss.events[0].plUSD).toBeNull()
    expect(computeMetrics(miss.events, 'USD').excluded).toBe(1)
  })
  it('7. período sin operaciones', () => {
    const m = computeMetrics([], 'ARS')
    expect(m.count).toBe(0); expect(m.winRate).toBeNull(); expect(m.net).toBe(0); expect(m.profitFactor).toBeNull()
  })
  it('8. cartera sin posiciones', () => {
    const { events, open } = buildLedger([])
    expect(events).toEqual([]); expect(open).toEqual([])
  })
  it('9/11. cancelaciones y transferencias no existen en trades: solo COMPRA/VENTA cuentan', () => {
    const { events } = buildLedger([buy('2025-01-02', 'X', 1, 10)])
    expect(events).toHaveLength(0)
  })
  it('10. venta total y recompra: el costo se reinicia', () => {
    const { events, open } = buildLedger([
      buy('2025-01-02', 'X', 10, 100), sell('2025-01-03', 'X', 10, 110), buy('2025-02-01', 'X', 10, 200), sell('2025-02-02', 'X', 5, 210),
    ])
    expect(events[0].pl).toBeCloseTo(100)
    expect(events[1].pl).toBeCloseTo(50)
    expect(open[0].avgCost).toBeCloseTo(200)
  })
  it('separa la misma especie por cartera', () => {
    const { events } = buildLedger([
      buy('2025-01-02', 'X', 10, 100, { portfolioId: 1 }), buy('2025-01-02', 'X', 10, 200, { portfolioId: 2 }),
      sell('2025-01-05', 'X', 10, 150, { portfolioId: 1 }),
    ])
    expect(events[0].pl).toBeCloseTo(500)
  })
  it('venta sin posición se reporta como anomalía', () => {
    const { events, anomalies } = buildLedger([sell('2025-01-02', 'X', 5, 10)])
    expect(events).toHaveLength(0); expect(anomalies).toHaveLength(1)
  })
})

describe('métricas', () => {
  const evs = buildLedger([
    buy('2025-01-02', 'A', 1, 100), sell('2025-01-03', 'A', 1, 150), // +50
    buy('2025-01-04', 'B', 1, 100), sell('2025-01-05', 'B', 1, 70), // -30
    buy('2025-01-06', 'C', 1, 100), sell('2025-01-07', 'C', 1, 60), // -40
    buy('2025-02-01', 'D', 1, 100), sell('2025-02-02', 'D', 1, 200), // +100
  ]).events
  const m = computeMetrics(evs, 'ARS')
  it('win rate, PF, expectativa, rachas', () => {
    expect(m.net).toBeCloseTo(80); expect(m.winRate).toBeCloseTo(0.5)
    expect(m.profitFactor).toBeCloseTo(150 / 70); expect(m.expectancy).toBeCloseTo(20)
    expect(m.maxLossStreak).toBe(2); expect(m.maxWinStreak).toBe(1)
    expect(m.payoff).toBeCloseTo(75 / 35)
  })
  it('drawdown en unidades sobre curva realizada', () => {
    expect(m.maxDrawdown).toBeCloseTo(-70)
    expect(drawdown(cumulative(evs, 'ARS')).durationDays).toBe(4)
  })
  it('agrupación mensual', () => {
    const g = groupResults(evs, 'ARS', 'month')
    expect(g.map((x) => x.key)).toEqual(['2025-01', '2025-02'])
    expect(g[0].value).toBeCloseTo(-20)
  })
})

describe('filtros de fecha', () => {
  it('presets y rangos inclusivos', () => {
    const now = new Date(2025, 5, 15)
    expect(resolvePeriod('prevYear', {}, now)).toEqual({ from: '2024-01-01', to: '2024-12-31' })
    expect(resolvePeriod('prevMonth', {}, now)).toEqual({ from: '2025-05-01', to: '2025-05-31' })
    expect(resolvePeriod('all')).toEqual({ from: null, to: null })
    expect(inRange('2025-05-31', { from: '2025-05-01', to: '2025-05-31' })).toBe(true)
    expect(inRange('2025-06-01', { from: '2025-05-01', to: '2025-05-31' })).toBe(false)
  })
})

import { importFromText, importFiles, parseNumber } from '../src/domain/importer.js'
describe('importación', () => {
  it('CSV con coma decimal y punto y coma, fechas dd/mm/aaaa', () => {
    const csv = 'Fecha;Ticker;Operación;Cantidad;Precio;Comisión;CCL;Cartera\n02/01/2025;aapl;Compra;10;1.234,50;12,5;1100;Principal\n10/01/2025;AAPL;Venta;10;1.300,00;0;1150;Principal'
    const r = importFromText(csv, 'x.csv')
    expect(r.trades).toHaveLength(2)
    expect(r.trades[0]).toMatchObject({ date: '2025-01-02', ticker: 'AAPL', price: 1234.5, fee: 12.5, ccl: 1100 })
    expect(r.portfolios).toEqual([{ id: 1, name: 'Principal' }])
  })
  it('descarta filas inválidas y falla sin columnas obligatorias', () => {
    const r = importFromText('fecha,ticker,operacion,cantidad,precio\n2025-01-02,X,COMPRA,1,10\nmala,X,COMPRA,1,10', 'a.csv')
    expect(r.trades).toHaveLength(1); expect(r.discarded).toBe(1)
    expect(() => importFromText('a,b\n1,2', 'a.csv')).toThrow(/Faltan columnas/)
  })
  it('JSON con el formato de /api/trades', () => {
    const j = JSON.stringify([{ id: 1, date: '2025-01-02', assetType: 'CEDEAR', ticker: 'KO', operation: 'COMPRA', quantity: 2, price: 100, fee: 0, ccl: null, portfolioId: null }])
    expect(importFromText(j, 'a.json').trades).toHaveLength(1)
  })
  it('números', () => { expect(parseNumber('1.234,56')).toBe(1234.56); expect(parseNumber('1,234.56')).toBe(1234.56); expect(parseNumber('')).toBeNull() })
})

describe('importación de backup (portfolio_id + nombres)', () => {
  it('usa portfolio_id y los nombres del archivo de carteras, incluso carteras vacías', () => {
    const trades = 'id,trade_date,asset_type,\'ACCION_AR\')),ticker,operation,quantity,price,fee,ccl,portfolio_id\n"1","2025-01-02","CEDEAR","","AAPL","COMPRA","10","100","0","1000","3"\n"2","2025-01-09","CEDEAR","","AAPL","VENTA","10","120","0","1100","3"'
    const ports = 'id,name,notes\n"1","SILVIO",""\n"3","DIEGO",""'
    const r = importFiles([{ name: 'portfolios.csv', text: ports }, { name: 'trades.csv', text: trades }])
    expect(r.trades).toHaveLength(2)
    expect(r.trades[0].portfolioId).toBe(3)
    expect(r.portfolios).toEqual([{ id: 1, name: 'SILVIO' }, { id: 3, name: 'DIEGO' }])
  })
})

import { replay, tradeTotals, holdStats, daysBetween } from '../src/domain/asset.js'
describe('detalle de activo', () => {
  const ts = [
    buy('2025-01-02', 'Z', 10, 100, { fee: 10 }), buy('2025-01-05', 'Z', 10, 120),
    sell('2025-01-09', 'Z', 5, 130, { fee: 5 }), sell('2025-01-20', 'Z', 15, 140),
  ]
  it('replay coincide con el motor: costo promedio y posición', () => {
    const r = replay(ts)
    expect(r.get(ts[1].id).avgAfter).toBeCloseTo((10 * 100 + 10 + 10 * 120) / 20)
    expect(r.get(ts[2].id).qtyAfter).toBe(15)
    expect(r.get(ts[2].id).avgAfter).toBeCloseTo(r.get(ts[1].id).avgAfter) // vender no cambia el promedio
    expect(r.get(ts[3].id).qtyAfter).toBe(0)
    expect(r.get(ts[3].id).avgAfter).toBeNull()
    const { open } = buildLedger(ts.slice(0, 3))
    expect(open[0].avgCost).toBeCloseTo(r.get(ts[2].id).avgAfter)
  })
  it('totales, comisiones y precios promedio', () => {
    const t = tradeTotals(ts)
    expect(t.buys.qty).toBe(20); expect(t.sells.qty).toBe(20)
    expect(t.buys.avg).toBeCloseTo(110); expect(t.fees).toBe(15)
    expect(t.first).toBe('2025-01-02'); expect(t.last).toBe('2025-01-20')
  })
  it('estadísticas de tenencia y días', () => {
    const h = holdStats(buildLedger(ts).events)
    expect(h).toMatchObject({ min: 7, max: 18 }); expect(h.avg).toBeCloseTo(12.5)
    expect(holdStats([])).toBeNull()
    expect(daysBetween('2025-01-01', '2025-01-31')).toBe(30)
  })
})
