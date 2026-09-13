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

// Decide um pedido criando a frota extra do dia, numa transação (RPC da
// migration 040). `status` null só cria o lote - é o remanejamento, que
// não muda a situação do pedido. Spec 2026-09-13-sate-ciclo-de-aprovacao.
export async function decidirComFrota({ solicitacaoId, status = null, rotuloId, onibus = 0, vans = 0 }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data, error } = await sb().rpc('decidir_com_frota', {
    p_solicitacao: solicitacaoId, p_status: status, p_rotulo: rotuloId, p_onibus: onibus, p_vans: vans,
  });
  if (error) throw error;
  _frotas = null;
  return data;
}

// Lotes que nasceram de um pedido e deixaram de fazer sentido (spec D3):
// o pedido foi negado ou cancelado, ou foi REMANEJADO para uma data que o
// lote não cobre. Não somem sozinhos - quem aprova decide.
export async function getFrotasOrfas() {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('frota')
    .select('*, rotulo:frota_rotulo(nome), solicitacao:solicitacao_transporte(id, status, data, atividade_livre)')
    .not('solicitacao_id', 'is', null);
  if (error) { if (ausente(error)) return []; throw error; }
  return (data || []).filter(ehOrfa);
}

// Pura, exportada para teste.
export function ehOrfa(f) {
  const s = f.solicitacao;
  if (!s || ['negado', 'cancelado'].includes(s.status)) return true;
  return !(f.inicio <= s.data && (!f.fim || f.fim >= s.data));
}

// "Manter": o lote deixa de ser do pedido e vira reforço comum.
export async function manterLote(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('frota').update({ solicitacao_id: null }).eq('id', id);
  if (error) throw error;
  _frotas = null;
}

export function limparCacheFrota() { _rotulos = null; _frotas = null; }
