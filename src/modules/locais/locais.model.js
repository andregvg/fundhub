// ============================================================
// FundHub - modules/locais/locais.model.js
// Catálogo de locais (destinos das atividades e solicitações do SATE).
// Fonte única do endereço/coordenadas de cada destino, e o que é
// genérico de LUGAR: localizar um endereço, medir a distância por
// estrada, montar link de mapa. É o "M": nunca DOM.
//
// A geografia vem do OpenStreetMap, direto do navegador - sem chave,
// sem conta, sem custo (spec 2026-09-13-sate-rota-design.md, D2). O que
// é específico do SATE (paradas da viagem, minutos, cache de trechos)
// mora em `sate/rota.model.js`.
//
// Inspirado no Locais.js do agendamentos-fil: um destino é apontado
// por id, não redigitado a cada atividade/solicitação.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { registrarCache } from '../../shared/cache.js';
import { norm } from '../../shared/dom.js';

const COLS = 'id, nome, endereco, desembarque, latitude, longitude, maps_url, ativo, obs';

let _cache = null;
export function limparCacheLocais() { _cache = null; }
registrarCache(limparCacheLocais);

// Lista os locais (por padrão todos; { somenteAtivos:true } filtra).
// Degrada em silêncio se a tabela ainda não existe (migration 017).
export async function getLocais({ somenteAtivos = false } = {}) {
  if (_cache) return somenteAtivos ? _cache.filter(l => l.ativo) : _cache;
  if (!hasSupabase()) { _cache = []; return _cache; }
  const { data, error } = await sb().from('local').select(COLS).order('nome');
  if (error) {
    if (error.code === '42P01') { console.warn('Tabela local ausente - rode a migration 017.'); return []; }
    throw error;
  }
  _cache = data || [];
  return somenteAtivos ? _cache.filter(l => l.ativo) : _cache;
}

// Link do Google Maps a partir de coordenadas (mesmo padrão do agendamentos-fil).
// `temCoordenada` é função declarada mais abaixo (hoisting): um campo
// vazio que virou 0,0 não gera link para o meio do Atlântico.
export const linkMaps = (lat, lng) =>
  temCoordenada(lat, lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null;

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
    if (error.code === '23503') throw new Error('Local em uso por atividades ou solicitações - desative-o em vez de excluir.');
    throw error;
  }
  _cache = null;
}

// ── Geografia: localizar e medir ─────────────────────────────
// O que sai do navegador é endereço de escola ou local, e coordenadas.
// Nunca dado de pessoa.

const CIDADE_PADRAO = 'Ribeirão Preto, SP, Brasil';
const TEMPO_LIMITE_MS = 10000;

// Serviço público fora do ar não pode deixar botão girando para sempre.
async function buscarJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Serviço de mapa respondeu ${r.status}.`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// Endereço → coordenada, pelo Nominatim. SÓ por clique: a política de uso
// dele é de no máximo uma consulta por segundo, e lote não cabe nisso.
// Acrescenta a cidade quando o texto não parece trazê-la - "Rua Tal, 100"
// sozinho casa com cidades do país inteiro. Mesmo critério do
// agendamentos-fil (Geo.js).
export async function geocodificar(endereco) {
  const q = String(endereco || '').trim();
  if (!q) throw new Error('Informe o endereço para localizar.');
  const temCidade = /ribeir[ãa]o|,\s*[A-Za-z]{2}\b|-\s*[A-Za-z]{2}\b/i.test(q);
  const params = new URLSearchParams({
    q: temCidade ? q : `${q}, ${CIDADE_PADRAO}`,
    format: 'jsonv2', limit: '1', countrycodes: 'br', 'accept-language': 'pt-BR',
  });
  const lista = await buscarJson(`https://nominatim.openstreetmap.org/search?${params}`);
  const r = Array.isArray(lista) ? lista[0] : null;
  if (!r) return null;
  const lat = Number(r.lat), lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, formatado: r.display_name || '', rank: Number(r.place_rank) || 0 };
}

