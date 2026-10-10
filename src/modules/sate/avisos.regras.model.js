// ============================================================
// FundHub - modules/sate/avisos.regras.model.js
// As REGRAS PURAS dos avisos do SATE: o que cada tipo diz, quem recebe o
// quê e como se ordena e se descreve. Sem banco, sem estado - o teste as
// fixa. O estado e a leitura ficam em avisos.model.js, que reexporta isto.
// ============================================================
import { fmtData } from '../../shared/format.js';

// Título e tom de cada tipo. `tipo` é o tom do balão (shared/ui/toast.js).
export const TIPOS = Object.freeze({
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
  // Não vem de solicitacao_aviso (a solicitação já não existe): vem de solicitacao_exclusao.
  excluida: { titulo: 'Solicitação excluída', tipo: 'erro' },
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
const DECISOES = ['confirmado', 'negado', 'cancelado', 'excluida'];

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
