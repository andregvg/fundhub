// ============================================================
// FundHub - modules/sate/frota.model.js
// A frota de veículos do SATE: rótulos, lançamentos e o total do dia.
// Spec: 2026-09-08-sate-modelo-de-dados-design.md § D1-D3, D10.
//
// O modelo em uma frase: `fim` nulo = a frota EM ABERTO (a vigente, uma
// por tipo); `fim` preenchido = um LOTE com prazo, que soma. Cadastrar
// uma nova aberta encerra a anterior - e isso acontece dentro da função
// `abrir_frota()` do banco, numa transação só, porque em duas chamadas
// um erro no meio deixaria o dia sem frota nenhuma.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';

export const TIPOS = Object.freeze([
  { id: 'onibus', rotulo: 'Ônibus' },
  { id: 'van_adaptada', rotulo: 'Van adaptada' },
]);

export const rotulaTipo = (t) => TIPOS.find(x => x.id === t)?.rotulo || t;

let _rotulos = null;
let _frotas = null;

// Migration aplicada à mão: entre o deploy e o SQL o banco ainda não tem
// estas tabelas. 42P01 = tabela ausente, 42703 = coluna ausente. A tela
// degrada para saldo zero em vez de quebrar (.claude/rules/dados.md).
const ausente = (err) => err?.code === '42P01' || err?.code === '42703';

// ── Rótulos ──────────────────────────────────────────────────
export async function getRotulos({ incluirArquivados = false } = {}) {
  if (!hasSupabase()) return [];
  if (_rotulos && !incluirArquivados) return _rotulos;
  let q = sb().from('frota_rotulo').select('*').order('nome');
  if (!incluirArquivados) q = q.eq('ativo', true);
  const { data, error } = await q;
  if (error) { if (ausente(error)) return []; throw error; }
  if (!incluirArquivados) _rotulos = data || [];
  return data || [];
}

export async function criarRotulo(nome) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe o nome do rótulo.');
  const { data, error } = await sb().from('frota_rotulo')
    .insert({ nome: limpo }).select().single();
  if (error) {
    // 23505 = o índice único por nome normalizado. "Feira do Livro" e
    // "Feira do livro" seriam dois grupos no relatório - por isso o
    // banco recusa, e por isso a mensagem explica o que houve.
    if (error.code === '23505') {
      const e = new Error('Já existe um rótulo com esse nome.');
      e.code = error.code; e.amigavel = true; throw e;
    }
    throw error;
  }
  _rotulos = null;
  return data;
}

// Arquivar some do combobox e preserva o nome nas frotas antigas.
export async function arquivarRotulo(id, ativo = false) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('frota_rotulo').update({ ativo }).eq('id', id);
  if (error) throw error;
  _rotulos = null;
}

// Só rótulo SEM frota vinculada pode ser excluído - o banco recusa o
// resto (`on delete restrict`), senão uma frota antiga perderia o nome
// no histórico. Quem está em uso se arquiva.
export async function excluirRotulo(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('frota_rotulo').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      const e = new Error('Este rótulo já foi usado em uma frota. Arquive-o em vez de excluir.');
      e.code = error.code; e.amigavel = true; throw e;
    }
    throw error;
  }
  _rotulos = null;
}

// ── Frota ────────────────────────────────────────────────────
// `vigenteEm` (data civil) filtra o que vale naquele dia: começou antes
// ou no dia, e ou não terminou ou terminou depois.
export async function getFrotas({ vigenteEm = null, tipo = null } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('frota')
    .select('*, rotulo:frota_rotulo(nome, ativo)')
    .order('inicio', { ascending: false });
  if (tipo) q = q.eq('tipo', tipo);
  if (vigenteEm) q = q.lte('inicio', vigenteEm).or(`fim.is.null,fim.gte.${vigenteEm}`);
  const { data, error } = await q;
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
}

// A frota vigente (sem data-fim) de cada tipo. No máximo uma por tipo -
// o índice único do banco garante, não a boa vontade do código.
export async function getFrotaAberta(tipo = 'onibus') {
  if (!hasSupabase()) return null;
  const { data, error } = await sb().from('frota')
    .select('*, rotulo:frota_rotulo(nome)')
    .eq('tipo', tipo).is('fim', null).maybeSingle();
  if (error) { if (ausente(error)) return null; throw error; }
  return data;
}

