import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrarOpcoes } from '../src/shared/ui/busca-selecao.js';

const OPCOES = [
  { id: '1', rotulo: 'Escola Exemplo Alfa', detalhe: 'EMEF' },
  { id: '2', rotulo: 'Escola Exemplo Beta', detalhe: 'EMEI' },
  { id: '3', rotulo: 'Centro Exemplo Gama', detalhe: 'CEI', busca: 'creche' },
];

test('termo vazio devolve tudo', () => {
  assert.equal(filtrarOpcoes(OPCOES, '').length, 3);
  assert.equal(filtrarOpcoes(OPCOES, '   ').length, 3);
});

test('casa por pedaco do rotulo', () => {
  assert.deepEqual(filtrarOpcoes(OPCOES, 'beta').map(o => o.id), ['2']);
});

test('ignora acento e caixa', () => {
  const lista = [{ id: '1', rotulo: 'Educação Física' }];
  assert.equal(filtrarOpcoes(lista, 'EDUCACAO').length, 1);
  assert.equal(filtrarOpcoes(lista, 'fisica').length, 1);
});

test('todas as palavras precisam casar, em qualquer ordem', () => {
  assert.deepEqual(filtrarOpcoes(OPCOES, 'alfa escola').map(o => o.id), ['1']);
  assert.deepEqual(filtrarOpcoes(OPCOES, 'escola gama').map(o => o.id), []);
});

test('casa tambem contra o detalhe e o campo busca', () => {
  assert.deepEqual(filtrarOpcoes(OPCOES, 'emei').map(o => o.id), ['2']);
  assert.deepEqual(filtrarOpcoes(OPCOES, 'creche').map(o => o.id), ['3']);
});

test('sem resultado devolve lista vazia, nunca undefined', () => {
  assert.deepEqual(filtrarOpcoes(OPCOES, 'zzz'), []);
});

test('lista ausente nao lanca', () => {
  assert.deepEqual(filtrarOpcoes(undefined, 'a'), []);
  assert.deepEqual(filtrarOpcoes(null, ''), []);
});
