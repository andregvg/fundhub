// A cor do SATE é de cada pessoa (spec 2026-10-03, D20): a preferência
// vence; sem ela, vale a que a rede tinha escolhido; sem nenhuma, verde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _semearParaTeste } from '../src/core/configuracoes.js';
import { corSate } from '../src/modules/sate/sate.config.js';

test('sem nada gravado, verde', () => {
  _semearParaTeste({}, {});
  assert.equal(corSate(), 'verde');
});

test('a cor da rede é o padrão de quem nunca escolheu', () => {
  _semearParaTeste({ 'sate/cor': 'azul' }, {});
  assert.equal(corSate(), 'azul');
});

test('a preferência da pessoa vence a da rede', () => {
  _semearParaTeste({ 'sate/cor': 'azul' }, { 'sate/cor': 'vinho' });
  assert.equal(corSate(), 'vinho');
});

test('valor fora da lista cai no padrão', () => {
  _semearParaTeste({}, { 'sate/cor': 'neon' });
  assert.equal(corSate(), 'verde');
});
