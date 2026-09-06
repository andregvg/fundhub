import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posicaoNaBarra, marcasDaBarra, lacunasCobertura, janelaDaGrade, JANELA_FABRICA } from '../src/modules/horarios/grade.model.js';
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

// ── janelaDaGrade (D9) ──
test('janelaDaGrade: sem bloco fora, a janela nao muda', () => {
  const blocos = [{ inicio: '08:00', fim: '17:00' }];
  assert.deepEqual(janelaDaGrade(J1, blocos), J1);
});

test('janelaDaGrade: estica para caber o TDC que passa do fim da janela', () => {
  // O horario de quem conduz o TDC vai muito alem do fim da janela da
  // EMEF (18:20). Antes disso a barra era recortada e o trecho sumia.
  const blocos = [{ inicio: '11:10', fim: '20:10' }];
  assert.deepEqual(janelaDaGrade(J1, blocos), { ini: paraMin('07:00'), fim: paraMin('20:10') });
});

test('janelaDaGrade: estica tambem para tras', () => {
  const blocos = [{ inicio: '06:45', fim: '15:45' }];
  assert.deepEqual(janelaDaGrade(J1, blocos), { ini: paraMin('06:45'), fim: paraMin('18:20') });
});

test('janelaDaGrade: lista vazia devolve a janela recebida', () => {
  assert.deepEqual(janelaDaGrade(J2, []), J2);
  assert.deepEqual(janelaDaGrade(J2, undefined), J2);
});

test('janelaDaGrade: uma regua so para o pior caso da semana', () => {
  // A regua e UMA por grade: dias com reguas diferentes deixam de ser
  // comparaveis, que e o motivo de a grade existir.
  const blocos = [{ inicio: '07:00', fim: '12:00' }, { inicio: '14:00', fim: '23:00' }];
  assert.equal(janelaDaGrade(J1, blocos).fim, paraMin('23:00'));
});

test('posicaoNaBarra: um bloco que cabe na regua ocupa ate o fim dela', () => {
  const bloco = { inicio: '11:10', fim: '20:10' };
  const regua = janelaDaGrade(J1, [bloco]);
  const p = posicaoNaBarra(bloco, regua);
  assert.equal(Math.round(p.esquerda + p.largura), 100);
});

test('posicaoNaBarra nao devolve mais a flag forade', () => {
  // Ela era calculada e nenhuma view a lia - o trecho fora da janela
  // sumia da tela sem aviso. Com a regua de D9 ela seria sempre false.
  assert.ok(!('forade' in posicaoNaBarra({ inicio: '08:00', fim: '12:00' }, J1)));
});
