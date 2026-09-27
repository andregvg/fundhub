// ============================================================
// FundHub - modules/sate/disponibilidade.model.js
// Quantos veículos estão livres para um pedido - por HORÁRIO.
// Spec: 2026-09-26-sate-frota-e-disponibilidade-design.md § D5-D7.
//
// A regra em uma frase: cada viagem ocupa os seus veículos do embarque
// até a volta + tempo de viagem + intervalo mínimo (a da noite, até o
// meio-dia seguinte), e um pedido só cabe se houver veículo livre em
// TODO o intervalo dele. As duas regras antigas - o intervalo manhã →
// tarde e a folga da noite - são consequências desta, e deixaram de
// existir como código à parte.
//
// A conta é PURA e mora aqui para o formulário, a página Disponibilidade
// e as decisões de quem aprova. O banco refaz a mesma conta para barrar a
// escola (`_sate_livres`/`_sate_intervalo`, migration 042) - são ESPELHOS:
// mudou aqui, mude lá, e o teste tests/sate-disponibilidade.test.mjs tem
// os mesmos casos da conferência da migration.
//
// Substitui `saldo.model.js` (saldo por período), apagado na mesma
// entrega - um caminho só.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { addDias } from '../../shared/format.js';
import { paraMin } from './regras.model.js';

export const DIA = 1440;
// Janelas dos períodos, em minutos desde 00:00. A noite vai até o
// meio-dia seguinte: é quando o veículo volta a estar livre (D5).
export const JANELA = Object.freeze({ manha: [0, 720], tarde: [720, 1080], noite: [1080, 2160] });
// Viagem TÍPICA de cada período - o que a página Disponibilidade supõe
// quando ainda não há horário. O formulário confere o horário exato.
export const TIPICO = Object.freeze({ manha: [420, 720], tarde: [720, 1080], noite: [1140, 2160] });

const CAMPO = { onibus: 'onibus', vans: 'vans', van_adaptada: 'vans' };
const minDe = (x) => (typeof x === 'number' ? x : paraMin(x));

// ESPELHO de _sate_intervalo (042).
export function intervaloDaViagem({ periodo, embarque, retorno, trajetoMin = 0, intervaloMin = 0 }) {
  const [jIni, jFim] = JANELA[periodo] || JANELA.manha;
  const e = minDe(embarque);
  let r = minDe(retorno);
  const ini = e ?? jIni;
  let fim;
  if (r == null) {
    fim = jFim;
  } else {
    if (periodo === 'noite' && r < ini) r += DIA;
    fim = r <= ini ? jFim : r + (Number(trajetoMin) || 0) + (Number(intervaloMin) || 0);
  }
  if (periodo === 'noite') fim = Math.max(fim, JANELA.noite[1]);
  if (fim <= ini) fim = ini + 1;
  return { ini, fim };
}

// A resposta de ocupacao_transporte() num eixo só: minutos desde 00:00
// do primeiro dia pedido (o dia 0). O dia -1 é a véspera.
export function montarLinha(resp) {
  const frota = new Map();
  for (const f of resp?.frota || []) {
    frota.set(Number(f.dia), { onibus: Number(f.onibus) || 0, vans: Number(f.vans) || 0 });
  }
  const ocup = (resp?.ocupacoes || []).map(o => ({
    ini: Number(o.dia) * DIA + Number(o.ini),
    fim: Number(o.dia) * DIA + Number(o.fim),
    onibus: Number(o.onibus) || 0,
    vans: Number(o.vans) || 0,
  }));
  return { frota, ocup, intervaloMin: Number(resp?.intervalo_min ?? 120), aproximado: !!resp?.aproximado };
}

export const totalDoDia = (linha, dia, tipo = 'onibus') => linha.frota.get(dia)?.[CAMPO[tipo] || 'onibus'] || 0;

// livres = min sobre t em [ini, fim) de (frota do dia de t - ocupados em t).
// Só se avalia t onde o valor pode CAIR: o início do pedido, cada início
// de ocupação dentro dele e cada virada de dia. Intervalos semiabertos:
// liberado às 14h10 serve o embarque das 14h10. ESPELHO de _sate_livres.
export function livresPara(linha, ini, fim, tipo = 'onibus') {
  const k = CAMPO[tipo] || 'onibus';
  const pontos = new Set([ini]);
  for (const o of linha.ocup) if (o.ini > ini && o.ini < fim) pontos.add(o.ini);
  for (let d = Math.floor(ini / DIA) + 1; d * DIA < fim; d++) pontos.add(d * DIA);
  let min = Infinity;
  for (const t of pontos) {
    const total = linha.frota.get(Math.floor(t / DIA))?.[k] || 0;
    let usado = 0;
    for (const o of linha.ocup) if (o.ini <= t && t < o.fim) usado += o[k];
    min = Math.min(min, total - usado);
  }
  return min;
}

export function livresNoPeriodo(linha, dia, periodo, tipo = 'onibus') {
  const [a, b] = TIPICO[periodo];
  return livresPara(linha, dia * DIA + a, dia * DIA + b, tipo);
}

