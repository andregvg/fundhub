// ============================================================
// FundHub — modules/afastamentos/afastamentos.model.js
// Afastamentos de servidores (servidor × tipo × período × unidade).
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { subscribeTabela } from '../../shared/realtime.js';

// Vocabulário de tipos. É um SUPERCONJUNTO que cobre também os tipos da
// planilha do Drive (Abonada, LTS, TRE, Férias, Outros) — sem "Falta
// Abonada" e "TRE" o sync perderia registros. Ver MAPA_TIPOS_PLANILHA.
export const TIPOS_AFASTAMENTO = [
  'Férias', 'Falta Abonada', 'Licença Saúde (LTS)', 'Licença Maternidade',
  'Licença Prêmio', 'Atestado', 'TRE (Justiça Eleitoral)', 'Afastamento SME', 'Outro',
];

// Cor por tipo — usada na barra lateral do item e nos chips do calendário.
export const CORES_AFASTAMENTO = {
  'Férias': '#0ea5a4', 'Falta Abonada': '#0ea5e9', 'Licença Saúde (LTS)': '#dc2626',
  'Licença Maternidade': '#db2777', 'Licença Prêmio': '#f59e0b', 'Atestado': '#ea580c',
  'TRE (Justiça Eleitoral)': '#f97316', 'Afastamento SME': '#2563eb', 'Outro': '#64708a',
};

// Como os tipos da aba "Lançamentos" chegam aqui.
export const MAPA_TIPOS_PLANILHA = {
  'abonada': 'Falta Abonada', 'falta abonada': 'Falta Abonada',
  'lts': 'Licença Saúde (LTS)', 'licenca saude': 'Licença Saúde (LTS)',
  'tre': 'TRE (Justiça Eleitoral)',
  'ferias': 'Férias', 'férias': 'Férias',
  'outros': 'Outro', 'outro': 'Outro',
};

// Origem do registro. `planilha`/`formulario` vêm do sync; `manual` é daqui.
export const ORIGEM_AFASTAMENTO = {
  manual: 'Manual', formulario: 'Formulário', planilha: 'Planilha',
};

// Ciclo de vida (mesma semântica da planilha):
//   ativo      — vale.
//   importado  — veio da planilha/formulário e aguarda confirmação da SME.
//   cancelado  — soft-delete; preserva histórico (é o 'excluido' da planilha).
export const STATUS_AFASTAMENTO = {
  ativo: 'Ativo', importado: 'Importado', cancelado: 'Cancelado',
};

const SEL = '*, servidor:servidor(nome,apelido), unidade:unidade_escolar(nome,apelido)';

// Nº de dias (inclusivo) do afastamento; null quando está em aberto.
export function diasAfastamento(a) {
  if (!a?.inicio || !a?.fim) return null;
  const ini = new Date(a.inicio + 'T00:00:00');
  const fim = new Date(a.fim + 'T00:00:00');
  return Math.round((fim - ini) / 86400000) + 1;
}

// Lista afastamentos. Opções:
//   vigentesEm: 'yyyy-mm-dd' — só os vigentes na data.
//   status: 'ativo' | 'cancelado' — filtra por status; ausente = só ativos
//           (os cancelados ficam escondidos por padrão).
// Postgres 42703 = coluna inexistente (migration 018 ainda não rodada).
const SEM_COLUNA = '42703';
const exigeMigration018 = () =>
  new Error('Este recurso exige a migration 018 (status/processo). Rode-a no SQL Editor.');

export async function getAfastamentos({ vigentesEm, status } = {}) {
  if (!hasSupabase()) return [];
  const montar = (comStatus) => {
    let q = sb().from('afastamento').select(SEL).order('inicio', { ascending: false });
    if (comStatus) q = status ? q.eq('status', status) : q.neq('status', 'cancelado');
    if (vigentesEm) q = q.lte('inicio', vigentesEm).or(`fim.is.null,fim.gte.${vigentesEm}`);
    return q;
  };
  let { data, error } = await montar(true);
  // Sem a 018 o módulo continua listando (só não conhece cancelados),
  // em vez de quebrar a tela inteira.
  if (error?.code === SEM_COLUNA) {
    console.warn('Coluna afastamento.status ausente — rode a migration 018.');
    if (status === 'cancelado') return [];
    ({ data, error } = await montar(false));
  }
  if (error) throw error;
  return data || [];
}

