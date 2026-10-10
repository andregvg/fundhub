import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodoDe, tituloDoPedido, responsavelDoPedido, PERIODOS, alocarFichas } from '../src/modules/sate/regras.model.js';
import { JANELA, TIPICO, trajetoParaVaga, intervaloDaViagem } from '../src/modules/sate/disponibilidade.model.js';
import { enderecoCompleto, locaisParecidos, localNoEndereco } from '../src/modules/locais/locais.model.js';
import { localAConferir, acoesDoPedido, alteracaoDeReabertura } from '../src/modules/sate/sate.model.js';
import { resumoEscolas } from '../src/modules/sate/participacoes.model.js';

test('periodoDe: manhã, integral, tarde, noite', () => {
  assert.equal(periodoDe('07:30', '11:00'), 'manha');
  assert.equal(periodoDe('07:30', '12:00'), 'manha');
  assert.equal(periodoDe('08:00', '15:00'), 'integral');
  assert.equal(periodoDe('12:00', '17:00'), 'tarde');
  assert.equal(periodoDe('13:00', '19:30'), 'tarde');
  assert.equal(periodoDe('18:00', '22:00'), 'noite');
  assert.equal(periodoDe('19:00', '00:30'), 'noite');
});

test('periodoDe: sem embarque não há período', () => {
  assert.equal(periodoDe('', '10:00'), null);
  assert.equal(periodoDe(null, null), null);
  assert.equal(periodoDe('07:00', ''), 'manha');
});

test('PERIODOS tem rótulo para integral', () => {
  assert.equal(PERIODOS.integral, 'Manhã e tarde');
});

test('integral ocupa manhã e tarde', () => {
  assert.deepEqual(JANELA.integral, [0, 1080]);
  assert.deepEqual(TIPICO.integral, [420, 1080]);
  const iv = intervaloDaViagem({ periodo: 'integral', embarque: '08:00', retorno: '15:00', trajetoMin: 30, intervaloMin: 0 });
  assert.deepEqual(iv, { ini: 480, fim: 930 });
});

test('trajetoParaVaga: gravado vence; sem trajeto gravado usa o provisório, com ou sem local', () => {
  assert.equal(trajetoParaVaga({ trajeto_min: 25, local_id: null }, 60), 25);
  assert.equal(trajetoParaVaga({ trajeto_min: null, local_id: null }, 60), 60);
  assert.equal(trajetoParaVaga({ trajeto_min: null, local_id: 'x' }, 60), 60);
});

test('tituloDoPedido: atividade, livre, destino, padrão', () => {
  assert.equal(tituloDoPedido({ atividade: { nome: 'Visita' } }), 'Visita');
  assert.equal(tituloDoPedido({ atividade_livre: 'Teatro' }), 'Teatro');
  assert.equal(tituloDoPedido({ destino_nome: 'Museu Exemplo' }), 'Museu Exemplo');
  assert.equal(tituloDoPedido({}), 'Solicitação de transporte');
});

test('responsavelDoPedido: campos novos, com queda no contato antigo', () => {
  assert.equal(responsavelDoPedido({ professor_nome: 'Prof. Exemplo', professor_telefone: '+5500000000000' }).startsWith('Prof. Exemplo · '), true);
  assert.equal(responsavelDoPedido({ professor_nome: 'Prof. Exemplo' }), 'Prof. Exemplo');
  assert.equal(responsavelDoPedido({ contato_professor: 'Fulano (00) 0000-0000' }), 'Fulano (00) 0000-0000');
  assert.equal(responsavelDoPedido({}), '');
});

test('enderecoCompleto junta e omite o que falta', () => {
  assert.equal(enderecoCompleto({ endereco: 'Rua Exemplo', numero: '123', bairro: 'Centro' }), 'Rua Exemplo, 123 - Centro');
  assert.equal(enderecoCompleto({ endereco: 'Rua Exemplo', bairro: 'Centro' }), 'Rua Exemplo - Centro');
  assert.equal(enderecoCompleto({ endereco: 'Rua Exemplo, 10 - Centro' }), 'Rua Exemplo, 10 - Centro');
  assert.equal(enderecoCompleto({ endereco: '  ', numero: '', bairro: null }), '');
  assert.equal(enderecoCompleto(null), '');
});

test('locaisParecidos: nome sem acento e sem artigo casa; bairro igual casa', () => {
  const locais = [
    { id: '1', nome: 'Theatro Exemplo', bairro: 'Centro', ativo: true },
    { id: '2', nome: 'Museu Exemplo', bairro: 'Jardim', ativo: true },
    { id: '3', nome: 'Parque Alfa', bairro: 'Centro', ativo: true },
    { id: '4', nome: 'Teatro Exemplo Antigo', bairro: 'Vila', ativo: false },
  ];
  const r = locaisParecidos({ nome: 'teatro exemplo', bairro: 'centro' }, locais).map(l => l.id);
  assert.equal(r[0], '1');                 // nome + bairro vem primeiro
  assert.ok(r.includes('3'));              // só bairro
  assert.ok(!r.includes('4'));             // inativo fica de fora
  assert.deepEqual(locaisParecidos({ nome: '', bairro: '' }, locais), []);
});

test('localAConferir: destino digitado sem local cadastrado', () => {
  assert.equal(localAConferir({ destino_nome: 'Museu Exemplo', local_id: null }), true);
  assert.equal(localAConferir({ destino_nome: 'Museu Exemplo', local_id: 'x' }), false);
  assert.equal(localAConferir({ atividade_id: 'a' }), false);
});

