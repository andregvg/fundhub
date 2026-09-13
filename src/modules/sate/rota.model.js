// ============================================================
// FundHub - modules/sate/rota.model.js
// O trajeto de uma viagem: das paradas, na ordem, até o destino - quantos
// km e quantos minutos.
// Spec: 2026-09-13-sate-rota-design.md.
//
// O que é genérico de lugar (localizar endereço, perguntar a distância ao
// OpenStreetMap, montar link de mapa) mora em `locais.model.js`. Aqui fica
// o que só o SATE sabe: quais são as paradas, como distância vira tempo
// de ônibus, o cache de trechos e o retrato gravado na solicitação.
//
// Velocidade e margem chegam por PARÂMETRO, e não lidas de
// `sate.config.js`: aquele arquivo importa uma view (o painel da frota),
// e um model que o importasse puxaria DOM para dentro do domínio.
//
// Falha de cálculo nunca é exceção para quem chama (spec D6): devolve um
// `status` dizendo o porquê, e a solicitação segue.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { agoraISO } from '../../shared/format.js';
import { distanciaPorEstrada, temCoordenada, getLocais } from '../locais/locais.model.js';
import { getParticipacoes, ativa } from './participacoes.model.js';

// ── Puras ────────────────────────────────────────────────────

const nomeDe = (p) => p.unidade?.apelido || p.unidade?.nome || p.local?.nome || 'parada';

// A coordenada de uma participação: da escola, ou do local quando a
// parada não é escola.
function coordDe(p) {
  const fonte = p.unidade_id ? p.unidade : p.local;
  return temCoordenada(fonte?.latitude, fonte?.longitude)
    ? { lat: Number(fonte.latitude), lng: Number(fonte.longitude) } : null;
}

// As paradas na ordem, mais o destino. Cancelada não é parada: o ônibus
// não passa lá. Pedido de saída AINDA é: até a Gerência confirmar, o
// ônibus continua indo buscar aquela escola - e quem confirma recalcula
// nesse momento (spec D5).
//
// `destino`: { nome, latitude, longitude } ou null (destino digitado à
// mão, que não tem coordenada - spec D7).
export function pontosDaViagem(participacoes, destino) {
  const paradas = [...(participacoes || [])]
    .filter(p => ativa(p) || p.status === 'pendente_cancelamento')
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  if (!paradas.length) return { status: 'sem_rota', pontos: [], faltando: [], paradas: 0 };

  const faltando = paradas.filter(p => !coordDe(p)).map(nomeDe);
  const destinoOk = destino && temCoordenada(destino.latitude, destino.longitude);
  const pontos = paradas.map(p => ({ ...coordDe(p), nome: nomeDe(p) })).filter(p => p.lat != null);
  if (destinoOk) pontos.push({ lat: Number(destino.latitude), lng: Number(destino.longitude), nome: destino.nome || 'destino' });

  // Parada sem coordenada vence destino sem coordenada na mensagem: é a
  // que a escola consegue resolver sozinha (cadastro da própria unidade).
  const status = faltando.length ? 'sem_coordenada' : (destinoOk ? 'ok' : 'sem_destino');
  return { status, pontos, faltando, paradas: paradas.length };
}

// Distância → minutos de ônibus (spec D1). A margem é por PARADA de
// embarque: cada escola a mais é mais uma manobra.
export function minutosDeTrajeto(km, paradas, { velocidadeKmh, margemMin }) {
  const k = Number(km), v = Number(velocidadeKmh);
  if (!Number.isFinite(k) || k < 0 || !(v > 0)) return null;
  return Math.round((k / v) * 60) + Math.max(0, Number(margemMin) || 0) * Math.max(1, Number(paradas) || 1);
}

// Chave do trecho: coordenadas com 5 casas (~1 m), a mesma precisão das
// colunas `numeric(8,5)` da tabela.
export const chaveTrecho = (a, b) =>
  [a.lat, a.lng, b.lat, b.lng].map(n => Number(n).toFixed(5)).join(',');

// ── Cache de trechos ─────────────────────────────────────────
// Memória da sessão na frente do banco: a escola não grava na tabela
// (spec D3), e sem isto cada mudança de campo no formulário perguntaria
// de novo ao OpenStreetMap.
const _memoria = new Map();

async function lerTrechos(pares) {
  if (!hasSupabase() || !pares.length) return;
  const filtro = pares.map(([a, b]) => `and(de_lat.eq.${a.lat.toFixed(5)},de_lng.eq.${a.lng.toFixed(5)},`
    + `para_lat.eq.${b.lat.toFixed(5)},para_lng.eq.${b.lng.toFixed(5)})`).join(',');
  const { data, error } = await sb().from('trecho').select('de_lat,de_lng,para_lat,para_lng,km').or(filtro);
  if (error) return;   // 42P01 (039 não rodou) ou qualquer outra: calcula sem cache
  for (const t of data || []) {
    _memoria.set(chaveTrecho({ lat: t.de_lat, lng: t.de_lng }, { lat: t.para_lat, lng: t.para_lng }), Number(t.km));
  }
}

