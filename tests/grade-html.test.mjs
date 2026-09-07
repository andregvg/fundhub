import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeHtml } from '../src/modules/horarios/views/grade.js';
import { paraMin } from '../src/modules/horarios/horarios.model.js';

const J = { ini: paraMin('07:00'), fim: paraMin('20:10') };
const DIAS_QUA = [{ n: 3, curto: 'Qua', nome: 'Quarta' }];

const linhas = [
  { servidor: { id: 's1', nome: 'Gestor 1' }, cargo: 'Gestor(a)', serie: 0, contaCobertura: true },
  { servidor: { id: 's2', nome: 'Gestor 2' }, cargo: 'Gestor(a)', serie: 1, contaCobertura: true },
];

const B = (servidor_id, inicio, fim) => ({ id: `${servidor_id}-${inicio}`, servidor_id, inicio, fim, dia_semana: 3 });

// Variante 1 cobre 07:00-20:10; variante 2 deixa um buraco no fim.
const porVariante = {
  1: { s1: [B('s1', '11:10', '20:10')], s2: [B('s2', '07:00', '15:45')] },
  2: { s1: [B('s1', '07:00', '15:45')], s2: [B('s2', '11:10', '17:00')] },
};

const blocosDeEscala = (id, dia, escala, variante) => porVariante[variante]?.[id] || [];
const blocosDe = () => [];

const subLinhas = [
  { dia: 3, escala: 'tdc-presencial', variante: 1, rotulo: 'TDC Presencial · quando Gestor 1 conduz' },
  { dia: 3, escala: 'tdc-presencial', variante: 2, rotulo: 'TDC Presencial · variante 2' },
];

test('cada variante vira uma sub-linha propria', () => {
  const html = gradeHtml(DIAS_QUA, { linhas, blocosDe, mostrarCobertura: true, janela: J, subLinhas, blocosDeEscala });
  assert.equal(html.split('hg-sublinha').length - 1, 2);
  assert.ok(html.includes('quando Gestor 1 conduz'));
  assert.ok(html.includes('variante 2'));
});

test('cada sub-linha tem tira de cobertura propria (D3, substitui D6.2)', () => {
  const html = gradeHtml(DIAS_QUA, { linhas, blocosDe, mostrarCobertura: true, janela: J, subLinhas, blocosDeEscala });
  // Uma tira do dia regular + uma por sub-linha.
  assert.equal(html.split('hg-cobertura').length - 1, 3);
});

test('a variante com buraco marca lacuna e a outra nao', () => {
  const html = gradeHtml(DIAS_QUA, { linhas, blocosDe, mostrarCobertura: true, janela: J, subLinhas, blocosDeEscala });
  const [, v1, v2] = html.split('hg-sublinha');
  assert.ok(!v1.includes('hg-lacuna'), 'variante 1 cobre a janela inteira');
  assert.ok(v2.includes('hg-lacuna'), 'variante 2 deixa 17:00-20:10 descoberto');
});

test('sem cobertura (a sede da SME), nenhuma tira em lugar nenhum', () => {
  const html = gradeHtml(DIAS_QUA, { linhas, blocosDe, mostrarCobertura: false, janela: J, subLinhas, blocosDeEscala });
  assert.ok(!html.includes('hg-cobertura'));
});
