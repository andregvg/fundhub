// Data sem ano (spec 2026-10-03, D2): a escola digita dia e mês, e o ano
// é o vigente - ou o seguinte, se a data já passou.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mascaraDiaMes, dataDeDiaMes, diaMesDe } from '../src/shared/format.js';

test('a máscara põe a barra enquanto se digita', () => {
  assert.equal(mascaraDiaMes('1'), '1');
  assert.equal(mascaraDiaMes('14'), '14');
  assert.equal(mascaraDiaMes('140'), '14/0');
  assert.equal(mascaraDiaMes('1403'), '14/03');
  assert.equal(mascaraDiaMes('14032027'), '14/03/2027');
  assert.equal(mascaraDiaMes('14/03'), '14/03');
  assert.equal(mascaraDiaMes('140320279'), '14/03/2027');
});

test('dia e mês assumem o ano de hoje', () => {
  assert.equal(dataDeDiaMes('14/03', '2026-02-01'), '2026-03-14');
  assert.equal(dataDeDiaMes('1403', '2026-02-01'), '2026-03-14');
});

test('hoje ainda é este ano', () => {
  assert.equal(dataDeDiaMes('14/03', '2026-03-14'), '2026-03-14');
});

test('data que já passou vai para o ano seguinte', () => {
  assert.equal(dataDeDiaMes('10/02', '2026-12-05'), '2027-02-10');
});

test('oito dígitos dizem o ano', () => {
  assert.equal(dataDeDiaMes('14/03/2028', '2026-02-01'), '2028-03-14');
});

test('dia que não existe é null', () => {
  assert.equal(dataDeDiaMes('31/02', '2026-01-01'), null);
  assert.equal(dataDeDiaMes('00/05', '2026-01-01'), null);
  assert.equal(dataDeDiaMes('10/13', '2026-01-01'), null);
  assert.equal(dataDeDiaMes('31/04/2026', '2026-01-01'), null);
});

test('29/02 só existe em ano bissexto', () => {
  assert.equal(dataDeDiaMes('29/02', '2028-01-10'), '2028-02-29');
  assert.equal(dataDeDiaMes('29/02', '2027-01-10'), '2028-02-29');   // 2027 não tem; 2028 tem
  assert.equal(dataDeDiaMes('29/02', '2025-01-10'), null);           // nem 2025 nem 2026
});

test('texto incompleto é null', () => {
  assert.equal(dataDeDiaMes('', '2026-01-01'), null);
  assert.equal(dataDeDiaMes('14/0', '2026-01-01'), null);
  assert.equal(dataDeDiaMes('14/03/20', '2026-01-01'), null);
});

test('diaMesDe devolve dd/mm', () => {
  assert.equal(diaMesDe('2026-03-14'), '14/03');
  assert.equal(diaMesDe(''), '');
});
