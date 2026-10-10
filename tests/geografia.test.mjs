// Geografia: o que dá para testar sem rede - a leitura da resposta do
// serviço de CEP e a ordem de tentativas de "localizar pelo endereço".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerRespostaCep, localizarEndereco } from '../src/modules/locais/geografia.model.js';

test('lerRespostaCep lê endereço e coordenada', () => {
  const r = lerRespostaCep({
    cep: '00000000', address: 'Rua Exemplo', district: 'Centro',
    city: 'Ribeirão Preto', state: 'SP', lat: '-21.17', lng: '-47.80',
  });
  assert.deepEqual(r, {
    cep: '00000000', rua: 'Rua Exemplo', bairro: 'Centro',
    cidade: 'Ribeirão Preto', uf: 'SP', lat: -21.17, lng: -47.8,
  });
});

test('lerRespostaCep: CEP que não existe vira null', () => {
  assert.equal(lerRespostaCep({ code: 'not_found', message: 'x' }), null);
  assert.equal(lerRespostaCep(null), null);
  assert.equal(lerRespostaCep({}), null);
});

test('lerRespostaCep: coordenada inválida não derruba o endereço', () => {
  const r = lerRespostaCep({ cep: '00000-000', address: 'Rua Exemplo', lat: '', lng: '' });
  assert.equal(r.cep, '00000000');
  assert.equal(r.rua, 'Rua Exemplo');
  assert.equal(r.lat, null);
  assert.equal(r.lng, null);
});

const RUA = { lat: -21.1, lng: -47.8, formatado: 'Rua Exemplo, Centro, Ribeirão Preto, São Paulo, Brasil', rank: 26 };
const CASA = { ...RUA, rank: 30 };
const BAIRRO = { ...RUA, formatado: 'Centro, Ribeirão Preto, São Paulo, Brasil', rank: 20 };
const FORA = { ...RUA, formatado: 'Rua Exemplo, Centro, Cidade Exemplo, Brasil' };

test('localizarEndereco acha na segunda variante (sem bairro e sem s/n)', async () => {
  const vistas = [];
  const buscar = async (q) => { vistas.push(q); return vistas.length === 1 ? null : RUA; };
  const r = await localizarEndereco('Rua Exemplo, s/n - Centro', { buscar });
  assert.deepEqual(vistas, ['Rua Exemplo, s/n - Centro', 'Rua Exemplo']);
  assert.equal(r.achado, RUA);
  assert.equal(r.precisao, 'rua');
});

test('localizarEndereco: casa com número é precisão exata', async () => {
  const r = await localizarEndereco('Rua Exemplo, 100', { buscar: async () => CASA });
  assert.equal(r.precisao, 'exata');
});

test('localizarEndereco descarta bairro inteiro e diz o motivo', async () => {
  const r = await localizarEndereco('Rua Exemplo, 100 - Centro', { buscar: async () => BAIRRO });
  assert.deepEqual(r, { achado: null, motivo: 'aproximado' });
});

test('localizarEndereco descarta resposta de outra cidade', async () => {
  const r = await localizarEndereco('Rua Exemplo, 100', { buscar: async () => FORA });
  assert.deepEqual(r, { achado: null, motivo: 'nada' });
});

test('localizarEndereco para quando mandam parar', async () => {
  let n = 0;
  const r = await localizarEndereco('Rua Exemplo, s/n - Centro', {
    buscar: async () => { n++; return null; }, continuar: () => n === 0,
  });
  assert.equal(n, 1);
  assert.equal(r.achado, null);
});

test('localizarEndereco propaga a falha do serviço', async () => {
  await assert.rejects(
    localizarEndereco('Rua Exemplo, 100', { buscar: async () => { throw new Error('fora do ar'); } }),
    /fora do ar/);
});