// Barra duplicata: mesmo servidor + mesma data de início, ou mesmo processo
// (ignorando cancelados e, na edição, o próprio registro). Inspirado no
// saveAfastamento do Apps Script afastamentos-gestores.
async function checarDuplicata({ servidor_id, inicio, processo }, ignorarId = null) {
  if (!hasSupabase()) return;
  let q1 = sb().from('afastamento').select('id')
    .eq('servidor_id', servidor_id).eq('inicio', inicio).neq('status', 'cancelado');
  if (ignorarId) q1 = q1.neq('id', ignorarId);
  const { data: d1, error: e1 } = await q1;
  if (e1?.code === SEM_COLUNA) return;   // sem a 018 não há como checar; segue
  if (e1) throw e1;
  if (d1?.length) throw new Error('Já existe um afastamento ativo para este servidor com esta data de início.');

  const proc = processo?.trim();
  if (proc) {
    let q2 = sb().from('afastamento').select('id').eq('processo', proc).neq('status', 'cancelado');
    if (ignorarId) q2 = q2.neq('id', ignorarId);
    const { data: d2, error: e2 } = await q2;
    if (e2) throw e2;
    if (d2?.length) throw new Error(`O processo ${proc} já está vinculado a outro afastamento.`);
  }
}

export async function criarAfastamento(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  await checarDuplicata(payload);
  const row = { ...payload, status: 'ativo', criado_por: await emailAtual() };
  const { data, error } = await sb().from('afastamento').insert(row).select().single();
  if (error?.code === SEM_COLUNA) throw exigeMigration018();
  if (error) throw error;
  return data;
}

export async function atualizarAfastamento(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  await checarDuplicata(payload, id);
  const { error } = await sb().from('afastamento').update(payload).eq('id', id);
  if (error?.code === SEM_COLUNA) throw exigeMigration018();
  if (error) throw error;
}

// Soft-delete: preserva a linha (histórico + auditoria).
export async function cancelarAfastamento(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('afastamento').update({ status: 'cancelado' }).eq('id', id);
  if (error?.code === SEM_COLUNA) throw exigeMigration018();
  if (error) throw error;
}

// Reativa um cancelado (revalida duplicata, pois o slot pode ter sido ocupado).
export async function reativarAfastamento(a) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  await checarDuplicata(a, a.id);
  const { error } = await sb().from('afastamento').update({ status: 'ativo' }).eq('id', a.id);
  if (error?.code === SEM_COLUNA) throw exigeMigration018();
  if (error) throw error;
}

// Confirma um afastamento que veio da planilha/formulário (importado → ativo).
export async function confirmarAfastamento(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('afastamento')
    .update({ status: 'ativo', atualizado_em: new Date().toISOString(), atualizado_por: await emailAtual() })
    .eq('id', id);
  if (error?.code === SEM_COLUNA) throw exigeMigration018();
  if (error) throw error;
}

// ── Sincronização com a planilha do Drive ────────────────────
// Espelha a aba "Lançamentos". IDEMPOTENTE: `chave_externa` (a mesma
// identidade que o Apps Script usa — tipo|nome|inicio|criado_em) faz a
// reimportação ATUALIZAR a linha, nunca duplicar. Rodar de novo o mesmo
// recorte da planilha é seguro.
export async function sincronizarPlanilha(rows) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  if (!rows.length) return 0;
  const { error } = await sb().from('afastamento')
    .upsert(rows, { onConflict: 'chave_externa' });
  if (error?.code === SEM_COLUNA) {
    throw new Error('Este recurso exige a migration 020 (sincronização). Rode-a no SQL Editor.');
  }
  if (error) throw error;
  return rows.length;
}

// Exclusão definitiva (apaga de vez) — só faz sentido para limpar cancelados.
export async function excluirAfastamento(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('afastamento').delete().eq('id', id);
  if (error) throw error;
}

// Realtime: notifica novos afastamentos e mudanças. Requer a migration 014.
export function subscribeAfastamentos(handler) {
  return subscribeTabela('afastamento', handler, 'afast-rt');
}
