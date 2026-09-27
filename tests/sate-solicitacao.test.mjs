import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodoDe, tituloDoPedido, responsavelDoPedido, PERIODOS, alocarFichas } from '../src/modules/sate/regras.model.js';
import { JANELA, TIPICO, trajetoParaVaga, intervaloDaViagem } from '../src/modules/sate/disponibilidade.model.js';
import { enderecoCompleto, locaisParecidos } from '../src/modules/locais/locais.model.js';
import { localAConferir } from '../src/modules/sate/sate.model.js';

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