test('alocarFichas ordena integral junto da manhã', () => {
  const f = alocarFichas([
    { id: 'a', periodo: 'tarde', horario_embarque: '13:00', qtd_onibus: 1, qtd_alunos: 10 },
    { id: 'b', periodo: 'integral', horario_embarque: '08:00', qtd_onibus: 1, qtd_alunos: 10 },
  ], { capacidade: 44 });
  assert.equal(f[0].solicitacao.id, 'b');
});

test('locaisParecidos: tolera erro de digitação no nome', () => {
  const locais = [
    { id: '1', nome: 'Museu Exemplo', bairro: 'Centro', ativo: true },
    { id: '2', nome: 'Parque Distante', bairro: 'Jardim', ativo: true },
  ];
  const r = locaisParecidos({ nome: 'Muzeu Exenplo', bairro: '' }, locais).map(l => l.id);
  assert.deepEqual(r, ['1']);
});

test('localNoEndereco: mesma rua e número, sem acento, caixa ou abreviação', () => {
  const locais = [
    { id: '1', nome: 'Museu Exemplo', endereco: 'Rua São Exemplo', numero: '100', ativo: true },
    { id: '2', nome: 'Parque Exemplo', endereco: 'Avenida Exemplo', numero: '20', ativo: true },
    { id: '3', nome: 'Antigo Exemplo', endereco: 'Rua Velha Exemplo', numero: '5', ativo: false },
  ];
  assert.equal(localNoEndereco('r. sao exemplo', '100', locais)?.id, '1');
  assert.equal(localNoEndereco('Av Exemplo', ' 20 ', locais)?.id, '2');
  assert.equal(localNoEndereco('Rua São Exemplo', '101', locais), null);
  assert.equal(localNoEndereco('Rua Velha Exemplo', '5', locais), null);   // inativo
  assert.equal(localNoEndereco('', '100', locais), null);
  assert.equal(localNoEndereco('Rua São Exemplo', '', locais), null);
});

// ── O que cabe em cada situação (spec 2026-10-10-sate-solicitacao, D4 e D5) ──
const ap = { aprovador: true };
const esc_ = { aprovador: false };
const dec = (status, quem) => acoesDoPedido({ status }, quem).decisoes;

test('acoesDoPedido: quem aprova, por situação', () => {
  assert.deepEqual(dec('solicitado', ap), ['analisar', 'negar', 'confirmar']);
  assert.deepEqual(dec('em_analise', ap), ['negar', 'confirmar']);
  assert.deepEqual(dec('aguardando_transporte_adaptado', ap), ['negar', 'confirmar']);
  assert.deepEqual(dec('confirmado', ap), ['reabrir', 'cancelar']);
  assert.deepEqual(dec('pendente_cancelamento', ap), ['ciencia']);
  assert.deepEqual(dec('negado', ap), ['reabrir']);
  assert.deepEqual(dec('cancelado', ap), ['reabrir']);
});

test('acoesDoPedido: a escola só cancela ou pede cancelamento', () => {
  assert.deepEqual(dec('solicitado', esc_), ['cancelar']);
  assert.deepEqual(dec('confirmado', esc_), ['pedir']);
  for (const st of ['em_analise', 'aguardando_transporte_adaptado', 'pendente_cancelamento', 'negado', 'cancelado']) {
    assert.deepEqual(dec(st, esc_), [], st);
  }
});

test('acoesDoPedido: editar só quem aprova, e só antes de confirmar', () => {
  for (const st of ['solicitado', 'em_analise', 'aguardando_transporte_adaptado']) {
    assert.equal(acoesDoPedido({ status: st }, ap).editar, true, st);
    assert.equal(acoesDoPedido({ status: st }, esc_).editar, false, st);
  }
  for (const st of ['confirmado', 'pendente_cancelamento', 'negado', 'cancelado']) {
    assert.equal(acoesDoPedido({ status: st }, ap).editar, false, st);
  }
});

test('acoesDoPedido: vendo como escola, nada', () => {
  assert.deepEqual(acoesDoPedido({ status: 'solicitado' }, { aprovador: true, somenteLeitura: true }),
    { editar: false, decisoes: [] });
});

test('alteracaoDeReabertura volta para análise e limpa a decisão', () => {
  assert.deepEqual(alteracaoDeReabertura('2026-10-10T12:00:00.000Z'), {
    status: 'em_analise', motivo: null, decidido_por: null, decidido_em: null,
    atualizado_em: '2026-10-10T12:00:00.000Z',
  });
});

// ── A coluna Escolas (spec 2026-10-10-sate-solicitacao, D2) ──
const parte = (nome, apelido, status = 'ativa') => ({ status, unidade: { nome, apelido } });

test('resumoEscolas: nome completo por padrão, apelido no curto', () => {
  const uma = [parte('Escola Municipal Exemplo', 'Exemplo')];
  assert.equal(resumoEscolas(uma), 'Escola Municipal Exemplo');
  assert.equal(resumoEscolas(uma, { curto: true }), 'Exemplo');
});

test('resumoEscolas: várias escolas viram "primeira +N"', () => {
  const tres = [parte('Escola A', 'A'), parte('Escola B', 'B'), parte('Escola C', 'C')];
  assert.equal(resumoEscolas(tres), 'Escola A +2');
  assert.equal(resumoEscolas(tres, { curto: true }), 'A +2');
});

test('resumoEscolas: cancelada não conta, e sem apelido o curto cai no nome', () => {
  assert.equal(resumoEscolas([parte('Escola A', 'A', 'cancelada'), parte('Escola B', null)], { curto: true }), 'Escola B');
  assert.equal(resumoEscolas([]), '');
});
