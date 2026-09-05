import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conf, pref, limparConfiguracoes, GRUPOS, _semearParaTeste } from '../src/core/configuracoes.js';

test('conf e pref devolvem undefined quando nada foi carregado', () => {
  limparConfiguracoes();
  assert.equal(conf('escolas', 'x'), undefined);
  assert.equal(pref('escolas', 'x'), undefined);
});

test('depois de semear, conf e pref devolvem o valor gravado', () => {
  _semearParaTeste(
    { 'horarios/cobertura': { a: 1 } },
    { 'escolas/telefones_no_card': true },
  );
  assert.deepEqual(conf('horarios', 'cobertura'), { a: 1 });
  assert.equal(pref('escolas', 'telefones_no_card'), true);
  assert.equal(conf('escolas', 'telefones_no_card'), undefined); // rede ≠ pessoa
});

test('limparConfiguracoes zera os dois mapas', () => {
  _semearParaTeste({ 'a/b': 1 }, { 'a/b': 2 });
  limparConfiguracoes();
  assert.equal(conf('a', 'b'), undefined);
  assert.equal(pref('a', 'b'), undefined);
});

test('GRUPOS é um vocabulário fechado com id e rótulo', () => {
  assert.ok(GRUPOS.length >= 3);
  for (const g of GRUPOS) { assert.equal(typeof g.id, 'string'); assert.equal(typeof g.rotulo, 'string'); }
  assert.ok(GRUPOS.some(g => g.id === 'exibicao'));
});
