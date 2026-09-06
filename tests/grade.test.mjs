import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posicaoNaBarra, marcasDaBarra, lacunasCobertura, JANELA_FABRICA } from '../src/modules/horarios/grade.model.js';
import { paraMin } from '../src/modules/horarios/horarios.model.js';

const J1 = { ini: paraMin('07:00'), fim: paraMin('18:20') };  // fábrica
const J2 = { ini: paraMin('07:00'), fim: paraMin('17:00') };  // CEI

test('JANELA_FABRICA é 07:00–18:20', () => {
  assert.deepEqual(JANELA_FABRICA, J1);
});

test('posicaoNaBarra: o mesmo bloco ocupa mais da barra numa janela menor', () => {
  const b = { inicio: '07:00', fim: '12:00' };
  assert.ok(posicaoNaBarra(b, J2).largura > posicaoNaBarra(b, J1).largura);
});

test('marcasDaBarra: a última marca não passa do fim da janela', () => {
  const m = marcasDaBarra(J2);
  assert.equal(m[m.length - 1].hora.slice(0, 5), '17:00');
});

test('lacunasCobertura: janela menor, lacuna final menor', () => {
  const blocos = [{ inicio: '07:00', fim: '13:00' }];
  const g1 = lacunasCobertura(blocos, J1);
  const g2 = lacunasCobertura(blocos, J2);
  assert.equal(g2[g2.length - 1].fim, J2.fim);
  assert.ok(g1[g1.length - 1].fim > g2[g2.length - 1].fim);
});

test('sem janela = comportamento de fábrica', () => {
  const b = { inicio: '07:00', fim: '12:00' };
  assert.deepEqual(posicaoNaBarra(b), posicaoNaBarra(b, J1));
  assert.deepEqual(marcasDaBarra(), marcasDaBarra(J1));
});
