// ============================================================
// FundHub — modules/visitas/visitas.model.js
// Relatórios das visitas técnicas às escolas pela equipe de
// acompanhamento. Só banco, nunca DOM.
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';

export const TIPOS = {
  rotina: 'Rotina', acompanhamento: 'Acompanhamento',
  demanda: 'Demanda', denuncia: 'Denúncia', outro: 'Outro',
};
export const STATUS = { aberto: 'Aberto', concluido: 'Concluído' };
export const STATUS_TAG = { aberto: 'st-em_analise', concluido: 'st-confirmado' };

const SEL = '*, unidade:unidade_escolar(id, nome, apelido)';

export async function getVisitas({ de, ate, unidadeId, status } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('relatorio_visita').select(SEL).order('data', { ascending: false });
  if (de) q = q.gte('data', de);
  if (ate) q = q.lte('data', ate);
  if (unidadeId) q = q.eq('unidade_id', unidadeId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

const CAMPOS = ['unidade_id', 'data', 'responsavel', 'tipo', 'pauta',
  'constatacoes', 'encaminhamentos', 'prazo', 'status'];
function limpar(p) {
  const out = {};
  for (const k of CAMPOS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

export async function criarVisita(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { ...limpar(payload), criado_por: await emailAtual() };
  const { data, error } = await sb().from('relatorio_visita').insert(row).select(SEL).single();
  if (error) throw error;
  return data;
}

export async function atualizarVisita(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = { ...limpar(payload), atualizado_em: new Date().toISOString() };
  const { error } = await sb().from('relatorio_visita').update(patch).eq('id', id);
  if (error) throw error;
}

export async function excluirVisita(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('relatorio_visita').delete().eq('id', id);
  if (error) throw error;
}
