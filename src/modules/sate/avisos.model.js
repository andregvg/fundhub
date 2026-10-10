// ============================================================
// FundHub - modules/sate/avisos.model.js
// Os AVISOS do SATE: o que aconteceu numa solicitação, para quem
// interessa, e se a pessoa já viu.
// Spec: 2026-10-10-sate-notificacoes-design.md.
//
// O aviso é um FATO gravado pelo banco (`solicitacao_aviso`, por gatilho);
// o "visto" é de cada pessoa (`solicitacao_visto`). Não lido = aviso mais
// novo que o visto daquela solicitação. Abrir a solicitação marca o visto
// e limpa todos os avisos dela de uma vez.
//
// QUEM RECEBE não é gravado: o banco entrega o aviso a quem enxerga a
// solicitação (RLS), e aqui se tira o que a própria pessoa fez e o que ela
// desligou nas preferências. As regras são puras, para o teste fixá-las.
//
// É API pública do módulo: o serviço do sino (modules/notificacoes) lê
// daqui. Nunca toca no DOM.
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { pref } from '../../core/configuracoes.js';
import { subscribeTabela } from '../../shared/realtime.js';
import { hojeISO, addDias, fmtData } from '../../shared/format.js';

// Título e tom de cada tipo. `tipo` é o tom do balão (shared/ui/toast.js).
const TIPOS = Object.freeze({
  nova: { titulo: 'Nova solicitação', tipo: 'info' },
  solicitado: { titulo: 'Solicitado', tipo: 'info' },
  em_analise: { titulo: 'Em análise', tipo: 'atencao' },
  aguardando_transporte_adaptado: { titulo: 'Aguardando adaptado', tipo: 'atencao' },
  confirmado: { titulo: 'Confirmado', tipo: 'sucesso' },
  negado: { titulo: 'Negado', tipo: 'erro' },
  cancelado: { titulo: 'Cancelado', tipo: 'erro' },
  pendente_cancelamento: { titulo: 'Pedido de cancelamento', tipo: 'atencao' },
  reaberta: { titulo: 'Solicitação reaberta', tipo: 'atencao' },
  editada: { titulo: 'Data ou horário alterado', tipo: 'atencao' },
  parada_acrescentada: { titulo: 'Escola acrescentada à viagem', tipo: 'info' },
  saida_pedida: { titulo: 'Pedido de saída', tipo: 'atencao' },
  saida_confirmada: { titulo: 'Saída confirmada', tipo: 'erro' },
});

// ── Quem recebe o quê (puras) ────────────────────────────────
// Três públicos (spec D3). Quem aprova é quem tem escrita no SATE; a
// Equipe da SME com leitura vê a rede inteira e por isso nasce com tudo
// desligado; o resto é a escola, que só enxerga as próprias solicitações.
export const publicoDe = (nivel) => (nivel === 'escrita' ? 'aprovador' : nivel === 'leitura' ? 'leitor' : 'escola');

export const PADRAO_AVISOS = Object.freeze({
  aprovador: Object.freeze({ avisos_pedidos_escola: true, avisos_equipe: false }),
  escola: Object.freeze({ avisos_decisao: true, avisos_andamento: true }),
  leitor: Object.freeze({ avisos_decisao: false, avisos_andamento: false }),
});

const PEDIDOS_DA_ESCOLA = ['pendente_cancelamento', 'saida_pedida'];
const DECISOES = ['confirmado', 'negado', 'cancelado'];

// A preferência que governa um tipo de aviso para aquele público.
// `null` = não é configurável: quem aprova é SEMPRE avisado de pedido novo.
export function chaveDoAviso(tipo, publico) {
  if (publico === 'aprovador') {
    if (tipo === 'nova') return null;
    return PEDIDOS_DA_ESCOLA.includes(tipo) ? 'avisos_pedidos_escola' : 'avisos_equipe';
  }
  return DECISOES.includes(tipo) ? 'avisos_decisao' : 'avisos_andamento';
}

const mesmoEmail = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

export function interessa(aviso, { email, publico, prefs = {} }) {
  if (mesmoEmail(aviso.autor, email)) return false;   // ninguém é avisado do que ele mesmo fez
  const chave = chaveDoAviso(aviso.tipo, publico);
  if (chave === null) return true;
  const escolha = prefs[chave];
  return typeof escolha === 'boolean' ? escolha : !!PADRAO_AVISOS[publico]?.[chave];
}

// Compara INSTANTES, não texto: o banco devolve frações de segundo de
// tamanhos diferentes, e a ordem alfabética erraria.
const instante = (ts) => Date.parse(ts) || 0;

export const naoLidos = (avisos, vistos = {}) =>
  (avisos || []).filter(a => instante(a.em) > instante(vistos[a.solicitacao_id]));

// Os avisos da mesma solicitação ficam JUNTOS, o mais recente em cima; e a
// solicitação com a novidade mais recente vem primeiro.
export function ordenarAvisos(avisos) {
  const maisNovo = new Map();
  for (const a of avisos || []) maisNovo.set(a.solicitacao_id, Math.max(maisNovo.get(a.solicitacao_id) || 0, instante(a.em)));
  return [...(avisos || [])].sort((a, b) =>
    (maisNovo.get(b.solicitacao_id) - maisNovo.get(a.solicitacao_id))
    || String(a.solicitacao_id).localeCompare(String(b.solicitacao_id))
    || (instante(b.em) - instante(a.em)));
}

