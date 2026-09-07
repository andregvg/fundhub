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

// ── Regressão: régua (desenho) x janela configurada (regra, D9) ──────
// A régua estica para caber um TDC que passa do fim da janela (uma
// EMEF fecha 18:20, o TDC de quarta vai a 20:10). `lacunasCobertura`
// não pode usar a régua esticada para calcular a lacuna - senão um dia
// SEM TDC nenhum (segunda) ganha uma lacuna fantasma só porque a
// quarta esticou a régua da semana inteira.
const JANELA_CONFIGURADA = { ini: paraMin('07:00'), fim: paraMin('18:20') };
const REGUA_ESTICADA = { ini: paraMin('07:00'), fim: paraMin('20:10') }; // esticada pelo TDC de quarta até 20:10

const DIAS_SEG = [{ n: 2, curto: 'Seg', nome: 'Segunda' }];

// Segunda cobre a janela configurada inteira (07:00-18:20), sem TDC -
// não deveria sobrar lacuna nenhuma, mesmo com a régua esticada.
const blocosSegundaCobertaInteira = (servidorId) => {
  if (servidorId === 's1') return [B('s1', '07:00', '15:00')];
  if (servidorId === 's2') return [B('s2', '15:00', '18:20')];
  return [];
};

test('lacuna de cobertura é CALCULADA com a janela configurada, não com a régua esticada (regressão)', () => {
  const html = gradeHtml(DIAS_SEG, {
    linhas, blocosDe: blocosSegundaCobertaInteira, mostrarCobertura: true,
    janela: REGUA_ESTICADA, janelaCobertura: JANELA_CONFIGURADA, subLinhas: [], blocosDeEscala: null,
  });
  assert.ok(!html.includes('hg-lacuna'),
    'segunda cobre 07:00-18:20 por inteiro; não pode aparecer "Sem ninguém entre 18:20 e 20:10" só porque a quarta esticou a régua');
});

// Mesmo cenário, mas com um buraco real DENTRO da janela configurada
// (15:00-18:20, ninguém presente) - a lacuna existe de verdade e tem
// que ser POSICIONADA contra a régua esticada (07:00-20:10), não
// contra a janela configurada (07:00-18:20), senão ela desenha no
// lugar errado assim que a régua estica.
const blocosSegundaComBuraco = (servidorId) => {
  if (servidorId === 's1') return [B('s1', '07:00', '15:00')];
  return [];
};

test('lacuna real é POSICIONADA contra a régua esticada, não contra a janela configurada', () => {
  const html = gradeHtml(DIAS_SEG, {
    linhas, blocosDe: blocosSegundaComBuraco, mostrarCobertura: true,
    janela: REGUA_ESTICADA, janelaCobertura: JANELA_CONFIGURADA, subLinhas: [], blocosDeEscala: null,
  });
  // Lacuna calculada (com a janela CONFIGURADA): 15:00 (900min) a
  // 18:20 (1100min) - fora daí a segunda está descoberta na régua
  // (20:10) também, mas isso não é lacuna de COBERTURA (a escola já
  // fechou às 18:20), só ausência de desenho.
  const ini = paraMin('15:00'), fim = paraMin('18:20');
  // Posição calculada à mão sobre a RÉGUA (07:00-20:10 = 790min), não
  // sobre a janela configurada (07:00-18:20 = 680min) - os dois dão
  // números bem diferentes (60.76% x 70.59%), o suficiente para o
  // teste falhar se `janelaCobertura` for ignorada na posição.
  const esquerda = ((ini - REGUA_ESTICADA.ini) / (REGUA_ESTICADA.fim - REGUA_ESTICADA.ini)) * 100;
  const largura = ((fim - ini) / (REGUA_ESTICADA.fim - REGUA_ESTICADA.ini)) * 100;
  assert.ok(html.includes(`left:${esquerda}%;width:${largura}%`),
    'a lacuna 15:00-18:20 deve estar na posição que a régua (07:00-20:10) implica');
});
