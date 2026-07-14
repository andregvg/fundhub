// ============================================================
// FundHub — data/atividades.js  (catálogo de atividades extraclasse)
// ============================================================
import { sb, hasSupabase } from '../core/supabase.js';

let _cache = null;
export async function getAtividades() {
  if (_cache) return _cache;
  if (!hasSupabase()) { _cache = []; return _cache; }
  const { data, error } = await sb()
    .from('atividade_extraclasse').select('*').eq('ativo', true).order('nome');
  if (error) throw error;
  _cache = data || [];
  return _cache;
}

const CAMPOS = ['chave', 'nome', 'descricao', 'publico_alvo', 'usa_onibus',
  'gerida_sme', 'min_participantes', 'precisa_declaracao', 'lanche', 'local_nome',
  'local_endereco', 'cor', 'ativo'];

function limpar(p) {
  const out = {};
  for (const k of CAMPOS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

export async function criarAtividade(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data, error } = await sb().from('atividade_extraclasse')
    .insert(limpar(payload)).select().single();
  if (error) throw error;
  _cache = null;
  return data;
}

export async function atualizarAtividade(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('atividade_extraclasse').update(limpar(payload)).eq('id', id);
  if (error) throw error;
  _cache = null;
}

export async function excluirAtividade(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('atividade_extraclasse').delete().eq('id', id);
  if (error) throw error;
  _cache = null;
}
