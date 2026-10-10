// O que um dia do calendário escolar significa para o extraclasse
// (spec 2026-10-10-sate-disponibilidade, D1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situacaoDoDia, diaImpedeExtraclasse, motivoDoDia } from '../src/modules/calendario/calendario.model.js';

test('situacaoDoDia: dia sem registro ou comum é null', () => {
  assert.equal(situacaoDoDia(null), null);
  assert.equal(situacaoDoDia(undefined), null);
  assert.equal(situacaoDoDia({ letivo: true, evento: null, bloqueia_extraclasse: false }), null);
  assert.equal(situacaoDoDia({ letivo: true, evento: '   ', bloqueia_extraclasse: false }), null);
});

test('situacaoDoDia: as três situações', () => {
  assert.equal(situacaoDoDia({ letivo: false, evento: 'Feriado' }), 'nao_letivo');
  assert.equal(situacaoDoDia({ letivo: true, bloqueia_extraclasse: true, evento: 'Prova' }), 'bloqueado');
  assert.equal(situacaoDoDia({ letivo: true, evento: 'Mostra cultural' }), 'evento');
});

test('situacaoDoDia: bloqueado vence não letivo', () => {
  assert.equal(situacaoDoDia({ letivo: false, bloqueia_extraclasse: true }), 'bloqueado');
});

test('diaImpedeExtraclasse: só não letivo e bloqueado impedem', () => {
  assert.equal(diaImpedeExtraclasse({ letivo: false }), true);
  assert.equal(diaImpedeExtraclasse({ letivo: true, bloqueia_extraclasse: true }), true);
  assert.equal(diaImpedeExtraclasse({ letivo: true, evento: 'Mostra' }), false);
  assert.equal(diaImpedeExtraclasse(null), false);
});

test('motivoDoDia: a frase de cada situação, com e sem evento', () => {
  assert.equal(motivoDoDia({ letivo: true, bloqueia_extraclasse: true, evento: 'Prova' }), 'Data bloqueada para extraclasse (Prova).');
  assert.equal(motivoDoDia({ letivo: true, bloqueia_extraclasse: true }), 'Data bloqueada para extraclasse.');
  assert.equal(motivoDoDia({ letivo: false, evento: 'Feriado' }), 'Não é dia letivo (Feriado).');
  assert.equal(motivoDoDia({ letivo: true, evento: 'Mostra' }), 'Neste dia: Mostra.');
  assert.equal(motivoDoDia(null), '');
});
