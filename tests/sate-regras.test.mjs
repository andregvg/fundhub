import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarPedido, chaveDestino, agruparDestinos } from '../src/modules/sate/regras.model.js';

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

// ── Conferir local por LUGAR (spec 2026-10-10-sate-endereco-e-cep, D8) ──
const ped = (id, nome, endereco, numero, extra = {}) => ({
  id, destino_nome: nome, destino_endereco: endereco, destino_numero: numero,
  destino_bairro: 'Centro', destino_cep: null, ...extra,
});

test('agruparDestinos junta o mesmo lugar escrito de jeitos diferentes', () => {
  const g = agruparDestinos([
    ped('a', 'Teatro Exemplo', 'Rua Exemplo', '100'),
    ped('b', 'TEATRO EXEMPLO ', 'rua  exemplo', '100', { destino_bairro: 'Outro' }),
    ped('c', 'Téatro Exemplo', 'Rua Exemplo.', '100'),
  ]);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].pedidos.map(p => p.id), ['a', 'b', 'c']);
  assert.equal(g[0].nome, 'Teatro Exemplo');
});

test('agruparDestinos separa lugares diferentes na mesma rua', () => {
  const g = agruparDestinos([
    ped('a', 'Teatro Exemplo', 'Rua Exemplo', '100'),
    ped('b', 'Museu Exemplo', 'Rua Exemplo', '100'),
    ped('c', 'Teatro Exemplo', 'Rua Exemplo', '200'),
  ]);
  assert.equal(g.length, 3);
});

test('agruparDestinos aproveita o CEP de quem informou e ordena por nome', () => {
  const g = agruparDestinos([
    ped('a', 'Teatro Exemplo', 'Rua Exemplo', '100'),
    ped('b', 'Museu Exemplo', 'Rua Modelo', '5'),
    ped('c', 'Teatro Exemplo', 'Rua Exemplo', '100', { destino_cep: '00000000' }),
  ]);
  assert.deepEqual(g.map(x => x.nome), ['Museu Exemplo', 'Teatro Exemplo']);
  assert.equal(g[1].cep, '00000000');
});

test('agruparDestinos ignora pedido sem destino digitado', () => {
  assert.deepEqual(agruparDestinos([{ id: 'x', destino_nome: null }]), []);
  assert.deepEqual(agruparDestinos(null), []);
});

test('chaveDestino não depende de bairro nem de CEP', () => {
  assert.equal(
    chaveDestino(ped('a', 'Teatro', 'Rua A', '1')),
    chaveDestino(ped('b', 'Teatro', 'Rua A', '1', { destino_bairro: 'X', destino_cep: '00000000' })));
});