// Grava em silêncio. Para a escola o RLS recusa (42501) e é o esperado;
// para quem aprova, uma falha aqui só custa uma consulta a mais depois.
async function gravarTrechos(novos) {
  if (!hasSupabase() || !novos.length) return;
  const linhas = novos.map(([a, b, km]) => ({
    de_lat: Number(a.lat.toFixed(5)), de_lng: Number(a.lng.toFixed(5)),
    para_lat: Number(b.lat.toFixed(5)), para_lng: Number(b.lng.toFixed(5)),
    km, fonte: 'osrm',
  }));
  // try inteiro, e não só no resultado da consulta: quem chama NÃO aguarda
  // esta função (gravar o cache não pode atrasar a tela), e uma exceção
  // do próprio cliente viraria rejeição sem ninguém para tratá-la.
  try {
    await sb().from('trecho')
      .upsert(linhas, { onConflict: 'de_lat,de_lng,para_lat,para_lng', ignoreDuplicates: true });
  } catch (_) { /* cache é otimização; perder uma gravação só custa uma consulta depois */ }
}

// ── Cálculo ──────────────────────────────────────────────────
// Devolve { status, km, min, faltando, pontos }. Nunca lança.
export async function calcularTrajeto({ participacoes, destino, velocidadeKmh, margemMin }) {
  const base = pontosDaViagem(participacoes, destino);
  const vazio = { ...base, km: null, min: null };
  if (base.status !== 'ok') return vazio;

  const pares = base.pontos.slice(1).map((b, i) => [base.pontos[i], b]);
  const faltam = () => pares.filter(([a, b]) => !_memoria.has(chaveTrecho(a, b)));

  try { if (faltam().length) await lerTrechos(faltam()); } catch (_) { /* segue sem cache */ }

  if (faltam().length) {
    // Uma chamada com a sequência inteira devolve todos os trechos: mais
    // barato que perguntar só pelos que faltam, um a um.
    const r = await distanciaPorEstrada(base.pontos);
    if (r.status !== 'ok' || r.trechosKm.length !== pares.length) return { ...vazio, status: r.status === 'ok' ? 'erro' : r.status };
    const novos = [];
    pares.forEach(([a, b], i) => {
      const k = chaveTrecho(a, b);
      if (!_memoria.has(k)) novos.push([a, b, r.trechosKm[i]]);
      _memoria.set(k, r.trechosKm[i]);
    });
    gravarTrechos(novos);
  }

  const km = Math.round(pares.reduce((t, [a, b]) => t + _memoria.get(chaveTrecho(a, b)), 0) * 10) / 10;
  return { ...base, km, min: minutosDeTrajeto(km, base.paradas, { velocidadeKmh, margemMin }) };
}

// O retrato que vai para a solicitação (spec D4).
export const retratoTrajeto = (r) => ({
  trajeto_km: r.km, trajeto_min: r.min, trajeto_status: r.status, trajeto_em: agoraISO(),
});

// Recalcula a partir do banco e grava - para quem aprova, depois de
// mexer nas paradas. O destino vem do cadastro de locais pelo `local_id`,
// e não de um embed: `solicitacao_participacao` também aponta para
// `local`, e o PostgREST recusa embed com duas relações possíveis.
export async function atualizarTrajeto(solicitacao, { velocidadeKmh, margemMin }) {
  const [partes, locais] = await Promise.all([
    getParticipacoes(solicitacao.id).catch(() => []),
    getLocais().catch(() => []),
  ]);
  const destino = locais.find(l => l.id === solicitacao.local_id) || null;
  const r = await calcularTrajeto({ participacoes: partes, destino, velocidadeKmh, margemMin });
  if (!hasSupabase()) return r;
  const { error } = await sb().from('solicitacao_transporte')
    .update(retratoTrajeto(r)).eq('id', solicitacao.id);
  // 42703: a 039 ainda não rodou. O cálculo vale para a tela mesmo assim.
  if (error && error.code !== '42703') throw error;
  return r;
}

// O que a pessoa lê sobre o trajeto, em qualquer tela que o mostre. Texto
// e não markup - quem desenha é a view, e escapa.
const kmTexto = (km) => String(km).replace('.', ',');

export function explicarTrajeto(r) {
  if (!r?.status) return '';
  if (r.status === 'ok') return `${kmTexto(r.km)} km · cerca de ${r.min} min de viagem`;
  const nao = 'Tempo de viagem não calculado:';
  if (r.status === 'sem_coordenada') {
    const n = r.faltando || [];
    return n.length
      ? `${nao} ${n.join(', ')} ${n.length > 1 ? 'estão' : 'está'} sem localização no cadastro.`
      : `${nao} há parada sem localização no cadastro.`;
  }
  if (r.status === 'sem_destino') return `${nao} o destino não tem localização. Escolher um local do cadastro resolve.`;
  // Zero paradas também dá `sem_rota`, mas "não há estrada" seria mentira
  // - não há de onde sair.
  if (r.status === 'sem_rota' && r.paradas === 0) return `${nao} a viagem não tem escola ativa.`;
  if (r.status === 'sem_rota') return `${nao} não há rota por estrada entre as paradas e o destino.`;
  return `${nao} o serviço de mapa não respondeu agora.`;
}
