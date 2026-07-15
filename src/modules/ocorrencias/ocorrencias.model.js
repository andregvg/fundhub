// ============================================================
// FundHub — modules/ocorrencias/ocorrencias.model.js
// Atendimentos telefônicos das recepcionistas, ligados (ou não) a uma
// escola. Só banco, nunca DOM. A unidade é opcional — nem toda ligação
// é sobre uma escola específica.
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { subscribeTabela } from '../../shared/realtime.js';

export const CANAIS = {
  telefone: 'Telefone', presencial: 'Presencial', whatsapp: 'WhatsApp',
  email: 'E-mail', outro: 'Outro',
};

export const STATUS = {
  aberta: 'Aberta', em_andamento: 'Em andamento',
  resolvida: 'Resolvida', encaminhada: 'Encaminhada',
};

// Cor por status — a mesma família visual dos outros módulos.
export const STATUS_TAG = {
  aberta: 'st-em_analise', em_andamento: 'st-em_analise',
  resolvida: 'st-confirmado', encaminhada: 'st-negado',
};

const SEL = '*, unidade:unidade_escolar(id, nome, apelido)';

// Lista ocorrências. Filtros opcionais: { de, ate, unidadeId, status }.
export async function getOcorrencias({ de, ate, unidadeId, status } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('ocorrencia').select(SEL)
    .order('data', { ascending: false })
    .order('hora', { ascending: false, nullsFirst: false });
  if (de) q = q.gte('data', de);
  if (ate) q = q.lte('data', ate);
  if (unidadeId) q = q.eq('unidade_id', unidadeId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

const CAMPOS = ['unidade_id', 'data', 'hora', 'canal', 'solicitante',
  'solicitante_contato', 'assunto', 'relato', 'status', 'encaminhado_para'];

function limpar(p) {
  const out = {};
  for (const k of CAMPOS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

export async function criarOcorrencia(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { ...limpar(payload), criado_por: await emailAtual() };
  const { data, error } = await sb().from('ocorrencia').insert(row).select(SEL).single();
  if (error) throw error;
  return data;
}

export async function atualizarOcorrencia(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = { ...limpar(payload), atualizado_em: new Date().toISOString() };
  const { error } = await sb().from('ocorrencia').update(patch).eq('id', id);
  if (error) throw error;
}

export async function excluirOcorrencia(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('ocorrencia').delete().eq('id', id);
  if (error) throw error;
}

// Realtime: notifica novas ocorrências e mudanças. Requer a migration 014.
export function subscribeOcorrencias(handler) {
  return subscribeTabela('ocorrencia', handler, 'ocor-rt');
}