// A tarde "enche" conforme os ônibus da manhã são liberados: livres para
// uma viagem que embarca em e e vai até o fim da tarde nunca DIMINUI com
// e. Os degraus são os fins de ocupação dentro da tarde; só entram os que
// aumentam o número - "2 livres · 5 a partir das 14h10".
export function escadaDaTarde(linha, dia, tipo = 'onibus') {
  const base = dia * DIA;
  const [a, b] = TIPICO.tarde;
  const inicios = new Set([base + a]);
  for (const o of linha.ocup) if (o.fim > base + a && o.fim < base + b) inicios.add(o.fim);
  const degraus = [];
  for (const e of [...inicios].sort((x, y) => x - y)) {
    const n = livresPara(linha, e, base + b, tipo);
    if (!degraus.length || n > degraus[degraus.length - 1].livres) degraus.push({ aPartirDe: e - base, livres: n });
  }
  return degraus;
}

// O primeiro embarque, depois de `ini` e ainda no período, em que um
// pedido de MESMA duração cabe. Candidatos: os fins de ocupação - só ali o
// número pode subir. A noite não sugere: ela ocupa até o dia seguinte.
export function proximoHorario(linha, { ini, fim, precisa, periodo, tipo = 'onibus' }) {
  if (periodo === 'noite') return null;
  const limite = JANELA[periodo]?.[1] ?? fim;
  const dur = fim - ini;
  const cand = [...new Set(linha.ocup.map(o => o.fim))].filter(t => t > ini && t < limite).sort((x, y) => x - y);
  for (const e of cand) if (livresPara(linha, e, e + dur, tipo) >= precisa) return e;
  return null;
}

// O embarque EFETIVO de uma viagem: o mais cedo entre o do cabeçalho e o
// das paradas ATIVAS - o ônibus sai para a primeira parada. Mesmo
// critério de ocupacao_transporte (042, `least`); ESPELHO também deste
// pedaço, não só de intervaloDaViagem/livresPara. `paradas` ausentes ou
// sem horário válido caem no puro cabeçalho (comportamento de antes).
export function embarqueEfetivo(s, paradas = []) {
  const candidatos = [minDe(s.horario_embarque),
    ...paradas.filter(p => p.status === 'ativa').map(p => minDe(p.horario))].filter(v => v != null);
  return candidatos.length ? Math.min(...candidatos) : null;
}

// Quantos veículos FALTAM para o pedido `s` caber. `linha` precisa vir de
// lerOcupacao(s.data, s.data, { excluir: s.id }): o próprio pedido já
// ocupa (D6), e contá-lo de novo criaria frota extra a mais. `paradas`
// (opcional) são as participações já carregadas - ver embarqueEfetivo.
export function faltaParaConfirmar(s, linha, paradas = []) {
  const { ini, fim } = intervaloDaViagem({
    periodo: s.periodo, embarque: embarqueEfetivo(s, paradas), retorno: s.horario_retorno,
    trajetoMin: s.trajeto_min, intervaloMin: linha.intervaloMin,
  });
  const falta = (tipo, pedido) => (pedido ? Math.max(0, pedido - livresPara(linha, ini, fim, tipo)) : 0);
  return { onibus: falta('onibus', Number(s.qtd_onibus) || 0), vans: falta('vans', Number(s.qtd_vans) || 0) };
}

// ── Leitura ──────────────────────────────────────────────────
// Dev-local: linha vazia (frota zero). Sem a 042, cai no saldo por
// período da 036 e marca `aproximado` - a tela avisa "contagem sem
// horário". QUALQUER falha cai na aproximação, sem relançar: é o mesmo
// raciocínio que saldo.model.js usava (PGRST202 vs 42883).
export async function lerOcupacao(de, ate = de, { excluir = null } = {}) {
  if (!hasSupabase()) return montarLinha(null);
  const { data, error } = await sb().rpc('ocupacao_transporte', { p_de: de, p_ate: ate, p_excluir: excluir });
  if (!error && data) return montarLinha(data);
  if (error) console.warn('[sate] ocupacao_transporte indisponível, contagem por período:', error.message);
  return montarLinha(await aproximarPorPeriodo(de, ate));
}

async function aproximarPorPeriodo(de, ate) {
  const dias = [];
  for (let d = addDias(de, -1), i = -1; d <= addDias(ate, 1); d = addDias(d, 1), i++) dias.push([i, d]);
  const resps = await Promise.all(dias.map(([, d]) =>
    sb().rpc('saldo_transporte', { p_data: d }).then(r => r.data, () => null)));
  const frota = [], ocupacoes = [];
  dias.forEach(([dia], k) => {
    const r = resps[k];
    if (!r) return;
    frota.push({ dia, onibus: r.onibus?.manha?.total || 0, vans: r.van_adaptada?.manha?.total || 0 });
    for (const p of Object.keys(JANELA)) {
      const onibus = r.onibus?.[p]?.uso || 0;
      const vans = r.van_adaptada?.[p]?.uso || 0;
      if (onibus + vans) ocupacoes.push({ dia, ini: JANELA[p][0], fim: JANELA[p][1], onibus, vans });
    }
  });
  return { intervalo_min: 0, frota, ocupacoes, aproximado: true };
}
