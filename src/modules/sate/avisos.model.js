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
// Quem CONTA o que está por ver é o banco (`avisos_por_ver`, migration 048):
// quem aprova enxerga a rede inteira, e filtrar no navegador os N fatos mais
// recentes deixaria cair, em silêncio, um aviso antigo ainda não aberto.
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
import { fmtData } from '../../shared/format.js';

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

// Os tipos que a pessoa quer receber - o que o front manda ao banco para
// ele devolver só o que interessa (o banco tira o que é dela e o que já viu).
export const tiposDeInteresse = (publico, prefs = {}) =>
  Object.keys(TIPOS).filter(tipo => interessa({ tipo, autor: null }, { email: null, publico, prefs }));

// Compara INSTANTES, não texto: o banco devolve frações de segundo de
// tamanhos diferentes, e a ordem alfabética erraria.
const instante = (ts) => Date.parse(ts) || 0;

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
// Linha de avisos_por_ver() → o formato que descrever() lê.
const deLinha = (r) => ({
  id: r.id, solicitacao_id: r.solicitacao_id, tipo: r.tipo, unidade_id: r.unidade_id, autor: r.autor, em: r.em,
  solicitacao: { data: r.solic_data, destino_nome: r.solic_destino, atividade_livre: r.solic_atividade, unidade_id: r.solic_unidade },
});
const LIMITE = 300;

let _avisos = [];   // o que está por ver, como o banco devolveu
let _email = null;
let _publico = 'escola';
// Sobe a cada limparAvisos(): uma resposta do banco que chega depois da saída
// (logout) vê que a geração mudou e não escreve nada.
let _geracao = 0;
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

// Carrega o que está por ver. A conta é do banco (avisos_por_ver, migration
// 048): tipos que a pessoa quer, feitos por outra pessoa, mais novos que o
// "visto" dela. QUALQUER falha vira "sem avisos" (inclusive função ou
// tabela ausente, antes da 048): o sino informa, e não pode derrubar o app.
export async function carregarAvisos({ nivel } = {}) {
  if (nivel) _publico = publicoDe(nivel);
  if (!hasSupabase()) { _avisos = []; avisar(); return; }
  const g = _geracao;
  try {
    if (!_email) {
      const email = await emailAtual();
      if (g !== _geracao) return;
      _email = email;
    }
    const { data, error } = await sb().rpc('avisos_por_ver', { p_tipos: tiposDeInteresse(_publico, prefs()) });
    if (g !== _geracao) return;
    if (error) throw error;
    _avisos = (data || []).map(deLinha);
  } catch (err) {
    if (g !== _geracao) return;
    console.warn('[sate] avisos indisponíveis:', err?.message || err);
    _avisos = [];
  }
  avisar();
}

// Por ver e do interesse da pessoa, na ordem do sino. O filtro de novo
// aqui faz uma preferência desligada valer na hora, sem esperar a recarga.
export const pendentes = () => ordenarAvisos(_avisos.filter(meInteressa));

export const idsComNovidade = () => new Set(pendentes().map(a => a.solicitacao_id));

// Chegou um aviso pelo Realtime: o evento traz só a linha crua. Pergunta
// ao banco por ele - a mesma função da carga, que só o devolve se a pessoa
// o enxerga, não foi ela que fez e ainda não viu. Devolve o aviso quando
// ele entra na lista (é o que decide o balão).
export async function receberAviso(id) {
  if (!hasSupabase() || id == null || _avisos.some(a => a.id === id)) return null;
  const g = _geracao;
  try {
    if (!_email) {
      const email = await emailAtual();
      if (g !== _geracao) return null;
      _email = email;
    }
    const { data, error } = await sb().rpc('avisos_por_ver', { p_tipos: tiposDeInteresse(_publico, prefs()), p_id: id });
    if (g !== _geracao || error || !data?.length) return null;
    // De novo depois da espera: o mesmo evento pode chegar duas vezes
    // (reconexão), ou a carga pode ter trazido o aviso nesse meio-tempo.
    if (_avisos.some(a => a.id === id)) return null;
    const aviso = deLinha(data[0]);
    _avisos.unshift(aviso);
    if (_avisos.length > LIMITE) _avisos.length = LIMITE;
    avisar();
    return aviso;
  } catch (_) { return null; }
}

// Abrir a solicitação tira os avisos dela do sino. A hora do "visto" é a
// do BANCO (a RPC usa now()): o aviso é carimbado lá. A tela não espera a
// resposta; se a gravação falhar, o aviso volta na próxima carga.
export async function marcarVisto(solicitacaoId) {
  if (!hasSupabase() || !solicitacaoId) return;
  const antes = _avisos.length;
  _avisos = _avisos.filter(a => a.solicitacao_id !== solicitacaoId);
  if (_avisos.length !== antes) avisar();
  // Quem chama não espera nem trata erro (a ficha não depende disso): daqui
  // não sai rejeição.
  try {
    const { error } = await sb().rpc('marcar_solicitacao_vista', { p_solicitacao: solicitacaoId });
    if (error) console.warn('[sate] visto não gravado:', error.message);
  } catch (err) {
    console.warn('[sate] visto não gravado:', err?.message || err);
  }
}

export function aoMudarAvisos(fn) {
  _ouvintes.add(fn);
  return () => _ouvintes.delete(fn);
}

export function subscribeAvisos(handler) {
  return subscribeTabela('solicitacao_aviso', handler, 'solic-aviso-rt');
}

export function limparAvisos() {
  _geracao++;
  _avisos = []; _email = null; _publico = 'escola';
}
