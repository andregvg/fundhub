// Bloco H: um registro recém-criado, que ainda não tem segmento, não
// pode ser escondido pelo filtro de segmento das listas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combina } from '../src/modules/servidores/views/lista.js';
import { unidadeNoSegmento } from '../src/core/segmentos.js';

// `seg` de mentira, com a mesma superfície que o filtro-segmento expõe.
function segFake(selecao, idx = {}) {
  return {
    selecionados: () => selecao,
    combina: (u) => unidadeNoSegmento(u, selecao),
    _idx: idx,
  };
}

function ctxBase(selecao, idxUnidades = {}) {
  return {
    filtro: { q: '', cargo: '', local: '', semVinculo: false },
    seg: segFake(selecao, idxUnidades),
    idxUnidades,
    filtroUnidade: '',
  };
}

const servidor = (abertos) => ({ id: 's', nome: 'FULANO', vinculos: abertos });

test('servidor recém-criado (sem vínculo) passa em qualquer recorte de segmento', () => {
  assert.equal(combina(servidor([]), ctxBase(['EMEF'])), true);
});

test('servidor só com vínculo na sede continua visível', () => {
  const s = servidor([{ unidade_id: 'x', unidade: { tipo: 'sede' } }]);
  assert.equal(combina(s, ctxBase(['EMEF'])), true);
});

test('servidor só com vínculo num local interno da SME continua visível', () => {
  const s = servidor([{ unidade_id: 'y', unidade: { tipo: 'interno' } }]);
  assert.equal(combina(s, ctxBase(['EMEF'])), true);
});

test('servidor com vínculo numa EMEF some ao filtrar só Infantil', () => {
  const idx = { e1: { segmento: 'EMEF' } };
  const s = servidor([{ unidade_id: 'e1', unidade: { tipo: 'escola' } }]);
  assert.equal(combina(s, ctxBase(['CEI'], idx)), false);
});

test('servidor com vínculo numa EMEF aparece ao filtrar Fundamental', () => {
  const idx = { e1: { segmento: 'EMEF' } };
  const s = servidor([{ unidade_id: 'e1', unidade: { tipo: 'escola' } }]);
  assert.equal(combina(s, ctxBase(['EMEF'], idx)), true);
});

test('sem segmento selecionado, todo servidor passa', () => {
  assert.equal(combina(servidor([]), ctxBase([])), true);
});

// A regra de escolas (combina(u) em escolas.view.js é closure sobre `seg`
// e não é exportada; aqui espelho a regra e travo o comportamento de
// core/segmentos.js sobre o qual ela se apoia).
function escolaPassaNoSegmento(u, selecao) {
  const temSegmento = Boolean(u.segmento) || Boolean(u.tem_eja);
  if (!selecao.length) return true;
  if (temSegmento) return unidadeNoSegmento(u, selecao);
  return true;
}

test('escola recém-criada sem segmento aparece com um eixo filtrado', () => {
  assert.equal(escolaPassaNoSegmento({ nome: 'Escola Exemplo' }, ['CEI']), true);
});

test('escola EMEF some ao filtrar só Infantil', () => {
  assert.equal(escolaPassaNoSegmento({ segmento: 'EMEF' }, ['CEI']), false);
});

test('escola EMEF com EJA aparece ao filtrar EJA', () => {
  assert.equal(escolaPassaNoSegmento({ segmento: 'EMEF', tem_eja: true }, ['EJA']), true);
});
