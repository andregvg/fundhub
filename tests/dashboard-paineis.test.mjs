import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAINEIS_META, ordemResolvida } from '../src/modules/dashboard/dashboard.config.js';
import { _semearParaTeste, limparConfiguracoes } from '../src/core/configuracoes.js';

test('PAINEIS_META tem os seis painéis, com id e título', () => {
  const ids = PAINEIS_META.map(p => p.id);
  assert.deepEqual(ids, ['numeros', 'hoje', 'extraclasse', 'afastamentos', 'calendario', 'ocorrencias']);
  for (const p of PAINEIS_META) { assert.equal(typeof p.id, 'string'); assert.equal(typeof p.titulo, 'string'); }
});

test('ordemResolvida sem preferência = ordem natural filtrada pelos disponíveis', () => {
  limparConfiguracoes();
  assert.deepEqual(ordemResolvida(['numeros', 'hoje', 'calendario']), ['numeros', 'hoje', 'calendario']);
});

test('ordemResolvida respeita a preferência e descarta id que não existe mais', () => {
  _semearParaTeste({}, { 'dashboard/ordem_paineis': ['calendario', 'zumbi', 'numeros'] });
  assert.deepEqual(ordemResolvida(['numeros', 'hoje', 'calendario']), ['calendario', 'numeros', 'hoje']);
});

test('ordemResolvida acrescenta painel novo (fora da preferência) no fim', () => {
  _semearParaTeste({}, { 'dashboard/ordem_paineis': ['hoje', 'numeros'] });
  assert.deepEqual(ordemResolvida(['numeros', 'hoje', 'novo']), ['hoje', 'numeros', 'novo']);
});
