// ============================================================
// FundHub - modules/locais/locais.model.js
// Catálogo de locais (destinos das atividades e solicitações do SATE).
// Fonte única do endereço/coordenadas de cada destino. É o "M": nunca DOM.
//
// A geografia (localizar um endereço, medir a distância por estrada,
// montar link de mapa) mora em `geografia.model.js`: vem do OpenStreetMap
// e não toca no banco. O que é específico do SATE (paradas da viagem,
// minutos, cache de trechos) mora em `sate/rota.model.js`.
//
// Inspirado no Locais.js do agendamentos-fil: um destino é apontado
// por id, não redigitado a cada atividade/solicitação.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { registrarCache } from '../../shared/cache.js';
import { norm, semelhanca } from '../../shared/dom.js';
import { linkMaps } from './geografia.model.js';

const COLS = 'id, nome, endereco, numero, bairro, cep, desembarque, latitude, longitude, maps_url, ativo, obs';
// Sem a migration 047 a coluna `cep` não existe (42703): lê sem ela.
const COLS_SEM_CEP = 'id, nome, endereco, numero, bairro, desembarque, latitude, longitude, maps_url, ativo, obs';

let _cache = null;
function limparCacheLocais() { _cache = null; }
registrarCache(limparCacheLocais);

// Lista os locais (por padrão todos; { somenteAtivos:true } filtra).
// Degrada em silêncio se a tabela ainda não existe (migration 017).
export async function getLocais({ somenteAtivos = false } = {}) {
  if (_cache) return somenteAtivos ? _cache.filter(l => l.ativo) : _cache;
  if (!hasSupabase()) { _cache = []; return _cache; }
  let { data, error } = await sb().from('local').select(COLS).order('nome');
  if (error?.code === '42703') ({ data, error } = await sb().from('local').select(COLS_SEM_CEP).order('nome'));
  if (error) {
    if (error.code === '42P01') { console.warn('Tabela local ausente - rode a migration 017.'); return []; }
    throw error;
  }
  _cache = data || [];
  return somenteAtivos ? _cache.filter(l => l.ativo) : _cache;
}

const CAMPOS = ['nome', 'endereco', 'numero', 'bairro', 'cep', 'desembarque', 'latitude', 'longitude', 'maps_url', 'ativo', 'obs'];

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
  const { data, error } = await sb().from('local').update(limpar(payload)).eq('id', id).select().single();
  if (error) throw error;
  _cache = null;
  return data;
}

export async function excluirLocal(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  // .select('id'): 0 linhas apagadas (id já não existe) não vira erro no
  // Postgres - sem isto o toast diria "excluído" tendo apagado nada.
  const { data, error } = await sb().from('local').delete().eq('id', id).select('id');
  if (error) {
    if (error.code === '23503') throw new Error('Local em uso por atividades ou solicitações - desative-o em vez de excluir.');
    throw error;
  }
  if (!data?.length) throw new Error('Local não encontrado - já foi excluído.');
  _cache = null;
}

// A linha única de endereço, a partir das três partes (spec 2026-09-27,
// D3): "Rua Exemplo, 123 - Centro". Registros antigos têm o endereço
// inteiro em `endereco` e as outras duas vazias - saem como estavam.
// TODA exibição e uso da linha única passam por aqui.
export function enderecoCompleto(x) {
  const t = (v) => String(v ?? '').trim();
  const rua = t(x?.endereco), num = t(x?.numero), bairro = t(x?.bairro);
  const linha = [rua, num].filter(Boolean).join(', ');
  return [linha, bairro].filter(Boolean).join(' - ');
}

// Locais ativos parecidos com o que a escola digitou - para a SME
// apontar para um existente em vez de cadastrar duplicata (spec D6).
// Nome parecido = alguma palavra significativa (4+ letras, sem acento)
// em comum; bairro igual também conta. Nome + bairro vem primeiro.
export function locaisParecidos(alvo, locais, max = 5) {
  const palavras = (s) => norm(s).split(/[^a-z0-9]+/).filter(p => p.length >= 4);
  const nomeAlvo = new Set(palavras(alvo?.nome));
  const bairroAlvo = norm(alvo?.bairro).trim();
  if (!nomeAlvo.size && !bairroAlvo) return [];
  return (locais || [])
    .filter(l => l.ativo)
    .map(l => {
      // Prefixo de 5 letras (o critério antigo) OU uma letra de diferença
      // (spec 2026-10-02, D13): "Muzeu" e "Theatro" também contam.
      const nome = palavras(l.nome).some(p => nomeAlvo.has(p) || [...nomeAlvo].some(a =>
        a.startsWith(p.slice(0, 5)) || p.startsWith(a.slice(0, 5)) || semelhanca(a, p) !== null));
      const bairro = !!bairroAlvo && norm(l.bairro).trim() === bairroAlvo;
      return { l, pontos: (nome ? 2 : 0) + (bairro ? 1 : 0) };
    })
    .filter(x => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || a.l.nome.localeCompare(b.l.nome, 'pt'))
    .slice(0, max)
    .map(x => x.l);
}

// O local cadastrado (ativo) que já ocupa este endereço, ou null. Avisa
// quem digita um local NOVO que o lugar talvez já exista com outro nome
// (spec 2026-10-02, D13). A rua é comparada sem acento, caixa e
// pontuação, com a abreviação do logradouro expandida ("R." = "Rua").
const LOGRADOURO = { r: 'rua', av: 'avenida', al: 'alameda', pc: 'praca', pca: 'praca', rod: 'rodovia', tv: 'travessa', est: 'estrada' };
function chaveRua(s) {
  const p = norm(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  if (p.length && LOGRADOURO[p[0]]) p[0] = LOGRADOURO[p[0]];
  return p.join(' ');
}
const chaveNumero = (n) => norm(n).replace(/\s+/g, '');

export function localNoEndereco(rua, numero, locais) {
  const r = chaveRua(rua), n = chaveNumero(numero);
  if (!r || !n) return null;
  return (locais || []).find(l => l.ativo && chaveRua(l.endereco) === r && chaveNumero(l.numero) === n) || null;
}
