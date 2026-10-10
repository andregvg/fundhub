// CEP: guardar canônico (8 dígitos), exibir com hífen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cepDe, mascaraCep, fmtCep } from '../src/shared/format.js';

test('cepDe devolve os 8 dígitos ou null', () => {
  assert.equal(cepDe('00000-000'), '00000000');
  assert.equal(cepDe('12.345-678'), '12345678');
  assert.equal(cepDe('12345678'), '12345678');
  assert.equal(cepDe('1234567'), null);
  assert.equal(cepDe('123456789'), null);
  assert.equal(cepDe(''), null);
  assert.equal(cepDe(null), null);
});

test('mascaraCep formata o que já foi digitado', () => {
  assert.equal(mascaraCep('1'), '1');
  assert.equal(mascaraCep('12345'), '12345');
  assert.equal(mascaraCep('123456'), '12345-6');
  assert.equal(mascaraCep('12345678'), '12345-678');
  assert.equal(mascaraCep('12345-678999'), '12345-678');
  assert.equal(mascaraCep('abc'), '');
});

test('fmtCep só formata CEP completo', () => {
  assert.equal(fmtCep('12345678'), '12345-678');
  assert.equal(fmtCep('1234'), '');
  assert.equal(fmtCep(null), '');
});
