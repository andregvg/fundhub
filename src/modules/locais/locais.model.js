// ============================================================
// FundHub — modules/locais/locais.model.js
// Catálogo de locais (destinos das atividades e solicitações do SATE).
// Fonte única do endereço/coordenadas de cada destino — a base do
// futuro cálculo de rota/tempo. É o "M": só banco, nunca DOM.
//
// Inspirado no Locais.js do agendamentos-fil: um destino é apontado
// por id, não redigitado a cada atividade/solicitação.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';

const COLS = 'id, nome, endereco, desembarque, latitude, longitude, maps_url, ativo, obs';

let _cache = null;
export function limparCacheLocais() { _cache = null; }

// Lista os locais (por padrão todos; { somenteAtivos:true } filtra).
// Degrada em silêncio se a tabela ainda não existe (migration 017).
export async function getLocais({ somenteAtivos = false } = {}) {
  if (_cache) return somenteAtivos ? _cache.filter(l => l.ativo) : _cache;
  if (!hasSupabase()) { _cache = []; return _cache; }
  const { data, error } = await sb().from('local').select(COLS).order('nome');
  if (error) {
    if (error.code === '42P01') { console.warn('Tabela local ausente — rode a migration 017.'); return []; }
    throw error;
  }
  _cache = data || [];
  return somenteAtivos ? _cache.filter(l => l.ativo) : _cache;
}

// Link do Google Maps a partir de coordenadas (mesmo padrão do agendamentos-fil).
export const linkMaps = (lat, lng) =>
  (lat != null && lng != null) ? `https://www.google.com/maps?q=${lat},${lng}` : null;

const CAMPOS = ['nome', 'endereco', 'desembarque', 'latitude', 'longitude', 'maps_url', 'ativo', 'obs'];

function limpar(p) {
  const out = {};
  for (const k of CAMPOS) if (p[k] !== undefined) out[k] = p[k];
  // maps_url derivado das coordenadas quando não informado
  if (out.maps_url == null && out.latitude != null && out.longitude != null) {
    out.maps_url = linkMaps(out.latitude, out.longitude);
  }
  return out;
}

export async function criarLocal(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data, error } = await sb().from('local').insert(limpar(payload)).select().single();
  if (error) throw error;
  _cache = null;
  return data;
}

export async function atualizarLocal(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('local').update(limpar(payload)).eq('id', id);
  if (error) throw error;
  _cache = null;
}

export async function excluirLocal(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('local').delete().eq('id', id);
  // Local em uso (FK) → Postgres barra com 23503; devolve mensagem amigável.
  if (error) {
    if (error.code === '23503') throw new Error('Local em uso por atividades ou solicitações — desative-o em vez de excluir.');
    throw error;
  }
  _cache = null;
}
