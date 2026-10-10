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

import { publicoDe, PADRAO_AVISOS, chaveDoAviso, interessa, tiposDeInteresse, ordenarAvisos, descrever } from './avisos.regras.model.js';
export { publicoDe, PADRAO_AVISOS, chaveDoAviso, interessa, tiposDeInteresse, ordenarAvisos, descrever };

// ── Estado ───────────────────────────────────────────────────
// Linha de avisos_por_ver() → o formato que descrever() lê.
const deLinha = (r) => ({
  id: r.id, solicitacao_id: r.solicitacao_id, tipo: r.tipo, unidade_id: r.unidade_id, autor: r.autor, em: r.em,
  solicitacao: { data: r.solic_data, destino_nome: r.solic_destino, atividade_livre: r.solic_atividade, unidade_id: r.solic_unidade },
});
// Linha de exclusoes_por_ver() → aviso. O id leva prefixo: não colide com o
// de solicitacao_aviso; `exclusaoId` é o que a marca de visto usa.
const deExclusao = (r) => ({
  id: `x${r.id}`, exclusaoId: r.id, solicitacao_id: r.solicitacao_id, tipo: 'excluida', unidade_id: r.unidade_id,
  autor: r.autor, em: r.em, solicitacao: { data: r.data, destino_nome: r.destino_nome, unidade_id: r.unidade_id },
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
    // Antes da 050 a função não existe: sem avisos de exclusão, o resto segue.
    const ex = await sb().rpc('exclusoes_por_ver');
    if (g !== _geracao) return;
    if (!ex.error) _avisos.push(...(ex.data || []).map(deExclusao));
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

// Chegou uma exclusão pelo Realtime: mesma ideia de receberAviso.
export async function receberExclusao(id) {
  if (!hasSupabase() || id == null || _avisos.some(a => a.exclusaoId === id)) return null;
  const g = _geracao;
  try {
    const { data, error } = await sb().rpc('exclusoes_por_ver', { p_id: id });
    if (g !== _geracao || error || !data?.length || _avisos.some(a => a.exclusaoId === id)) return null;
    const aviso = deExclusao(data[0]);
    if (!meInteressa(aviso)) return null;
    _avisos.unshift(aviso);
    avisar();
    return aviso;
  } catch (_) { return null; }
}

// Dispensar o aviso de exclusão: não há solicitação para abrir, então o
// visto é do próprio aviso. Falha de gravação: volta na próxima carga.
export async function dispensarExclusao(exclusaoId) {
  _avisos = _avisos.filter(a => a.exclusaoId !== exclusaoId);
  avisar();
  try {
    const { error } = await sb().from('solicitacao_exclusao_visto')
      .upsert({ email: await emailAtual(), exclusao_id: exclusaoId }, { onConflict: 'email,exclusao_id', ignoreDuplicates: true });
    if (error) console.warn('[sate] visto da exclusão não gravado:', error.message);
  } catch (err) { console.warn('[sate] visto da exclusão não gravado:', err?.message || err); }
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

// As mudanças da própria solicitação (a lista se refaz com elas). O evento de
// exclusão traz só o id: o RLS não filtra o que já não existe.
export function subscribeSolicitacoes(handler) {
  return subscribeTabela('solicitacao_transporte', handler, 'solic-lista-rt');
}

export function subscribeExclusoes(handler) {
  return subscribeTabela('solicitacao_exclusao', handler, 'solic-exclusao-rt');
}

export function limparAvisos() {
  _geracao++;
  _avisos = []; _email = null; _publico = 'escola';
}
