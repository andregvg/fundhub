// ============================================================
// FundHub - modules/sate/sate.model.js
// Solicitações de transporte: leitura, ciclo de vida e saldo do dia.
// Spec: 2026-09-08-sate-modelo-de-dados-design.md § D4, D5, D8.
//
// A frota mora em `frota.model.js` e as regras puras em
// `regras.model.js` - os três são API pública do módulo. Aqui fica o
// que precisa de banco e de estado: a solicitação e o saldo.
//
// O que mudou do v1: negar e cancelar deixaram de ser a mesma coisa,
// justificativa é obrigatória nos dois (CHECK no banco, não só na tela),
// e o saldo passou a ser DO DIA - a frota é de veículos, não uma cota
// por período (§ D4).
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { subscribeTabela } from '../../shared/realtime.js';
import { agoraISO, addDias } from '../../shared/format.js';
import { totalDoDia } from './frota.model.js';

export const PERIODOS = Object.freeze({ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' });

export const STATUS = Object.freeze({
  solicitado: 'Solicitado',
  em_analise: 'Em análise',
  aguardando_transporte_adaptado: 'Aguardando adaptado',
  confirmado: 'Confirmado',
  pendente_cancelamento: 'Pendente de cancelamento',
  negado: 'Negado',
  cancelado: 'Cancelado',
});

// Status que OCUPAM veículo. `pendente_cancelamento` fica de fora de
// propósito: a vaga volta ao saldo no momento em que a escola pede, não
// no da ciência - é o que o agendamentos-fil faz, e segurar um ônibus
// por causa de uma formalidade desperdiça frota.
export const STATUS_RESERVA = Object.freeze(['em_analise', 'aguardando_transporte_adaptado', 'confirmado']);

const SELECT_BASE =
  '*, atividade:atividade_extraclasse(nome,cor,usa_onibus,local_nome,local_endereco,gerida_sme),'
  + ' unidade:unidade_escolar(nome,apelido,endereco)';

const ausente = (err) => err?.code === '42P01' || err?.code === '42703';

// ── Leitura ──────────────────────────────────────────────────
export async function listSolicitacoes({ status, de, ate, unidadeId } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('solicitacao_transporte').select(SELECT_BASE).order('data', { ascending: false });
  if (status) q = Array.isArray(status) ? q.in('status', status) : q.eq('status', status);
  if (de) q = q.gte('data', de);
  if (ate) q = q.lte('data', ate);
  if (unidadeId) q = q.eq('unidade_id', unidadeId);
  const { data, error } = await q;
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
}

export async function getSolicitacaoPorId(id) {
  if (!hasSupabase()) return null;
  const { data, error } = await sb().from('solicitacao_transporte')
    .select(SELECT_BASE).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Solicitações de um dia (Dashboard).
export async function getSolicitacoesDoDia(dataISO) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_transporte')
    .select(SELECT_BASE).eq('data', dataISO).order('periodo');
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
}

// Programação do dia: só as confirmadas, com origem e destino (Viagens).
export async function getViagensDoDia(dataISO) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_transporte')
    .select(SELECT_BASE).eq('data', dataISO).eq('status', 'confirmado').order('periodo');
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
}

// ── Escrita ──────────────────────────────────────────────────
export async function criarSolicitacao(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { ...payload, criado_por: await emailAtual(), status: 'solicitado' };
  const { data, error } = await sb().from('solicitacao_transporte').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function editarSolicitacao(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('solicitacao_transporte')
    .update({ ...payload, atualizado_em: agoraISO() }).eq('id', id);
  if (error) throw error;
}

// Toda transição passa por aqui: é o único lugar que carimba quem
// decidiu e quando, e o único que sabe quais status exigem motivo.
async function transicionar(id, status, motivo = null) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = { status, atualizado_em: agoraISO() };
  if (motivo != null) patch.motivo = String(motivo).trim();
  if (['confirmado', 'negado', 'cancelado'].includes(status)) {
    patch.decidido_por = await emailAtual();
    patch.decidido_em = agoraISO();
  }
  const { error } = await sb().from('solicitacao_transporte').update(patch).eq('id', id);
  if (error) {
    // 23514 = o CHECK de justificativa. A tela já exige o campo; se
    // chegou aqui vazio, a mensagem diz o porquê em vez do texto cru.
    if (error.code === '23514') {
      const e = new Error('Negar ou cancelar exige uma justificativa.');
      e.code = error.code; e.amigavel = true; throw e;
    }
    throw error;
  }
}

// Aprovar e negar: só quem tem escrita em `sate` (o RLS confirma).
export const porEmAnalise = (id) => transicionar(id, 'em_analise');
export const aguardarAdaptado = (id) => transicionar(id, 'aguardando_transporte_adaptado');
export const confirmarSolicitacao = (id) => transicionar(id, 'confirmado');

export function negarSolicitacao(id, motivo) {
  if (!String(motivo || '').trim()) throw new Error('Informe o motivo da negativa.');
  return transicionar(id, 'negado', motivo);
}

// Antes de aprovada, a escola cancela sozinha.
export function cancelarSolicitacao(id, motivo) {
  if (!String(motivo || '').trim()) throw new Error('Informe o motivo do cancelamento.');
  return transicionar(id, 'cancelado', motivo);
}

// Depois de aprovada, a escola PEDE - e a vaga volta ao saldo já aqui.
export function pedirCancelamento(id, motivo) {
  if (!String(motivo || '').trim()) throw new Error('Informe o motivo do pedido.');
  return transicionar(id, 'pendente_cancelamento', motivo);
}

// A ciência de quem aprova fecha o ciclo. Não pede motivo novo: herda o
// que a escola escreveu no pedido.
export const confirmarCancelamento = (id) => transicionar(id, 'cancelado');

// ── Pontos de embarque ───────────────────────────────────────
// Só quem aprova escreve aqui (RLS): juntar escolas num mesmo ônibus é
// decisão da Gerência de Transporte, não da escola.
export async function getEmbarques(solicitacaoId) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_embarque')
    .select('*, unidade:unidade_escolar(nome,apelido,endereco), local:local(nome,endereco)')
    .eq('solicitacao_id', solicitacaoId).order('ordem');
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
}

