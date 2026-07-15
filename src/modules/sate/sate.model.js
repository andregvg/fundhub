// ============================================================
// FundHub — modules/sate/sate.model.js
// Solicitações de transporte, oferta de frota e realtime.
// Também guarda as REGRAS DE NEGÓCIO do SATE (capacidade do ônibus,
// antecedência mínima, status que reservam frota) — elas são do
// domínio, não da tela, e outros módulos leem daqui.
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { subscribeTabela } from '../../shared/realtime.js';

export const CAP_ONIBUS = 44;         // lugares por ônibus
export const ANTECEDENCIA_MIN = 5;    // dias mínimos p/ a escola (admin não tem limite)

export const PERIODOS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
export const STATUS = {
  solicitado: 'Solicitado', em_analise: 'Em análise',
  aguardando_transporte_adaptado: 'Aguardando adaptado',
  confirmado: 'Confirmado', negado: 'Negado', cancelado: 'Cancelado',
};

// Status que ocupam ônibus (provisória ou definitivamente).
export const STATUS_RESERVA = ['em_analise', 'aguardando_transporte_adaptado', 'confirmado'];

// Nº de ônibus necessários para um grupo de alunos.
export const onibusPara = (qtdAlunos) => Math.ceil(qtdAlunos / CAP_ONIBUS);

// ── Solicitações ─────────────────────────────────────────────
export async function listSolicitacoes({ status, de, ate } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('solicitacao_transporte')
    .select('*, atividade:atividade_extraclasse(nome,cor,usa_onibus), unidade:unidade_escolar(nome,apelido)')
    .order('data', { ascending: false });
  if (status) q = q.eq('status', status);
  if (de) q = q.gte('data', de);
  if (ate) q = q.lte('data', ate);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function criarSolicitacao(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { ...payload, criado_por: await emailAtual(), status: 'solicitado' };
  const { data, error } = await sb().from('solicitacao_transporte').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarStatusSolicitacao(id, status) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('solicitacao_transporte')
    .update({ status, atualizado_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// Solicitações de um dia (para o Dashboard).
export async function getSolicitacoesDoDia(dataISO) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_transporte')
    .select('*, atividade:atividade_extraclasse(nome,cor), unidade:unidade_escolar(nome,apelido)')
    .eq('data', dataISO).order('periodo');
  if (error) throw error;
  return data || [];
}

// Programação de viagens do dia: só as confirmadas, com origem/destino.
export async function getViagensDoDia(dataISO) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_transporte')
    .select('*, atividade:atividade_extraclasse(nome,local_nome,local_endereco,gerida_sme), unidade:unidade_escolar(nome,apelido,endereco)')
    .eq('data', dataISO).eq('status', 'confirmado').order('periodo');
  if (error) throw error;
  return data || [];
}

// ── Frota ────────────────────────────────────────────────────
// Oferta de ônibus por período num dia → { manha, tarde, noite }
export async function getOfertaDia(dataISO) {
  const base = { manha: 0, tarde: 0, noite: 0 };
  if (!hasSupabase()) return base;
  const { data, error } = await sb().from('oferta_onibus').select('periodo,total').eq('data', dataISO);
  if (error) throw error;
  (data || []).forEach(r => { base[r.periodo] = r.total; });
  return base;
}

export async function setOferta(dataISO, periodo, total) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('oferta_onibus')
    .upsert({ data: dataISO, periodo, total }, { onConflict: 'data,periodo' });
  if (error) throw error;
}

// Ônibus já reservados por período num dia.
export async function getUsoDia(dataISO) {
  const base = { manha: 0, tarde: 0, noite: 0 };
  if (!hasSupabase()) return base;
  const { data, error } = await sb().from('solicitacao_transporte')
    .select('periodo,qtd_onibus,status').eq('data', dataISO).in('status', STATUS_RESERVA);
  if (error) throw error;
  (data || []).forEach(r => { base[r.periodo] = (base[r.periodo] || 0) + (r.qtd_onibus || 0); });
  return base;
}

// ── Realtime ─────────────────────────────────────────────────
// Assina mudanças em solicitacao_transporte. Devolve o unsubscribe.
export function subscribeSolicitacoes(handler) {
  return subscribeTabela('solicitacao_transporte', handler, 'solic-rt');
}
