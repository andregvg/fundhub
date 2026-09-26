import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situacaoDaFrota, filtrarFrotas, ehOrfa } from '../src/modules/sate/frota.model.js';

const H = '2026-10-10';
const f = (inicio, fim, tipo = 'onibus') => ({ inicio, fim, tipo });

test('situação relativa a hoje', () => {
  assert.equal(situacaoDaFrota(f('2026-10-11', null), H), 'futura');
  assert.equal(situacaoDaFrota(f('2026-01-01', '2026-10-09'), H), 'encerrada');
  assert.equal(situacaoDaFrota(f('2026-01-01', '2026-10-10'), H), 'vigente');
  assert.equal(situacaoDaFrota(f('2026-10-10', null), H), 'vigente');
});

test('filtro por situação, tipo e período de vigência', () => {
  const lista = [f('2026-01-01', null), f('2026-11-01', null), f('2026-01-01', '2026-02-01'), f('2026-01-01', null, 'van_adaptada')];
  assert.equal(filtrarFrotas(lista, { situacao: 'vigente' }, H).length, 2);
  assert.equal(filtrarFrotas(lista, { situacao: 'todas', tipo: 'onibus' }, H).length, 3);
  assert.equal(filtrarFrotas(lista, { situacao: 'todas', de: '2026-03-01', ate: '2026-03-31' }, H).length, 2);
  assert.equal(filtrarFrotas(lista, { situacao: 'encerrada' }, H).length, 1);
});

test('frota extra órfã: pedido negado ou fora da vigência', () => {
  assert.equal(ehOrfa({ inicio: '2026-10-10', fim: '2026-10-10', solicitacao: { status: 'negado', data: '2026-10-10' } }), true);
  assert.equal(ehOrfa({ inicio: '2026-10-10', fim: '2026-10-10', solicitacao: { status: 'confirmado', data: '2026-10-12' } }), true);
  assert.equal(ehOrfa({ inicio: '2026-10-10', fim: '2026-10-11', solicitacao: { status: 'confirmado', data: '2026-10-10' } }), false);
});
