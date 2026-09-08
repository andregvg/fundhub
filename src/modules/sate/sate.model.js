// ============================================================
// FundHub - modules/sate/sate.model.js
// Solicitações de transporte: leitura, ciclo de vida e saldo do dia.
// Spec: 2026-09-08-sate-modelo-de-dados-design.md § D4, D5, D8.
//
// A frota mora em `frota.model.js`, as regras puras em `regras.model.js`,
// a conta de vagas em `saldo.model.js` e as escolas de cada viagem em
// `participacoes.model.js` - os cinco são API pública do módulo. Aqui
// fica a VIAGEM: ler, criar e mover no ciclo de vida.
//
// `qtd_alunos` e `qtd_cadeirante` no cabeçalho são CACHE da soma das
// participações ativas, mantido por gatilho (migration 037). Nunca
// escrever esses campos daqui: a verdade é a participação.
//
// O saldo saiu daqui em 08/09/2026, quando o arquivo passou do teto de
// 250 linhas (R11). Não foi corte arbitrário para caber: "quantos
// veículos estão livres" é um agregado próprio, que lê a frota E as
// solicitações e não pertence a nenhuma das duas.
//
// O que mudou do v1: negar e cancelar deixaram de ser a mesma coisa,
// justificativa é obrigatória nos dois (CHECK no banco, não só na tela),
// e o saldo passou a ser DO DIA - a frota é de veículos, não uma cota
// por período (§ D4).
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { subscribeTabela } from '../../shared/realtime.js';
import { agoraISO } from '../../shared/format.js';

export const PERIODOS = Object.freeze({ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' });

export const STATUS = Object.freeze({
  solicitado: 'Solicitado',
  em_analise: 'Em análise',
  aguardando_transporte_adaptado: 'Aguardando adaptado',
  confirmado: 'Confirmado',
  pendente_cancelamento: 'Pendente de cancelamento',
  negado: 'Negado',
  cancelado: 'Cancelado',
});

// Status que OCUPAM veículo. `pendente_cancelamento` fica de fora de
// propósito: a vaga volta ao saldo no momento em que a escola pede, não
// no da ciência - é o que o agendamentos-fil faz, e segurar um ônibus
// por causa de uma formalidade desperdiça frota.
export const STATUS_RESERVA = Object.freeze(['em_analise', 'aguardando_transporte_adaptado', 'confirmado']);

const SELECT_BASE =
  '*, atividade:atividade_extraclasse(nome,cor,usa_onibus,local_nome,local_endereco,gerida_sme),'
  + ' unidade:unidade_escolar(nome,apelido,endereco)';

const ausente = (err) => err?.code === '42P01' || err?.code === '42703';

// ── Leitura ──────────────────────────────────────────────────
export async function listSolicitacoes({ status, de, ate, unidadeId } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('solicitacao_transporte').select(SELECT_BASE).order('data', { ascending: false });
  if (status) q = Array.isArray(status) ? q.in('status', status) : q.eq('status', status);
  if (de) q = q.gte('data', de);
  if (ate) q = q.lte('data', ate);
  if (unidadeId) q = q.eq('unidade_id', unidadeId);
  const { data, error } = await q;
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
}

export async function getSolicitacaoPorId(id) {
  if (!hasSupabase()) return null;
  const { data, error } = await sb().from('solicitacao_transporte')
    .select(SELECT_BASE).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Solicitações de um dia (Dashboard).
export async function getSolicitacoesDoDia(dataISO) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_transporte')
    .select(SELECT_BASE).eq('data', dataISO).order('periodo');
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
}

// Programação do dia: só as confirmadas, com origem e destino (Viagens).
export async function getViagensDoDia(dataISO) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_transporte')
    .select(SELECT_BASE).eq('data', dataISO).eq('status', 'confirmado').order('periodo');
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
}

// ── Escrita ──────────────────────────────────────────────────
// Criar viagem é UM ato que nasce em duas tabelas - o cabeçalho e a
// participação da escola que pediu. Vai por RPC porque, em duas chamadas
// do PostgREST, uma falha no meio deixaria uma viagem sem ninguém
// dentro: visível só para quem escreve, com zero alunos, e sem nada na
// tela explicando de onde veio.
export async function criarSolicitacao(viagem, participacao) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data, error } = await sb().rpc('criar_viagem', {
    p_viagem: viagem, p_participacao: participacao,
  });
  if (error) throw error;
  return data;
}

export async function editarSolicitacao(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('solicitacao_transporte')
    .update({ ...payload, atualizado_em: agoraISO() }).eq('id', id);
  if (error) throw error;
}

// Toda transição passa por aqui: é o único lugar que carimba quem
// decidiu e quando, e o único que sabe quais status exigem motivo.
async function transicionar(id, status, motivo = null) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = { status, atualizado_em: agoraISO() };
  if (motivo != null) patch.motivo = String(motivo).trim();
  if (['confirmado', 'negado', 'cancelado'].includes(status)) {
    patch.decidido_por = await emailAtual();
    patch.decidido_em = agoraISO();
  }
  const { error } = await sb().from('solicitacao_transporte').update(patch).eq('id', id);
  if (error) {
    // 23514 = o CHECK de justificativa. A tela já exige o campo; se
    // chegou aqui vazio, a mensagem diz o porquê em vez do texto cru.
    if (error.code === '23514') {
      const e = new Error('Negar ou cancelar exige uma justificativa.');
      e.code = error.code; e.amigavel = true; throw e;
    }
    throw error;
  }
}

// Aprovar e negar: só quem tem escrita em `sate` (o RLS confirma).
export const porEmAnalise = (id) => transicionar(id, 'em_analise');
export const aguardarAdaptado = (id) => transicionar(id, 'aguardando_transporte_adaptado');
export const confirmarSolicitacao = (id) => transicionar(id, 'confirmado');

export function negarSolicitacao(id, motivo) {
  if (!String(motivo || '').trim()) throw new Error('Informe o motivo da negativa.');
  return transicionar(id, 'negado', motivo);
}

// Antes de aprovada, a escola cancela sozinha.
export function cancelarSolicitacao(id, motivo) {
  if (!String(motivo || '').trim()) throw new Error('Informe o motivo do cancelamento.');
  return transicionar(id, 'cancelado', motivo);
}

// Depois de aprovada, a escola PEDE - e a vaga volta ao saldo já aqui.
export function pedirCancelamento(id, motivo) {
  if (!String(motivo || '').trim()) throw new Error('Informe o motivo do pedido.');
  return transicionar(id, 'pendente_cancelamento', motivo);
}

// A ciência de quem aprova fecha o ciclo. Não pede motivo novo: herda o
// que a escola escreveu no pedido.
export const confirmarCancelamento = (id) => transicionar(id, 'cancelado');

// ── Realtime ─────────────────────────────────────────────────
export function subscribeSolicitacoes(handler) {
  return subscribeTabela('solicitacao_transporte', handler, 'solic-rt');
}
