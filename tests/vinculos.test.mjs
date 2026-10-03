// Regras do vínculo que outras telas leem: quem é supervisão (não é equipe
// da escola) - spec 2026-10-03, D13.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eSupervisao, ordemNaEquipe, vinculosDeEquipe } from '../src/modules/servidores/equipe.model.js';
import { rotulaVinculo, cargoExibidoDe } from '../src/modules/servidores/servidores.model.js';
import { temFuncao } from '../src/modules/servidores/vinculos.model.js';

test('supervisão é reconhecida pelo rótulo canônico e pelo legado', () => {
  assert.equal(eSupervisao('Supervisor(a)'), true);
  assert.equal(eSupervisao('supervisor'), true);        // papel anterior à migration 023
  assert.equal(eSupervisao('Gestor(a)'), false);
  assert.equal(eSupervisao('Coordenador(a)'), false);
  assert.equal(eSupervisao(''), false);
  assert.equal(eSupervisao(null), false);
});

test('a função entra no rótulo do cargo, só para gestor', () => {
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)', funcao: 1 }), 'Gestor(a) 1');
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)', funcao: 2 }), 'Gestor(a) 2');
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)', funcao: null }), 'Gestor(a)');
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)' }), 'Gestor(a)');
  assert.equal(rotulaVinculo({ papel: 'Coordenador(a)', funcao: 1 }), 'Coordenador(a)');
  assert.equal(rotulaVinculo(null), '');
});

test('cargoExibidoDe junta os vínculos abertos, com a função', () => {
  const s = { vinculos: [
    { papel: 'Gestor(a)', funcao: 2, fim: null },
    { papel: 'Gestor(a)', funcao: 1, fim: '2026-01-31' },   // encerrado: fora
  ] };
  assert.equal(cargoExibidoDe(s), 'Gestor(a) 2');
});

test('só o cargo de gestor tem função', () => {
  assert.equal(temFuncao('Gestor(a)'), true);
  assert.equal(temFuncao('gestor'), true);            // legado
  assert.equal(temFuncao('Coordenador(a)'), false);
  assert.equal(temFuncao(''), false);
});

test('ordem da equipe: Gestor 1, Gestor 2, gestor sem função, coordenação, demais', () => {
  const ordem = [
    { papel: 'Secretário(a)' },
    { papel: 'Coordenador(a)' },
    { papel: 'Gestor(a)' },
    { papel: 'Gestor(a)', funcao: 2 },
    { papel: 'Gestor(a)', funcao: 1 },
  ].map(ordemNaEquipe);
  assert.deepEqual(ordem, [4, 3, 2, 1, 0]);
});

test('vinculosDeEquipe deixa de fora o encerrado e a supervisão', () => {
  const s = { vinculos: [
    { unidade_id: 'a', papel: 'Supervisor(a)', fim: null },
    { unidade_id: 'b', papel: 'Coordenador(a)', fim: null },
    { unidade_id: 'c', papel: 'Gestor(a)', fim: '2026-01-31' },
  ] };
  assert.deepEqual(vinculosDeEquipe(s).map(v => v.unidade_id), ['b']);
});