// Substitui a lista inteira. Apagar e reinserir, em vez de casar linha a
// linha: a lista tem poucos itens e a ordem é reescrita junto - um
// upsert por `ordem` deixaria órfã a parada removida do fim.
export async function salvarEmbarques(solicitacaoId, paradas) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error: eDel } = await sb().from('solicitacao_embarque')
    .delete().eq('solicitacao_id', solicitacaoId);
  if (eDel) throw eDel;
  if (!paradas?.length) return;

  const linhas = paradas.map((p, i) => ({
    solicitacao_id: solicitacaoId,
    ordem: i + 1,
    // Chaves sempre presentes, com null explícito: chave `undefined`
    // some do JSON e quebra o lote inteiro (.claude/rules/dados.md).
    unidade_id: p.unidadeId || null,
    local_id: p.localId || null,
    horario: p.horario || null,
    qtd_alunos: p.qtdAlunos ?? null,
  }));
  const { error } = await sb().from('solicitacao_embarque').insert(linhas);
  if (error) throw error;
}

// ── Saldo ────────────────────────────────────────────────────
// Veículos COMPROMETIDOS por período num dia. Só os status de reserva.
export async function usoDoDia(dataISO) {
  const base = { onibus: { manha: 0, tarde: 0, noite: 0 }, van_adaptada: { manha: 0, tarde: 0, noite: 0 } };
  if (!hasSupabase() || !dataISO) return base;
  const { data, error } = await sb().from('solicitacao_transporte')
    .select('periodo, qtd_onibus, qtd_vans, status')
    .eq('data', dataISO).in('status', STATUS_RESERVA);
  if (error) { if (ausente(error)) return base; throw error; }
  for (const r of data || []) {
    if (!base.onibus[r.periodo]) continue;
    base.onibus[r.periodo] += r.qtd_onibus || 0;
    base.van_adaptada[r.periodo] += r.qtd_vans || 0;
  }
  return base;
}

// O saldo de um dia: total (do dia, § D4) menos o comprometido em cada
// período. `livre` nunca é negativo na exibição - um dia estourado por
// exceção de aprovador mostra zero livre, e o excesso aparece como
// `estouro`, que é o número que interessa a quem aprova.
//
// A CONTA VEM DO BANCO, por `saldo_transporte()` (migration 036), e não
// de somar as linhas aqui. O motivo é o RLS: uma escola só lê as
// solicitações em que está envolvida, então somar pelo cliente daria a
// ela o próprio uso e mais nada - "9 de 9 livres" num dia lotado, na
// tela que existe justamente para avisar que as vagas acabaram.
//
// A função é `security definer` e devolve só CONTAGEM: nenhuma escola,
// nenhum horário, nada que diga de quem é a reserva.
export async function saldoDoDia(dataISO) {
  const monta = (tipo, bruto) => {
    const out = {};
    for (const p of Object.keys(PERIODOS)) {
      const t = bruto?.[tipo]?.[p]?.total || 0;
      const u = bruto?.[tipo]?.[p]?.uso || 0;
      out[p] = { total: t, uso: u, livre: Math.max(0, t - u), estouro: Math.max(0, u - t) };
    }
    return out;
  };

  if (hasSupabase()) {
    const { data, error } = await sb().rpc('saldo_transporte', { p_data: dataISO });
    if (!error && data) return { onibus: monta('onibus', data), van_adaptada: monta('van_adaptada', data) };
    // QUALQUER falha cai na soma pelo cliente, sem relançar. O caso comum
    // é a 036 ainda não ter rodado - e aí o PostgREST devolve `PGRST202`,
    // não o `42883` do Postgres, o que faria uma checagem por código
    // específico deixar a tela quebrar em vez de degradar. Como a rota
    // alternativa É o comportamento anterior (certo para quem aprova,
    // otimista para a escola), cair nela nunca é pior que falhar.
    if (error) console.warn('[sate] saldo_transporte indisponível, somando no cliente:', error.message);
  }

  const [total, uso] = await Promise.all([totalDoDia(dataISO), usoDoDia(dataISO)]);
  const bruto = {};
  for (const tipo of ['onibus', 'van_adaptada']) {
    bruto[tipo] = {};
    for (const p of Object.keys(PERIODOS)) {
      bruto[tipo][p] = { total: total[tipo] || 0, uso: uso[tipo][p] || 0 };
    }
  }
  return { onibus: monta('onibus', bruto), van_adaptada: monta('van_adaptada', bruto) };
}

// Só o que a regra (b) precisa do dia seguinte: ônibus livres de manhã.
export async function livreManhaSeguinte(dataISO) {
  const s = await saldoDoDia(addDias(dataISO, 1));
  return s.onibus.manha.livre;
}

// ── Realtime ─────────────────────────────────────────────────
export function subscribeSolicitacoes(handler) {
  return subscribeTabela('solicitacao_transporte', handler, 'solic-rt');
}
