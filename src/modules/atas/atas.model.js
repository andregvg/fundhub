// ============================================================
// FundHub — modules/atas/atas.model.js
// Atas de atendimento (gestor/coordenador/servidor/munícipe). O
// `numero` sequencial por ano é atribuído no banco (trigger da 013).
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';

export const TIPOS = {
  gestor: 'Gestor(a)', coordenador: 'Coordenador(a)',
  servidor: 'Servidor(a)', municipe: 'Munícipe', outro: 'Outro',
};

export async function getAtas({ de, ate, tipo, ano } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('ata_atendimento').select('*')
    .order('data', { ascending: false }).order('numero', { ascending: false });
  if (de) q = q.gte('data', de);
  if (ate) q = q.lte('data', ate);
  if (tipo) q = q.eq('tipo', tipo);
  if (ano) q = q.eq('ano', ano);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

const CAMPOS = ['data', 'hora', 'local', 'tipo', 'participantes',
  'assunto', 'deliberacoes', 'encaminhamentos'];
function limpar(p) {
  const out = {};
  for (const k of CAMPOS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

export async function criarAta(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { ...limpar(payload), redator: await emailAtual() };
  if (payload.data) row.ano = Number(payload.data.slice(0, 4));
  const { data, error } = await sb().from('ata_atendimento').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarAta(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = { ...limpar(payload), atualizado_em: new Date().toISOString() };
  const { error } = await sb().from('ata_atendimento').update(patch).eq('id', id);
  if (error) throw error;
}

export async function excluirAta(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('ata_atendimento').delete().eq('id', id);
  if (error) throw error;
}
