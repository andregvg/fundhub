import test from 'node:test';
import assert from 'node:assert/strict';
import { SEGMENTOS, expandir, unidadeNoSegmento } from '../src/core/segmentos.js';

test('todo segmento-base declara eixo fundamental ou infantil', () => {
  for (const s of SEGMENTOS) {
    assert.ok(['fundamental', 'infantil'].includes(s.eixo), `${s.codigo} sem eixo valido`);
  }
});

test('EMEF e EJA sao do eixo fundamental', () => {
  const porCodigo = Object.fromEntries(SEGMENTOS.map(s => [s.codigo, s]));
  assert.equal(porCodigo.EMEF.eixo, 'fundamental');
  assert.equal(porCodigo.EJA.eixo, 'fundamental');
});

test('CEI, EMEI e Conveniada sao do eixo infantil', () => {
  const porCodigo = Object.fromEntries(SEGMENTOS.map(s => [s.codigo, s]));
  assert.equal(porCodigo.CEI.eixo, 'infantil');
  assert.equal(porCodigo.EMEI.eixo, 'infantil');
  assert.equal(porCodigo.CONVENIADA.eixo, 'infantil');
});

test('nenhum segmento-base declara mais o campo ico', () => {
  for (const s of SEGMENTOS) {
    assert.equal(s.ico, undefined, `${s.codigo} ainda tem campo ico`);
  }
});

test('expandir e unidadeNoSegmento continuam funcionando como antes', () => {
  assert.deepEqual(expandir('fundamental'), ['EMEF', 'EJA']);
  assert.deepEqual(expandir('infantil'), ['CEI', 'EMEI', 'CONVENIADA']);
  assert.ok(unidadeNoSegmento({ segmento: 'EMEF', tem_eja: false }, ['EMEF']));
  assert.ok(!unidadeNoSegmento({ segmento: 'CEI', tem_eja: false }, ['EMEF']));
});
