// ============================================================
// FundHub — data/solicitacoes.js  (SATE: solicitações, oferta de
// frota, programação de viagens, realtime e números do dashboard)
// ============================================================
import { sb, hasSupabase } from '../core/supabase.js';
import { getUnidades } from './escolas.js';
import { getAtividades } from './atividades.js';

// Status que reservam frota (ocupam ônibus provisória ou definitivamente).
export const STATUS_RESERVA = ['em_analise', 'aguardando_transporte_adaptado', 'confirmado'];

// Lista de solicitações (com nomes de atividade/unidade). filtros opcionais.
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
  const { data: { user } } = await sb().auth.getUser();
  const row = { ...payload, criado_por: user?.email || null, status: 'solicitado' };
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

// Solicitações de um dia (ISO), com nomes de atividade/unidade.
export async function getSolicitacoesDoDia(dataISO) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_transporte')
    .select('*, atividade:atividade_extraclasse(nome,cor), unidade:unidade_escolar(nome,apelido)')
    .eq('data', dataISO).order('periodo');
  if (error) throw error;
  return data || [];
}

// Programação de viagens do dia: confirmadas com origem/destino.
export async function getViagensDoDia(dataISO) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_transporte')
    .select('*, atividade:atividade_extraclasse(nome,local_nome,local_endereco,gerida_sme), unidade:unidade_escolar(nome,apelido,endereco)')
    .eq('data', dataISO).eq('status', 'confirmado').order('periodo');
  if (error) throw error;
  return data || [];
}

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

// Ônibus já reservados por período num dia (status que ocupam frota).
export async function getUsoDia(dataISO) {
  const base = { manha: 0, tarde: 0, noite: 0 };
  if (!hasSupabase()) return base;
  const { data, error } = await sb().from('solicitacao_transporte')
    .select('periodo,qtd_onibus,status').eq('data', dataISO).in('status', STATUS_RESERVA);
  if (error) throw error;
  (data || []).forEach(r => { base[r.periodo] = (base[r.periodo] || 0) + (r.qtd_onibus || 0); });
  return base;
}

// Assina mudanças em solicitacao_transporte (Realtime). Retorna unsubscribe.
export function subscribeSolicitacoes(handler) {
  if (!hasSupabase()) return () => {};
  const ch = sb().channel('solic-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacao_transporte' }, handler)
    .subscribe();
  return () => { try { sb().removeChannel(ch); } catch (_) {} };
}

// Números para o Dashboard.
export async function getStats() {
  const unidades = await getUnidades().catch(() => []);
  const stats = { escolas: unidades.length, atividades: 0 };
  try { stats.atividades = (await getAtividades()).length; } catch (_) {}
  return stats;
}
