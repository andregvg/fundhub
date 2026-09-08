// ============================================================
// FundHub - modules/sate/participacoes.model.js
// A participação de uma escola numa viagem: quem vai, em que ordem,
// com quantos estudantes, e em que situação.
// Spec: 2026-09-08-sate-participacao-design.md
//
// É a unidade do domínio. Uma viagem com três escolas não é de uma
// delas - é das três, e cada uma é uma linha aqui, com cota e ciclo de
// vida próprios. Uma escola pedindo sozinha é o caso de UMA
// participação, não um modelo diferente.
//
// O cabeçalho da viagem guarda `qtd_alunos` e `qtd_cadeirante` como
// CACHE, mantido por gatilho no banco (migration 037). A verdade é a
// soma das participações ativas - nunca escrever esses campos daqui.
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { agoraISO } from '../../shared/format.js';

export const STATUS_PART = Object.freeze({
  ativa: 'Ativa',
  pendente_cancelamento: 'Pedido de saída',
  cancelada: 'Cancelada',
});

// Participação que ocupa lugar. Cancelada e pendente NÃO contam - a vaga
// volta ao saldo no PEDIDO, não na confirmação, igual à viagem inteira.
export const ativa = (p) => p.status === 'ativa';

const SELECT = '*, unidade:unidade_escolar(nome,apelido,endereco), local:local(nome,endereco)';
const ausente = (err) => err?.code === '42P01' || err?.code === '42703';

export async function getParticipacoes(solicitacaoId) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_participacao')
    .select(SELECT).eq('solicitacao_id', solicitacaoId).order('ordem');
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
}

// Várias viagens de uma vez - a tabela de solicitações precisa saber
// quais escolas estão em cada uma sem fazer N consultas.
export async function getParticipacoesDe(solicitacaoIds) {
  if (!hasSupabase() || !solicitacaoIds?.length) return {};
  const { data, error } = await sb().from('solicitacao_participacao')
    .select(SELECT).in('solicitacao_id', solicitacaoIds).order('ordem');
  if (error) { if (ausente(error)) return {}; throw error; }
  const out = {};
  for (const p of data || []) (out[p.solicitacao_id] ||= []).push(p);
  return out;
}

// Acrescenta uma escola à viagem. Só quem tem escrita (RLS) - montar
// itinerário é decisão da Gerência.
export async function acrescentar(solicitacaoId, { unidadeId = null, localId = null, qtdAlunos = 0, qtdCadeirante = 0, horario = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const atuais = await getParticipacoes(solicitacaoId);
  const { error } = await sb().from('solicitacao_participacao').insert({
    solicitacao_id: solicitacaoId,
    // Entra no fim da fila; reordenar é outro ato, deliberado.
    ordem: Math.max(0, ...atuais.map(p => p.ordem || 0)) + 1,
    unidade_id: unidadeId, local_id: localId,
    qtd_alunos: qtdAlunos, qtd_cadeirante: qtdCadeirante,
    horario, status: 'ativa',
  });
  if (error) throw error;
}

export async function editar(id, patch) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('solicitacao_participacao').update(patch).eq('id', id);
  if (error) throw error;
}

export async function remover(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('solicitacao_participacao').delete().eq('id', id);
  if (error) throw error;
}

// ── Ciclo de vida da participação ────────────────────────────
async function mover(id, status, motivo) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = { status };
  if (motivo != null) patch.motivo = String(motivo).trim();
  if (status === 'cancelada') {
    patch.decidido_por = await emailAtual();
    patch.decidido_em = agoraISO();
  }
  const { error } = await sb().from('solicitacao_participacao').update(patch).eq('id', id);
  if (error) {
    if (error.code === '23514') {
      const e = new Error('Sair da viagem exige uma justificativa.');
      e.code = error.code; e.amigavel = true; throw e;
    }
    throw error;
  }
}

// A escola pede para sair. A vaga volta ao saldo já aqui.
export function pedirSaida(id, motivo) {
  if (!String(motivo || '').trim()) throw new Error('Informe o motivo do pedido.');
  return mover(id, 'pendente_cancelamento', motivo);
}

// Quem aprova confirma. A linha FICA, com o motivo - é por ela ficar que
// a escola continua vendo que o agendamento dela foi cancelado.
export const confirmarSaida = (id) => mover(id, 'cancelada');

// Desfaz o pedido, antes da confirmação. Volta a ocupar lugar.
export const voltarAtras = (id) => mover(id, 'ativa', null);

// Reordena a viagem inteira. Recebe os ids na ordem desejada.
//
// Duas passadas, e não uma: `ordem` é única dentro da viagem, então
// escrever direto colidiria com a linha que ainda ocupa o número. A
// primeira passada joga todo mundo para uma faixa negativa (que nenhuma
// linha usa), a segunda assenta na ordem final.
export async function reordenar(solicitacaoId, idsNaOrdem) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  for (let i = 0; i < idsNaOrdem.length; i++) {
    const { error } = await sb().from('solicitacao_participacao')
      .update({ ordem: -(i + 1) }).eq('id', idsNaOrdem[i]);
    if (error) throw error;
  }
  for (let i = 0; i < idsNaOrdem.length; i++) {
    const { error } = await sb().from('solicitacao_participacao')
      .update({ ordem: i + 1 }).eq('id', idsNaOrdem[i]);
    if (error) throw error;
  }
}

// ── Resumo para as listas ────────────────────────────────────
// O nome que a tabela de solicitações mostra na coluna "Escolas": uma
// escola pelo nome, várias pela contagem. É função pura.
export function resumoEscolas(participacoes = []) {
  const nomes = participacoes.filter(ativa)
    .map(p => p.unidade?.apelido || p.unidade?.nome || p.local?.nome || '')
    .filter(Boolean);
  if (!nomes.length) return '';
  if (nomes.length === 1) return nomes[0];
  return `${nomes[0]} +${nomes.length - 1}`;
}
