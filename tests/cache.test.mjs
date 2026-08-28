import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarCache, limparCaches, _reset } from '../src/shared/cache.js';

test('limparCaches chama todas as funcoes registradas', () => {
  _reset();
  let a = 0, b = 0;
  registrarCache(() => { a++; });
  registrarCache(() => { b++; });
  limparCaches();
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test('a mesma funcao registrada duas vezes so e chamada uma vez', () => {
  _reset();
  let n = 0;
  const f = () => { n++; };
  registrarCache(f);
  registrarCache(f);
  limparCaches();
  assert.equal(n, 1);
});

test('uma funcao que lanca nao impede as outras de rodar', () => {
  _reset();
  let depois = 0;
  registrarCache(() => { throw new Error('modelo quebrado'); });
  registrarCache(() => { depois++; });
  limparCaches();
  assert.equal(depois, 1);
});

test('sem nada registrado, limpar nao lanca', () => {
  _reset();
  assert.doesNotThrow(() => limparCaches());
});
