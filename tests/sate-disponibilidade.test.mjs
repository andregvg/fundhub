import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  intervaloDaViagem, montarLinha, livresPara, escadaDaTarde, proximoHorario,
  faltaParaConfirmar, livresNoPeriodo, totalDoDia,
} from '../src/modules/sate/disponibilidade.model.js';

const frota = (...porDia) => porDia.map((onibus, dia) => ({ dia, onibus, vans: 0 }));
const oc = (ini, fim, onibus, dia = 0) => ({ dia, ini, fim, onibus, vans: 0 });
const linha = (f, o = [], intervalo_min = 120) => montarLinha({ intervalo_min, frota: f, ocupacoes: o });

// ── A tabela de casos da spec B (a mesma da conferência da 042) ──
test('vazio: toda a frota está livre', () => {
  assert.equal(livresPara(linha(frota(9)), 780, 1020), 9);
});
test('ônibus da manhã que volta tarde bloqueia o embarque cedo', () => {
  assert.equal(livresPara(linha(frota(9), [oc(420, 850, 6)]), 780, 1020), 3);
});
test('intervalo semiaberto: liberado às 14h10 serve o embarque das 14h10', () => {
  assert.equal(livresPara(linha(frota(9), [oc(420, 850, 6)]), 850, 1020), 9);
});
test('degrau: vale o pior momento dentro do pedido', () => {
  assert.equal(livresPara(linha(frota(9), [oc(420, 850, 6), oc(900, 1140, 2)]), 870, 1080), 7);
});
test('a noite ocupa a manhã seguinte', () => {
  assert.equal(livresPara(linha(frota(9, 9), [oc(1140, 2160, 3)]), 1440 + 480, 1440 + 660), 6);
});
test('frota que muda à meia-noite: vale a menor', () => {
  assert.equal(livresPara(linha(frota(9, 4)), 1140, 2160), 4);
});
test('faltaParaConfirmar não conta o próprio pedido (vem excluído do banco)', () => {
  const s = { periodo: 'manha', horario_embarque: '08:00', horario_retorno: '12:00', trajeto_min: 0, qtd_onibus: 9, qtd_vans: 0 };
  assert.deepEqual(faltaParaConfirmar(s, linha(frota(9))), { onibus: 0, vans: 0 });
});
test('faltaParaConfirmar mede o que falta no intervalo do pedido', () => {
  const s = { periodo: 'tarde', horario_embarque: '13:00', horario_retorno: '17:00', trajeto_min: 0, qtd_onibus: 5, qtd_vans: 0 };
  assert.deepEqual(faltaParaConfirmar(s, linha(frota(9), [oc(420, 850, 6)])), { onibus: 2, vans: 0 });
});
// ESPELHO do `least()` de ocupacao_transporte (042): o embarque efetivo é
// o mais cedo entre o do cabeçalho e o das paradas ativas.
test('faltaParaConfirmar usa o embarque da parada mais cedo, não só o do cabeçalho', () => {
  const s = { periodo: 'tarde', horario_embarque: '15:00', horario_retorno: '17:00', trajeto_min: 0, qtd_onibus: 9, qtd_vans: 0 };
  const oc1 = linha(frota(9), [oc(420, 850, 6)]);
  // Sem paradas: o cabeçalho (15:00) já não concorre com a ocupação da manhã.
  assert.deepEqual(faltaParaConfirmar(s, oc1), { onibus: 0, vans: 0 });
  // Com uma parada às 08:00 (dentro da ocupação): o embarque efetivo cai
  // para 08:00 e o pedido passa a concorrer com quem ainda não voltou.
  const paradas = [{ status: 'ativa', horario: '08:00' }];
  assert.deepEqual(faltaParaConfirmar(s, oc1, paradas), { onibus: 6, vans: 0 });
});
test('faltaParaConfirmar ignora parada cancelada e horário inválido', () => {
  const s = { periodo: 'tarde', horario_embarque: '15:00', horario_retorno: '17:00', trajeto_min: 0, qtd_onibus: 9, qtd_vans: 0 };
  const oc1 = linha(frota(9), [oc(420, 850, 6)]);
  const paradas = [{ status: 'cancelada', horario: '08:00' }, { status: 'ativa', horario: '' }];
  assert.deepEqual(faltaParaConfirmar(s, oc1, paradas), { onibus: 0, vans: 0 });
});

// ── intervaloDaViagem (espelho de _sate_intervalo) ──
test('tarde: embarque até retorno + trajeto + intervalo', () => {
  assert.deepEqual(intervaloDaViagem({ periodo: 'tarde', embarque: '13:00', retorno: '17:00', trajetoMin: 30, intervaloMin: 120 }),
    { ini: 780, fim: 1170 });
});
test('noite: nunca libera antes do meio-dia seguinte', () => {
  assert.deepEqual(intervaloDaViagem({ periodo: 'noite', embarque: '19:00', retorno: '22:00', trajetoMin: 30, intervaloMin: 120 }),
    { ini: 1140, fim: 2160 });
});
test('noite com retorno depois da meia-noite', () => {
  assert.deepEqual(intervaloDaViagem({ periodo: 'noite', embarque: '19:00', retorno: '00:30', trajetoMin: 0, intervaloMin: 0 }),
    { ini: 1140, fim: 2160 });
});
test('sem horário: a janela do período', () => {
  assert.deepEqual(intervaloDaViagem({ periodo: 'manha', embarque: null, retorno: null, intervaloMin: 120 }), { ini: 0, fim: 720 });
});
test('retorno antes do embarque (manhã): a janela até o fim do período', () => {
  assert.deepEqual(intervaloDaViagem({ periodo: 'manha', embarque: '10:00', retorno: '09:00', intervaloMin: 120 }), { ini: 600, fim: 720 });
});

// ── Página Disponibilidade ──
test('escada da tarde: só os degraus em que o número sobe', () => {
  const l = linha(frota(9), [oc(420, 850, 6), oc(420, 930, 3)]);
  assert.deepEqual(escadaDaTarde(l, 0), [
    { aPartirDe: 720, livres: 0 }, { aPartirDe: 850, livres: 6 }, { aPartirDe: 930, livres: 9 },
  ]);
});
test('escada de um dia qualquer da semana usa o deslocamento do dia', () => {
  const l = linha(frota(9, 9, 9), [oc(420, 850, 6, 2)]);
  assert.deepEqual(escadaDaTarde(l, 2), [{ aPartirDe: 720, livres: 3 }, { aPartirDe: 850, livres: 9 }]);
});
test('livresNoPeriodo usa a janela típica', () => {
  const l = linha(frota(9), [oc(420, 850, 6)]);
  assert.equal(livresNoPeriodo(l, 0, 'manha'), 3);
  assert.equal(totalDoDia(l, 0), 9);
});
test('proximoHorario acha o primeiro embarque em que cabe', () => {
  const l = linha(frota(9), [oc(420, 850, 6)]);
  assert.equal(proximoHorario(l, { ini: 780, fim: 1020, precisa: 5, periodo: 'tarde' }), 850);
  assert.equal(proximoHorario(l, { ini: 780, fim: 1020, precisa: 10, periodo: 'tarde' }), null);
});
