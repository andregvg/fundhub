// Avisos do SATE: quem recebe o quê, o que conta como não lido e o texto.
// Spec: 2026-10-10-sate-notificacoes-design.md § D3 e D4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  publicoDe, chaveDoAviso, interessa, tiposDeInteresse, ordenarAvisos, descrever, PADRAO_AVISOS,
} from '../src/modules/sate/avisos.model.js';

const EU = 'nome@exemplo.com';
const av = (tipo, extra = {}) => ({ id: 1, solicitacao_id: 's1', tipo, autor: 'outra@exemplo.com', em: '2026-10-10T12:00:00+00:00', ...extra });

test('publicoDe: escrita aprova, leitura só lê, o resto é escola', () => {
  assert.equal(publicoDe('escrita'), 'aprovador');
  assert.equal(publicoDe('leitura'), 'leitor');
  assert.equal(publicoDe('proprios'), 'escola');
  assert.equal(publicoDe('oculto'), 'escola');
});

test('ninguém é avisado do que ele mesmo fez', () => {
  for (const publico of ['aprovador', 'leitor', 'escola']) {
    assert.equal(interessa(av('nova', { autor: EU }), { email: EU, publico, prefs: {} }), false, publico);
    assert.equal(interessa(av('negado', { autor: 'NOME@Exemplo.com' }), { email: EU, publico, prefs: {} }), false, publico);
  }
});

test('quem aprova: pedido novo SEMPRE, mesmo com tudo desligado', () => {
  const prefs = { avisos_pedidos_escola: false, avisos_equipe: false };
  assert.equal(chaveDoAviso('nova', 'aprovador'), null);
  assert.equal(interessa(av('nova'), { email: EU, publico: 'aprovador', prefs }), true);
});

test('quem aprova: pedidos das escolas ligados por padrão, ações da equipe desligadas', () => {
  const ctx = { email: EU, publico: 'aprovador', prefs: {} };
  assert.equal(interessa(av('pendente_cancelamento'), ctx), true);
  assert.equal(interessa(av('saida_pedida'), ctx), true);
  for (const t of ['em_analise', 'confirmado', 'negado', 'cancelado', 'reaberta', 'editada', 'parada_acrescentada', 'saida_confirmada']) {
    assert.equal(interessa(av(t), ctx), false, t);
    assert.equal(interessa(av(t), { ...ctx, prefs: { avisos_equipe: true } }), true, t);
  }
  assert.equal(interessa(av('saida_pedida'), { ...ctx, prefs: { avisos_pedidos_escola: false } }), false);
});

test('escola: decisão e andamento ligados por padrão, cada um desliga o seu', () => {
  const ctx = { email: EU, publico: 'escola', prefs: {} };
  for (const t of ['confirmado', 'negado', 'cancelado']) {
    assert.equal(chaveDoAviso(t, 'escola'), 'avisos_decisao');
    assert.equal(interessa(av(t), ctx), true, t);
    assert.equal(interessa(av(t), { ...ctx, prefs: { avisos_decisao: false } }), false, t);
  }
  for (const t of ['nova', 'em_analise', 'reaberta', 'editada', 'parada_acrescentada', 'saida_confirmada']) {
    assert.equal(chaveDoAviso(t, 'escola'), 'avisos_andamento');
    assert.equal(interessa(av(t), ctx), true, t);
    assert.equal(interessa(av(t), { ...ctx, prefs: { avisos_andamento: false } }), false, t);
  }
});

test('leitor: os avisos da escola, desligados por padrão', () => {
  assert.deepEqual(PADRAO_AVISOS.leitor, { avisos_decisao: false, avisos_andamento: false });
  assert.equal(interessa(av('confirmado'), { email: EU, publico: 'leitor', prefs: {} }), false);
  assert.equal(interessa(av('confirmado'), { email: EU, publico: 'leitor', prefs: { avisos_decisao: true } }), true);
});

test('tiposDeInteresse: quem aprova, preferências padrão', () => {
  const tipos = tiposDeInteresse('aprovador');
  for (const t of ['nova', 'pendente_cancelamento', 'saida_pedida']) assert.ok(tipos.includes(t), t);
  for (const t of ['confirmado', 'negado', 'editada']) assert.ok(!tipos.includes(t), t);
});

test('tiposDeInteresse: quem aprova com tudo desligado só recebe pedido novo', () => {
  assert.deepEqual(tiposDeInteresse('aprovador', { avisos_pedidos_escola: false, avisos_equipe: false }), ['nova']);
});

test('tiposDeInteresse: escola recebe os 14 tipos por padrão e cada chave desliga o seu grupo', () => {
  assert.equal(tiposDeInteresse('escola').length, 14);
  const sem = tiposDeInteresse('escola', { avisos_decisao: false });
  for (const t of ['confirmado', 'negado', 'cancelado']) assert.ok(!sem.includes(t), t);
  assert.ok(sem.includes('em_analise'));
});

test('tiposDeInteresse: leitor não recebe nada por padrão', () => {
  assert.deepEqual(tiposDeInteresse('leitor'), []);
});

test('ordenarAvisos junta os da mesma solicitação, a mais recente em cima', () => {
  const lista = [
    av('nova',       { id: 1, solicitacao_id: 'a', em: '2026-10-10T08:00:00+00:00' }),
    av('nova',       { id: 2, solicitacao_id: 'b', em: '2026-10-10T09:00:00+00:00' }),
    av('confirmado', { id: 3, solicitacao_id: 'a', em: '2026-10-10T10:00:00+00:00' }),
  ];
  assert.deepEqual(ordenarAvisos(lista).map(a => a.id), [3, 1, 2]);
});

test('descrever: título pelo tipo e escola · destino · data', () => {
  const a = av('negado', { solicitacao: { data: '2026-10-14', destino_nome: 'Teatro Exemplo', unidade_id: 'u1' } });
  assert.deepEqual(descrever(a, { u1: 'Escola Exemplo' }), {
    titulo: 'Negado', tipo: 'erro', texto: 'Escola Exemplo · Teatro Exemplo · 14/10/2026',
  });
});

test('descrever: aviso de parada usa a escola da parada; sem escola, a Gerência', () => {
  const a = av('saida_pedida', { unidade_id: 'u2', solicitacao: { data: '2026-10-14', destino_nome: 'Teatro Exemplo', unidade_id: 'u1' } });
  assert.match(descrever(a, { u1: 'Escola Exemplo', u2: 'Escola Modelo' }).texto, /^Escola Modelo · /);
  const b = av('nova', { solicitacao: { data: '2026-10-14', destino_nome: null, unidade_id: null } });
  assert.equal(descrever(b, {}).texto, 'Gerência de Transporte · 14/10/2026');
  assert.equal(descrever(av('tipo_que_nao_existe'), {}).titulo, 'Solicitação atualizada');
});
