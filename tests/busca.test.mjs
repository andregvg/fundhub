import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrarOpcoes, aproximarOpcoes } from '../src/shared/ui/busca-selecao.js';
import { distancia, semelhanca } from '../src/shared/dom.js';

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

test('distancia: troca, inserção, remoção e inversão contam 1', () => {
  assert.equal(distancia('museu', 'museu'), 0);
  assert.equal(distancia('muzeu', 'museu'), 1);   // troca
  assert.equal(distancia('teatro', 'theatro'), 1); // inserção
  assert.equal(distancia('msueu', 'museu'), 1);   // inversão de vizinhas
  assert.equal(distancia('', 'abc'), 3);
  assert.equal(distancia('abc', ''), 3);
});

test('semelhanca: começo de palavra é igual; até 1 letra (2 a partir de 7)', () => {
  assert.equal(semelhanca('muse', 'museu'), 0);       // ainda digitando
  assert.equal(semelhanca('Muzeu', 'MUSEU'), 1);      // normaliza caixa
  assert.equal(semelhanca('exemplu', 'exemplo'), 1);
  assert.equal(semelhanca('exenplu', 'exemplo'), 2);  // 7 letras: tolera 2
  assert.equal(semelhanca('muzeo', 'museu'), null);   // 2 erros em 5 letras
  assert.equal(semelhanca('de', 'da'), null);         // curta: só igual ou começo
  assert.equal(semelhanca('de', 'dentro'), 0);
  assert.equal(semelhanca('escola', 'museu'), null);
  assert.equal(semelhanca('', 'museu'), null);
});

const LOCAIS = [
  { id: 'm', rotulo: 'Museu Exemplo', detalhe: 'Rua Exemplo, 10 - Centro' },
  { id: 't', rotulo: 'Theatro Exemplo', detalhe: 'Rua Exemplo, 20 - Centro' },
  { id: 'p', rotulo: 'Parque Exemplo', detalhe: 'Avenida Exemplo, 30 - Jardim' },
];

test('aproximarOpcoes: acha com erro de digitação', () => {
  assert.deepEqual(aproximarOpcoes(LOCAIS, 'muzeu').map(o => o.id), ['m']);
  assert.deepEqual(aproximarOpcoes(LOCAIS, 'teatro exemplu').map(o => o.id), ['t']);
});

test('aproximarOpcoes: toda palavra precisa parecer alguma', () => {
  assert.deepEqual(aproximarOpcoes(LOCAIS, 'muzeu jardim').map(o => o.id), []);
});

test('aproximarOpcoes: mais parecida primeiro, com teto', () => {
  const r = aproximarOpcoes(LOCAIS, 'exemplp').map(o => o.id);
  assert.deepEqual(r, ['m', 't', 'p']);               // empate: ordem original
  assert.equal(aproximarOpcoes(LOCAIS, 'exemplp', 2).length, 2);
});

test('aproximarOpcoes: termo vazio ou lista ausente devolve vazio', () => {
  assert.deepEqual(aproximarOpcoes(LOCAIS, ''), []);
  assert.deepEqual(aproximarOpcoes(undefined, 'museu'), []);
});
