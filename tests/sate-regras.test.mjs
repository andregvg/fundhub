import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarPedido } from '../src/modules/sate/regras.model.js';

const base = {
  periodo: 'tarde', qtdAlunos: 60, qtdCadeirantes: 0, livres: 9, livresVan: 0, totalDia: 9,
  diasDeAntecedencia: 10, horarioEmbarque: '13:00', horarioRetorno: '17:00',
  capacidadeOnibus: 44, capacidadeVan: 2, antecedenciaMin: 5,
};
const codigos = (l) => l.map(x => x.codigo);

test('cabe: sem erro nem aviso, 2 ônibus', () => {
  const r = avaliarPedido(base);
  assert.deepEqual([r.erros, r.avisos, r.onibus], [[], [], 2]);
});
test('dia sem frota barra a escola E quem aprova', () => {
  assert.deepEqual(codigos(avaliarPedido({ ...base, totalDia: 0, livres: 0 }).erros), ['sem_frota_dia']);
  assert.deepEqual(codigos(avaliarPedido({ ...base, totalDia: 0, livres: 0, aprovador: true }).erros), ['sem_frota_dia']);
});
test('falta de ônibus: erro para a escola, com o próximo horário', () => {
  const r = avaliarPedido({ ...base, livres: 1, proximo: 850 });
  assert.deepEqual(codigos(r.erros), ['sem_frota']);
  assert.match(r.erros[0].texto, /14:10/);
});
test('falta de ônibus: aviso para quem aprova', () => {
  const r = avaliarPedido({ ...base, livres: 1, aprovador: true });
  assert.deepEqual([codigos(r.erros), codigos(r.avisos)], [[], ['sem_frota']]);
});
test('horários obrigatórios', () => {
  assert.ok(codigos(avaliarPedido({ ...base, horarioRetorno: null }).erros).includes('sem_horario'));
});
test('retorno antes do embarque é erro (fora da noite)', () => {
  assert.ok(codigos(avaliarPedido({ ...base, horarioRetorno: '12:00' }).erros).includes('horarios'));
  assert.ok(!codigos(avaliarPedido({ ...base, periodo: 'noite', horarioEmbarque: '19:00', horarioRetorno: '00:30' }).erros).includes('horarios'));
});
test('cadeirante sem van é sempre aviso', () => {
  const r = avaliarPedido({ ...base, qtdCadeirantes: 1, livresVan: 0 });
  assert.deepEqual([codigos(r.erros), codigos(r.avisos)], [[], ['sem_van']]);
});
test('atividade que não usa ônibus não pede frota', () => {
  const r = avaliarPedido({ ...base, usaOnibus: false, totalDia: 0, livres: 0 });
  assert.deepEqual([codigos(r.erros), r.onibus], [[], 0]);
});
test('antecedência só barra a escola', () => {
  assert.ok(codigos(avaliarPedido({ ...base, diasDeAntecedencia: 2 }).erros).includes('antecedencia'));
  assert.ok(!codigos(avaliarPedido({ ...base, diasDeAntecedencia: 2, aprovador: true }).erros).includes('antecedencia'));
});
