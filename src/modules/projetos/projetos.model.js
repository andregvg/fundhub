// ============================================================
// FundHub — modules/projetos/projetos.model.js
// Projetos e pesquisas ofertados às escolas + a manifestação de
// interesse de cada unidade. Só banco, nunca DOM.
//
// A parte externa (proponente envia por token, sem login) NÃO está
// aqui — depende de Edge Function. Este model cobre o fluxo interno.
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';

export const TIPOS = {
  pesquisa: 'Pesquisa', projeto: 'Projeto', programa: 'Programa', outro: 'Outro',
};

export const STATUS = {
  proposto: 'Proposto', em_analise: 'Em análise', aprovado: 'Aprovado',
  em_andamento: 'Em andamento', concluido: 'Concluído', indeferido: 'Indeferido',
};

export const STATUS_TAG = {
  proposto: 'st-em_analise', em_analise: 'st-em_analise', aprovado: 'st-confirmado',
  em_andamento: 'st-confirmado', concluido: 'st-confirmado', indeferido: 'st-negado',
};

export async function getProjetos({ status, tipo } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('projeto').select('*').order('criado_em', { ascending: false });
  if (status) q = q.eq('status', status);
  if (tipo) q = q.eq('tipo', tipo);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

const CAMPOS = ['titulo', 'proponente', 'tipo', 'descricao', 'publico_alvo',
  'inicio', 'fim', 'status', 'anuencia', 'anuencia_data', 'contato', 'observacoes'];
function limpar(p) {
  const out = {};
  for (const k of CAMPOS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

export async function criarProjeto(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { ...limpar(payload), criado_por: await emailAtual() };
  const { data, error } = await sb().from('projeto').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarProjeto(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = { ...limpar(payload), atualizado_em: new Date().toISOString() };
  const { error } = await sb().from('projeto').update(patch).eq('id', id);
  if (error) throw error;
}

export async function excluirProjeto(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('projeto').delete().eq('id', id);
  if (error) throw error;
}

// ── Interesse das escolas ────────────────────────────────────
export async function getInteresses(projetoId) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('projeto_interesse')
    .select('*, unidade:unidade_escolar(id, nome, apelido)')
    .eq('projeto_id', projetoId).order('criado_em');
  if (error) throw error;
  return data || [];
}

export async function adicionarInteresse({ projeto_id, unidade_id, observacao = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { projeto_id, unidade_id, observacao, interesse: true, criado_por: await emailAtual() };
  const { error } = await sb().from('projeto_interesse').insert(row);
  if (error) {
    if (error.code === '23505') throw new Error('Esta escola já manifestou interesse neste projeto.');
    throw error;
  }
}

export async function removerInteresse(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('projeto_interesse').delete().eq('id', id);
  if (error) throw error;
}