// O que a pessoa lê: título = o que houve; apoio = escola · destino · data.
// `nomes`: id da unidade → nome. Aviso de parada fala da escola da parada.
export function descrever(aviso, nomes = {}) {
  const t = TIPOS[aviso.tipo] || { titulo: 'Solicitação atualizada', tipo: 'atencao' };
  const s = aviso.solicitacao || {};
  const escola = nomes[aviso.unidade_id || s.unidade_id] || 'Gerência de Transporte';
  const texto = [escola, s.destino_nome || s.atividade_livre || '', s.data ? fmtData(s.data) : ''].filter(Boolean).join(' · ');
  return { titulo: t.titulo, tipo: t.tipo, texto };
}

// ── Estado ───────────────────────────────────────────────────
const COLS = 'id, solicitacao_id, tipo, unidade_id, autor, em,'
  + ' solicitacao:solicitacao_transporte(id, data, destino_nome, atividade_livre, unidade_id)';
const JANELA_DIAS = 60;

let _avisos = [];
let _vistos = {};
let _email = null;
let _publico = 'escola';
const _ouvintes = new Set();

const prefs = () => ({
  avisos_pedidos_escola: pref('sate', 'avisos_pedidos_escola'),
  avisos_equipe: pref('sate', 'avisos_equipe'),
  avisos_decisao: pref('sate', 'avisos_decisao'),
  avisos_andamento: pref('sate', 'avisos_andamento'),
});
const meInteressa = (a) => interessa(a, { email: _email, publico: _publico, prefs: prefs() });

function avisar() {
  for (const fn of _ouvintes) { try { fn(); } catch (err) { console.warn('[sate] ouvinte de avisos:', err); } }
}

// Carrega os avisos recentes e os vistos da pessoa. QUALQUER falha vira
// "sem avisos" (inclusive tabela ausente, 42P01, antes da migration 048):
// o sino informa, e não pode derrubar o resto do app.
export async function carregarAvisos({ nivel } = {}) {
  if (nivel) _publico = publicoDe(nivel);
  if (!hasSupabase()) { _avisos = []; _vistos = {}; avisar(); return; }
  try {
    _email = _email || await emailAtual();
    const { data, error } = await sb().from('solicitacao_aviso').select(COLS)
      .gte('em', addDias(hojeISO(), -JANELA_DIAS)).order('em', { ascending: false }).limit(200);
    if (error) throw error;
    _avisos = data || [];
    const ids = [...new Set(_avisos.map(a => a.solicitacao_id))];
    _vistos = {};
    if (ids.length) {
      const v = await sb().from('solicitacao_visto').select('solicitacao_id, visto_em').in('solicitacao_id', ids);
      if (v.error) throw v.error;
      for (const r of v.data || []) _vistos[r.solicitacao_id] = r.visto_em;
    }
  } catch (err) {
    console.warn('[sate] avisos indisponíveis:', err?.message || err);
    _avisos = []; _vistos = {};
  }
  avisar();
}

// Os que estão por ver e interessam à pessoa, na ordem do sino.
export const pendentes = () => ordenarAvisos(naoLidos(_avisos, _vistos).filter(meInteressa));

export const idsComNovidade = () => new Set(pendentes().map(a => a.solicitacao_id));

// Chegou um aviso pelo Realtime: o evento traz só a linha crua, então
// busca o aviso com a solicitação junto. O RLS decide se a pessoa o
// enxerga - se não, a busca volta vazia e nada acontece. Devolve o aviso
// só se ele interessa (é o que decide o balão).
export async function receberAviso(id) {
  if (!hasSupabase() || id == null || _avisos.some(a => a.id === id)) return null;
  const { data, error } = await sb().from('solicitacao_aviso').select(COLS).eq('id', id).maybeSingle();
  if (error || !data) return null;
  _avisos.unshift(data);
  avisar();
  return meInteressa(data) ? data : null;
}

// Abrir a solicitação marca o visto, com a hora do BANCO (o aviso é
// carimbado lá; o relógio do navegador pode estar adiantado ou atrasado).
// Enquanto a resposta não chega, a tela já trata como visto: se a gravação
// falhar, o aviso reaparece na próxima carga - melhor que travar a ficha.
export async function marcarVisto(solicitacaoId) {
  if (!hasSupabase() || !solicitacaoId) return;
  const tinha = idsComNovidade().has(solicitacaoId);
  const maisNovo = _avisos.filter(a => a.solicitacao_id === solicitacaoId).map(a => a.em)
    .sort((a, b) => instante(b) - instante(a))[0];
  if (maisNovo) _vistos[solicitacaoId] = maisNovo;
  if (tinha) avisar();
  const { data, error } = await sb().rpc('marcar_solicitacao_vista', { p_solicitacao: solicitacaoId });
  if (error) { console.warn('[sate] visto não gravado:', error.message); return; }
  if (data) _vistos[solicitacaoId] = data;
}

export function aoMudarAvisos(fn) {
  _ouvintes.add(fn);
  return () => _ouvintes.delete(fn);
}

export function subscribeAvisos(handler) {
  return subscribeTabela('solicitacao_aviso', handler, 'solic-aviso-rt');
}

export function limparAvisos() {
  _avisos = []; _vistos = {}; _email = null; _publico = 'escola';
}
