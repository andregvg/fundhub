// ============================================================
// FundHub - modules/sate/sate.model.js
// Solicitações de transporte: leitura e ciclo de vida.
// Spec: 2026-09-08-sate-modelo-de-dados-design.md § D4, D5, D8.
//
// A frota mora em `frota.model.js`, as regras puras em `regras.model.js`,
// a conta de vagas em `disponibilidade.model.js` e as escolas de cada
// viagem em `participacoes.model.js` - os cinco são API pública do
// módulo. Aqui fica a VIAGEM: ler, criar e mover no ciclo de vida.
//
// `qtd_alunos` e `qtd_cadeirante` no cabeçalho são CACHE da soma das
// participações ativas, mantido por gatilho (migration 037). Nunca
// escrever esses campos daqui: a verdade é a participação.
//
// O saldo saiu daqui em 08/09/2026, quando o arquivo passou do teto de
// 250 linhas (R11). Não foi corte arbitrário para caber: "quantos
// veículos estão livres" é um agregado próprio, que lê a frota E as
// solicitações e não pertence a nenhuma das duas.
//
// O que mudou do v1: negar e cancelar deixaram de ser a mesma coisa,
// justificativa é obrigatória nos dois (CHECK no banco, não só na tela),
// e o saldo passou a ser DO DIA - a frota é de veículos, não uma cota
// por período (§ D4).
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { subscribeTabela } from '../../shared/realtime.js';
import { agoraISO } from '../../shared/format.js';

// Um lugar só para os rótulos (regras.model.js); reexportado porque as
// telas e os agregadores já importam daqui.
export { PERIODOS } from './regras.model.js';

export const STATUS = Object.freeze({
  solicitado: 'Solicitado',
  em_analise: 'Em análise',
  aguardando_transporte_adaptado: 'Aguardando adaptado',
  confirmado: 'Confirmado',
  pendente_cancelamento: 'Pendente de cancelamento',
  negado: 'Negado',
  cancelado: 'Cancelado',
});

// Status que OCUPAM veículo. `solicitado` entra desde 26/09/2026 (spec
// 2026-09-26, D6): sem ele, duas escolas viam "1 livre" e as duas pediam
// o mesmo ônibus. `pendente_cancelamento` fica de fora de propósito: a
// vaga volta ao saldo no momento em que a escola pede, não no da ciência.
export const STATUS_RESERVA = Object.freeze(['solicitado', 'em_analise', 'aguardando_transporte_adaptado', 'confirmado']);

const SELECT_BASE =
  '*, atividade:atividade_extraclasse(nome,cor,usa_onibus,local_nome,local_endereco,gerida_sme),'
  + ' unidade:unidade_escolar(nome,apelido,endereco)';

const ausente = (err) => err?.code === '42P01' || err?.code === '42703';

// ── Leitura ──────────────────────────────────────────────────
export async function listSolicitacoes({ status, de, ate, unidadeId, id } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('solicitacao_transporte').select(SELECT_BASE).order('data', { ascending: false });
  if (status) q = Array.isArray(status) ? q.in('status', status) : q.eq('status', status);
  if (de) q = q.gte('data', de);
  if (ate) q = q.lte('data', ate);
  if (unidadeId) q = q.eq('unidade_id', unidadeId);
  if (id) q = q.eq('id', id);
  const { data, error } = await q;
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
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
// Criar viagem é UM ato que nasce em duas tabelas - o cabeçalho e a
// participação da escola que pediu. Vai por RPC porque, em duas chamadas
// do PostgREST, uma falha no meio deixaria uma viagem sem ninguém
// dentro: visível só para quem escreve, com zero alunos, e sem nada na
// tela explicando de onde veio.
export async function criarSolicitacao(viagem, participacao) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data, error } = await sb().rpc('criar_viagem', {
    p_viagem: viagem, p_participacao: participacao,
  });
  if (error) throw error;
  return data;
}

// Remanejar (quem aprova): data, período, horários, destino, veículos.
// Os totais de estudantes NÃO entram - são cache das participações.
export async function editarSolicitacao(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('solicitacao_transporte')
    .update({ ...payload, atualizado_em: agoraISO() }).eq('id', id);
  if (error) throw error;
}

