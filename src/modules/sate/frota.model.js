// ============================================================
// FundHub - modules/sate/frota.model.js
// A frota de veículos do SATE: rótulos e lançamentos.
// Spec: 2026-09-08-sate-modelo-de-dados-design.md § D1-D3, D10.
//
// O modelo em uma frase: `fim` nulo = frota EM ABERTO, uma por rótulo e
// tipo (042); `fim` preenchido = um LOTE com prazo, que soma. Cadastrar
// uma nova aberta encerra a anterior - e isso acontece dentro da função
// `abrir_frota()` do banco, numa transação só, porque em duas chamadas
// um erro no meio deixaria o dia sem frota nenhuma.
//
// "Quantos veículos estão livres" - por dia OU por horário - mora em
// `disponibilidade.model.js` (spec 2026-09-26, D5-D7): lê a frota E as
// solicitações, e não pertence a nenhum dos dois.
// ============================================================
import { registrarCache } from '../../shared/cache.js';
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

// Os erros que o banco devolve ao gravar frota, em português. 23505 = o
// índice de UMA aberta por rótulo e tipo; 23514 = fim antes do início.
function amigavel(error) {
  const msg = error.code === '23505'
    ? 'Já existe uma frota em aberto com este rótulo e tipo. Encerre-a ou use outro rótulo.'
    : error.code === '23514' ? 'A data de fim não pode ser antes do início.' : null;
  if (!msg) return error;
  const e = new Error(msg); e.code = error.code; e.amigavel = true; return e;
}

// Abre uma frota nova em aberto, encerrando a anterior na véspera. RPC
// porque as duas coisas precisam ser uma transação só (spec D1).
export async function abrirFrota({ rotuloId, quantidade, inicio, tipo = 'onibus', observacao = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data, error } = await sb().rpc('abrir_frota', {
    p_rotulo_id: rotuloId, p_quantidade: quantidade,
    p_inicio: inicio, p_tipo: tipo, p_observacao: observacao,
  });
  if (error) throw amigavel(error);
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
  if (error) throw amigavel(error);
  _frotas = null;
  return data;
}

export async function excluirFrota(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('frota').delete().eq('id', id);
  if (error) throw error;
  _frotas = null;
}

// ── Situação (pura) ──────────────────────────────────────────
// Sempre relativa a hoje, data civil (R8): comparar yyyy-mm-dd como
// string é comparar datas.
export const SITUACOES = Object.freeze({ vigente: 'Vigente', futura: 'Futura', encerrada: 'Encerrada' });

export function situacaoDaFrota(f, hoje) {
  if (f.inicio > hoje) return 'futura';
  if (f.fim && f.fim < hoje) return 'encerrada';
  return 'vigente';
}

// `de`/`ate`: frotas que valem em ALGUM dia do intervalo. Vazio = sem recorte.
export function filtrarFrotas(lista, { situacao = 'vigente', tipo = '', de = '', ate = '' } = {}, hoje) {
  return (lista || []).filter(f =>
    (situacao === 'todas' || situacaoDaFrota(f, hoje) === situacao)
    && (!tipo || f.tipo === tipo)
    && (!ate || f.inicio <= ate)
    && (!de || !f.fim || f.fim >= de));
}

// Há alguma frota cadastrada? É a porta de entrada da primeira viagem
// (spec B, D4). `head: true` - só a contagem, nenhuma linha trafega.
export async function existeFrota() {
  if (!hasSupabase()) return false;
  const { count, error } = await sb().from('frota').select('id', { count: 'exact', head: true });
  if (error) { if (ausente(error)) return false; throw error; }
  return (count || 0) > 0;
}

// Edição direta da linha. Mudar a quantidade de uma frota que já valia
// reescreve o passado - para "a partir de tal dia são 12", a tela oferece
// Nova frota com o mesmo rótulo (abrir_frota encerra a anterior).
export async function editarFrota(id, { rotuloId, tipo, quantidade, inicio, fim = null, observacao = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('frota').update({
    rotulo_id: rotuloId, tipo, quantidade, inicio, fim: fim || null, observacao,
  }).eq('id', id);
  if (error) throw amigavel(error);
  _frotas = null;
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

// O botão Atualizar do cabeçalho limpa este cache junto com os outros.
// Até 13/09/2026 a função existia sem estar registrada - rótulo ou lote
// criado em outra aba só aparecia depois de recarregar a página.
registrarCache(() => { _rotulos = null; _frotas = null; });
