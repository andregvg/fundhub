import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardsPorLinha as cardsEscolas } from '../src/modules/escolas/escolas.config.js';
import { cardsPorLinha as cardsServidores } from '../src/modules/servidores/servidores.config.js';
import { _semearParaTeste, limparConfiguracoes } from '../src/core/configuracoes.js';

test('cardsPorLinha padrão é 3', () => {
  limparConfiguracoes();
  assert.equal(cardsEscolas(), 3);
  assert.equal(cardsServidores(), 3);
});

test('cardsPorLinha respeita a preferência, limitado a 1–6', () => {
  _semearParaTeste({}, { 'escolas/cards_por_linha': 5 });
  assert.equal(cardsEscolas(), 5);
  _semearParaTeste({}, { 'escolas/cards_por_linha': 99 });
  assert.equal(cardsEscolas(), 6);
  _semearParaTeste({}, { 'escolas/cards_por_linha': 0 });
  assert.equal(cardsEscolas(), 1);
});