// Destino digitado pela escola, ainda sem local do cadastro (spec
// 2026-09-27, D6). Derivado, não guardado: não tem como dessincronizar.
export const localAConferir = (s) => !s?.local_id && !!s?.destino_nome;

// Os pedidos com destino digitado que ainda não são local do cadastro
// (spec 2026-10-10-sate-endereco-e-cep, D8). Negado e cancelado ficam de
// fora: não há mais viagem para a qual conferir o endereço.
export async function destinosAConferir() {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_transporte')
    .select(SELECT_BASE).is('local_id', null).not('destino_nome', 'is', null)
    .not('status', 'in', '(negado,cancelado)').order('data');
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
}

// A SME apontou o destino digitado para um local do cadastro ("É este" ou
// "Cadastrar novo"). Vale para o LUGAR: `ids` são todos os pedidos que
// digitaram aquele destino, e mudam juntos. Troca SÓ o destino - data,
// horários, escolas e veículos ficam. O texto da escola fica no audit_log.
export async function vincularLocal(ids, local) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = {
    local_id: local.id,
    destino_nome: local.nome,
    destino_endereco: local.endereco || null,
    destino_numero: local.numero || null,
    destino_bairro: local.bairro || null,
    // Só quando o local tem CEP: sem a migration 047 a coluna não existe.
    ...(local.cep ? { destino_cep: local.cep } : {}),
  };
  const { error } = await sb().from('solicitacao_transporte')
    .update({ ...patch, atualizado_em: agoraISO() }).in('id', [].concat(ids));
  if (error) throw error;
  return patch;
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

// ── O que cabe em cada situação ──────────────────────────────
// As ações de uma solicitação, por situação e por quem olha (spec
// 2026-10-10-sate-solicitacao, D4 e D5). Pura: a ficha só desenha o que
// sai daqui. Esconder botão é conforto; quem barra de fato é o RLS (R6).
//
//   editar    - o lápis: só quem aprova, e só antes de confirmar. Para
//               editar um pedido confirmado, primeiro se reabre.
//   decisoes  - na ordem em que os botões aparecem.
const EDITAVEL = ['solicitado', 'em_analise', 'aguardando_transporte_adaptado'];
const DECISOES = {
  aprovador: {
    solicitado: ['analisar', 'negar', 'confirmar'],
    em_analise: ['negar', 'confirmar'],
    aguardando_transporte_adaptado: ['negar', 'confirmar'],
    confirmado: ['reabrir', 'cancelar'],
    pendente_cancelamento: ['ciencia'],
    negado: ['reabrir'],
    cancelado: ['reabrir'],
  },
  escola: { solicitado: ['cancelar'], confirmado: ['pedir'] },
};

export function acoesDoPedido(s, { aprovador = false, somenteLeitura = false } = {}) {
  // Vendo como a escola: os botões seriam os dela, mas quem clicaria tem
  // os poderes de quem aprova no banco. Nada.
  if (somenteLeitura) return { editar: false, decisoes: [] };
  const mapa = aprovador ? DECISOES.aprovador : DECISOES.escola;
  return { editar: aprovador && EDITAVEL.includes(s?.status), decisoes: [...(mapa[s?.status] || [])] };
}

// Reabrir desfaz uma decisão: negado, cancelado ou confirmado voltam para
// análise, de onde saem confirmar e negar. Limpa quem decidiu, quando e a
// justificativa - o que houve antes continua no audit_log. Pura, para o
// teste fixar exatamente o que muda.
export const alteracaoDeReabertura = (agora) => ({
  status: 'em_analise', motivo: null, decidido_por: null, decidido_em: null, atualizado_em: agora,
});

export async function reabrirSolicitacao(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  // Só reabre o que está decidido: a tela pode estar velha, ou outro
  // aprovador ter reaberto na frente.
  const { data, error } = await sb().from('solicitacao_transporte')
    .update(alteracaoDeReabertura(agoraISO())).eq('id', id)
    .in('status', ['confirmado', 'negado', 'cancelado']).select('id');
  if (error) throw error;
  if (!data?.length) {
    const e = new Error('Esta solicitação já não está confirmada, negada nem cancelada. Atualize a lista.');
    e.amigavel = true; throw e;
  }
}

// ── Realtime ─────────────────────────────────────────────────
export function subscribeSolicitacoes(handler) {
  return subscribeTabela('solicitacao_transporte', handler, 'solic-rt');
}