// Abre uma frota nova em aberto, encerrando a anterior na véspera. RPC
// porque as duas coisas precisam ser uma transação só (spec D1).
export async function abrirFrota({ rotuloId, quantidade, inicio, tipo = 'onibus', observacao = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data, error } = await sb().rpc('abrir_frota', {
    p_rotulo_id: rotuloId, p_quantidade: quantidade,
    p_inicio: inicio, p_tipo: tipo, p_observacao: observacao,
  });
  if (error) throw error;
  _frotas = null;
  return data;
}

// Um lote com prazo: a Feira do Livro, o Cirem, ou a frota extra que
// nasce de uma aprovação que estourou o limite (`solicitacaoId`).
export async function criarLote({ rotuloId, quantidade, inicio, fim, tipo = 'onibus', observacao = null, solicitacaoId = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  if (!fim) throw new Error('Um lote de frota precisa de data de fim. Para a frota vigente, use "abrir frota".');
  const { data, error } = await sb().from('frota').insert({
    rotulo_id: rotuloId, tipo, quantidade, inicio, fim,
    observacao, solicitacao_id: solicitacaoId,
  }).select().single();
  if (error) throw error;
  _frotas = null;
  return data;
}

export async function excluirFrota(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('frota').delete().eq('id', id);
  if (error) throw error;
  _frotas = null;
}

// Encerra uma frota aberta numa data, sem abrir outra no lugar.
export async function encerrarFrota(id, fim) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('frota').update({ fim }).eq('id', id);
  if (error) throw error;
  _frotas = null;
}

// ── Total do dia ─────────────────────────────────────────────
// A soma de TODA frota vigente na data, por tipo. É "quantos veículos
// existem naquele dia" - não uma cota por período: o mesmo ônibus serve
// manhã e tarde, e é isso que a regra do intervalo mínimo governa
// (spec D4).
export async function totalDoDia(dataISO) {
  const base = { onibus: 0, van_adaptada: 0 };
  if (!hasSupabase() || !dataISO) return base;
  const { data, error } = await sb().from('frota')
    .select('tipo, quantidade')
    .lte('inicio', dataISO)
    .or(`fim.is.null,fim.gte.${dataISO}`);
  if (error) { if (ausente(error)) return base; throw error; }
  for (const f of data || []) base[f.tipo] = (base[f.tipo] || 0) + (f.quantidade || 0);
  return base;
}

// Totais de vários dias numa consulta só - o painel de saldo de um mês
// faria 30 idas ao banco sem isto. Devolve { 'yyyy-mm-dd': {...} }.
export async function totalPorDia(deISO, ateISO) {
  if (!hasSupabase() || !deISO || !ateISO) return {};
  const { data, error } = await sb().from('frota')
    .select('tipo, quantidade, inicio, fim')
    .lte('inicio', ateISO)
    .or(`fim.is.null,fim.gte.${deISO}`);
  if (error) { if (ausente(error)) return {}; throw error; }

  const out = {};
  for (let d = deISO; d <= ateISO; d = proximoDia(d)) {
    const base = { onibus: 0, van_adaptada: 0 };
    for (const f of data || []) {
      if (f.inicio <= d && (!f.fim || f.fim >= d)) base[f.tipo] = (base[f.tipo] || 0) + (f.quantidade || 0);
    }
    out[d] = base;
  }
  return out;
}

// Aritmética de calendário local ao arquivo: `addDias` de shared/format
// resolveria, mas ele já é importado por sate.model.js e este é o único
// uso aqui. Comparação e incremento sobre `yyyy-mm-dd` (R8).
function proximoDia(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Lotes que nasceram de uma solicitação que não está mais de pé. Não
// somem sozinhos (decisão registrada na spec D2): a tela avisa e quem
// aprova decide manter ou remover.
export async function getFrotasOrfas() {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('frota')
    .select('*, rotulo:frota_rotulo(nome), solicitacao:solicitacao_transporte(id, status, data)')
    .not('solicitacao_id', 'is', null);
  if (error) { if (ausente(error)) return []; throw error; }
  const MORTOS = ['negado', 'cancelado'];
  return (data || []).filter(f => !f.solicitacao || MORTOS.includes(f.solicitacao.status));
}

export function limparCacheFrota() { _rotulos = null; _frotas = null; }
