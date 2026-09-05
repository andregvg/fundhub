import test from 'node:test';
import assert from 'node:assert/strict';
import { cliqueNoIcone, LARGURA_ICONE } from '../src/shared/ui/campo-data-hora.js';

test('clique no meio do campo nao conta como clique no icone', () => {
  assert.equal(cliqueNoIcone(10, 200), false);
});

test('clique bem a direita, dentro da faixa do icone, conta', () => {
  assert.equal(cliqueNoIcone(190, 200), true);
});

test('a borda exata da faixa do icone conta como icone (inclusiva)', () => {
  assert.equal(cliqueNoIcone(200 - LARGURA_ICONE, 200), true);
});

test('um pixel antes da faixa do icone nao conta como icone', () => {
  assert.equal(cliqueNoIcone(200 - LARGURA_ICONE - 1, 200), false);
});

test('LARGURA_ICONE e um numero positivo (sanity da constante)', () => {
  assert.equal(typeof LARGURA_ICONE, 'number');
  assert.ok(LARGURA_ICONE > 0);
});