// Quão bem uma resposta de `geocodificar` aponta o lugar, pelo
// `place_rank` do OpenStreetMap. Pura.
//
//   exata       casa ou prédio (30)
//   rua         a rua, sem o número (26-29) - erra dezenas a centenas de
//               metros, o que ainda serve para tempo de viagem
//   aproximada  bairro ou cidade - erra quilômetros, e gravar isso como
//               localização seria pior que não ter nenhuma
export function precisaoDe(r) {
  const rank = Number(r?.rank) || 0;
  return rank >= 30 ? 'exata' : rank >= 26 ? 'rua' : 'aproximada';
}

// A resposta caiu na cidade esperada? Um "Rua Tal, 100" sem cidade pode
// casar com outra cidade do país, e o endereço formatado é o que diz onde.
export const naCidade = (r, cidade = CIDADE_PADRAO.split(',')[0]) =>
  norm(r?.formatado || '').includes(norm(cidade));

// Formas de escrever o mesmo endereço, da mais completa à mais enxuta. O
// OpenStreetMap acha "Rua Tal, 100" onde não acha "Rua Tal, 100 - Vila
// Tal - CEP 00000-000": bairro, CEP e complemento atrapalham mais do que
// ajudam. Pura; no máximo duas, porque cada uma é uma consulta a mais.
export function variantesDeEndereco(endereco) {
  const original = String(endereco || '').trim().replace(/\s+/g, ' ');
  if (!original) return [];
  const enxuto = original
    .split(/\s[-–]\s/)[0]                        // corta bairro após " - "
    .replace(/\bCEP:?\s*\d{5}-?\d{3}\b/i, '')     // CEP solto
    .replace(/,?\s*\b(s\/n|sn)\b\.?/i, '')       // "s/n" confunde a busca
    .replace(/[\s,]+$/, '')
    .trim();
  return [...new Set([original, enxuto].filter(Boolean))];
}

// Coordenada válida: número finito dentro do globo. `0,0` fica de fora de
// propósito - é o valor que um campo vazio vira quando alguém faz
// `Number('')`, e fica no meio do Atlântico.
export function temCoordenada(lat, lng) {
  const a = Number(lat), b = Number(lng);
  return lat != null && lng != null && lat !== '' && lng !== ''
    && Number.isFinite(a) && Number.isFinite(b)
    && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
}

// OSRM pede longitude ANTES de latitude - a ordem inversa da que todo
// mundo escreve. Ponto: { lat, lng }.
export const urlOsrm = (pontos) =>
  'https://router.project-osrm.org/route/v1/driving/'
  + pontos.map(p => `${Number(p.lng).toFixed(5)},${Number(p.lat).toFixed(5)}`).join(';')
  + '?overview=false&steps=false';

// A resposta do OSRM → km de cada trecho consecutivo. Pura.
export function lerOsrm(json) {
  if (json?.code !== 'Ok' || !json.routes?.length) {
    return { status: json?.code === 'NoRoute' ? 'sem_rota' : 'erro', trechosKm: [] };
  }
  const legs = json.routes[0].legs || [];
  return { status: 'ok', trechosKm: legs.map(l => Math.round((Number(l.distance) || 0) / 10) / 100) };
}

// Distância por estrada de cada trecho de uma sequência de pontos, numa
// chamada só. Quem guarda em cache é quem chama.
export async function distanciaPorEstrada(pontos) {
  if (!pontos || pontos.length < 2) return { status: 'sem_rota', trechosKm: [] };
  try {
    return lerOsrm(await buscarJson(urlOsrm(pontos)));
  } catch (err) {
    console.warn('[locais] OSRM indisponível:', err?.message || err);
    return { status: 'erro', trechosKm: [] };
  }
}

// A rota no Google Maps, com as paradas na ordem. É LINK, não API: não
// consome cota nem tem custo (spec D8). Primeiro ponto = origem, último =
// destino, o meio = paradas.
export function linkRota(pontos) {
  const validos = (pontos || []).filter(p => temCoordenada(p.lat, p.lng));
  if (validos.length < 2) return null;
  const c = (p) => `${p.lat},${p.lng}`;
  const params = new URLSearchParams({
    api: '1', travelmode: 'driving',
    origin: c(validos[0]), destination: c(validos[validos.length - 1]),
  });
  const meio = validos.slice(1, -1);
  if (meio.length) params.set('waypoints', meio.map(c).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}
