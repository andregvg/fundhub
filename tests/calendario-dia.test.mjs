// O que um dia do calendário escolar significa para o extraclasse
// (spec 2026-10-10-sate-disponibilidade, D1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situacaoDoDia, avisoDoDia, motivoDoDia } from '../src/modules/calendario/calendario.model.js';

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

test('avisoDoDia: não letivo e bloqueado avisam; letivo comum e evento não', () => {
  assert.equal(avisoDoDia({ letivo: false }), 'Não é dia letivo.');
  assert.equal(avisoDoDia({ letivo: true, bloqueia_extraclasse: true }), 'Data bloqueada para extraclasse.');
  assert.equal(avisoDoDia({ letivo: true, evento: 'Mostra' }), '');
  assert.equal(avisoDoDia(null), '');
});

test('dia letivo em parte: a faixa é o trecho com aula', () => {
  const dia = { letivo: true, letivo_de: '13:00:00', letivo_ate: '17:00:00' };
  assert.equal(situacaoDoDia(dia), 'parcial');
  assert.equal(avisoDoDia(dia, { emb: '13:30', ret: '16:30' }), '');
  assert.match(avisoDoDia(dia, { emb: '08:00', ret: '11:30' }), /período não letivo \(há aula das 13:00 às 17:00\)/);
  assert.match(avisoDoDia(dia, { emb: '12:00', ret: '15:00' }), /período não letivo/);
  assert.equal(avisoDoDia(dia, {}), '');   // sem horários ainda, nada a dizer
  assert.equal(situacaoDoDia({ letivo: true, letivo_de: '17:00', letivo_ate: '13:00' }), null);   // faixa invertida não vale
});

test('motivoDoDia: a frase de cada situação, com e sem evento', () => {
  assert.equal(motivoDoDia({ letivo: true, bloqueia_extraclasse: true, evento: 'Prova' }), 'Data bloqueada para extraclasse (Prova).');
  assert.equal(motivoDoDia({ letivo: true, bloqueia_extraclasse: true }), 'Data bloqueada para extraclasse.');
  assert.equal(motivoDoDia({ letivo: false, evento: 'Feriado' }), 'Não é dia letivo (Feriado).');
  assert.equal(motivoDoDia({ letivo: true, evento: 'Mostra' }), 'Neste dia: Mostra.');
  assert.equal(motivoDoDia(null), '');
});
