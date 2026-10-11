import test from 'node:test';
import assert from 'node:assert/strict';
import { pascoa, feriadosNacionais, montarAno } from '../src/modules/calendario/anoletivo.model.js';

test('pascoa: datas conhecidas', () => {
  assert.equal(pascoa(2026), '2026-04-05');
  assert.equal(pascoa(2027), '2027-03-28');
});

test('feriadosNacionais: móveis a partir da Páscoa, Consciência Negra só desde 2024', () => {
  const f = Object.fromEntries(feriadosNacionais(2026).map(x => [x.nome, x.data]));
  assert.equal(f['Sexta-feira Santa'], '2026-04-03');
  assert.equal(f['Carnaval (terça)'], '2026-02-17');
  assert.equal(f['Corpus Christi'], '2026-06-04');
  assert.equal(f['Consciência Negra'], '2026-11-20');
  assert.ok(!feriadosNacionais(2023).some(x => x.nome === 'Consciência Negra'));
});

test('montarAno: fins de semana, feriado, recesso e extra; letivo comum não vira linha', () => {
  // 2026-10-05 é segunda; 10 e 11 são sábado e domingo.
  const { linhas, resumo } = montarAno({
    inicio: '2026-10-05', fim: '2026-10-18',
    feriados: [{ data: '2026-10-12', nome: 'Aparecida' }],
    recessos: [{ de: '2026-10-14', ate: '2026-10-14', nome: 'Recesso' }],
    extras: [{ data: '2026-10-17', nome: 'Reposição' }],
  });
  const por = Object.fromEntries(linhas.map(l => [l.data, l]));
  assert.equal(por['2026-10-10'].letivo, false);
  assert.equal(por['2026-10-11'].letivo, false);
  assert.equal(por['2026-10-12'].evento, 'Aparecida');
  assert.equal(por['2026-10-14'].tipo, 'recesso');
  assert.equal(por['2026-10-17'].letivo, true);   // sábado letivo de reposição
  assert.equal(por['2026-10-06'], undefined);
  assert.equal(resumo.letivos, 9);   // 5 a 9 (5) + 13, 15, 16 (3) + o sábado de reposição
});

test('montarAno: recesso em parte vira dia letivo com faixa; extra em recesso vence', () => {
  const { linhas, resumo } = montarAno({
    inicio: '2026-07-06', fim: '2026-07-07',
    recessos: [{ de: '2026-07-06', ate: '2026-07-07', nome: 'Recesso', aulaDe: '13:00', aulaAte: '17:00' }],
    extras: [{ data: '2026-07-07', nome: 'Reposição' }],
  });
  const por = Object.fromEntries(linhas.map(l => [l.data, l]));
  assert.deepEqual([por['2026-07-06'].letivo, por['2026-07-06'].letivo_de, por['2026-07-06'].letivo_ate], [true, '13:00', '17:00']);
  assert.equal(por['2026-07-07'].letivo_de, null);   // o extra inteiro desfaz a faixa
  assert.equal(resumo.letivos, 2);
  assert.equal(resumo.parciais, 1);
});

test('montarAno: preserva o que já está registrado; sem faixa as colunas nem entram', () => {
  const { linhas, resumo } = montarAno({
    inicio: '2026-10-10', fim: '2026-10-11',
    existentes: { '2026-10-10': { letivo: true, evento: 'Reposição' } },
  });
  assert.equal(linhas.length, 1);          // só o domingo
  assert.equal('letivo_de' in linhas[0], false);
  assert.equal(resumo.preservados, 1);
  assert.equal(resumo.letivos, 1);         // o sábado mantido como letivo
  const sobrescreve = montarAno({ inicio: '2026-10-10', fim: '2026-10-11', existentes: { '2026-10-10': { letivo: true } }, preservar: false });
  assert.equal(sobrescreve.linhas.length, 2);
});

test('montarAno: ao substituir, dia registrado como não letivo que vira letivo é redefinido', () => {
  // 2026-10-06 é terça: o registro antigo dizia "não letivo"; sem preservar, passa a letivo.
  const antigo = { '2026-10-06': { letivo: false, evento: 'Teste', letivo_de: null, letivo_ate: null } };
  const { linhas, resumo } = montarAno({ inicio: '2026-10-06', fim: '2026-10-06', existentes: antigo, preservar: false });
  assert.equal(linhas.length, 1);
  assert.deepEqual([linhas[0].letivo, linhas[0].evento, linhas[0].letivo_de], [true, null, null]);
  assert.equal(resumo.letivos, 1);
  // Preservando, o registro antigo manda.
  assert.equal(montarAno({ inicio: '2026-10-06', fim: '2026-10-06', existentes: antigo }).resumo.letivos, 0);
});

test('montarAno: período inválido', () => {
  assert.throws(() => montarAno({ inicio: '2026-10-10', fim: '2026-10-01' }), /Informe/);
  assert.throws(() => montarAno({ inicio: '2026-01-01', fim: '2027-12-31' }), /400/);
});
