// ============================================================
// FundHub — modules/servidores/servidores.model.js
// A PESSOA. Existe independentemente de onde trabalha: nome,
// documentos, nascimento, contato, ingresso na rede.
//
// Onde ela trabalha, com que cargo e desde quando é assunto do
// VÍNCULO (vinculos.model.js). Cargo e lotação foram atributos do
// servidor até a migration 023 e deixaram de ser: eram duas fontes de
// verdade para o mesmo fato, e se contradiziam.
//
// As colunas `cargo` e `lotacao` continuam no banco (histórico e
// auditoria) e não são mais lidas nem escritas por aqui.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { slug } from '../../shared/dom.js';
// Telefones vêm da tabela dedicada (fonte única) — model → model.
import { getTelefonesMapas } from '../telefones/telefones.model.js';

const SEL = `*, vinculos:vinculo(
  id, unidade_id, papel, ingresso, fim,
  unidade:unidade_escolar(id, nome, apelido, tipo)
)`;

let _cache = null;
export function limparCacheServidores() { _cache = null; }

export async function getServidores() {
  if (_cache) return _cache;
  if (!hasSupabase()) { _cache = []; return _cache; }
  const [{ data, error }, tel] = await Promise.all([
    sb().from('servidor').select(SEL).order('nome'),
    getTelefonesMapas(),
  ]);
  // Migration 023 ainda não rodou: sem a coluna `tipo`, o embed de
  // unidade_escolar quebra a query inteira — refaz sem ela. Quem
  // consome trata `tipo` ausente como "não é sede" (mesma idiom de
  // `=== 'sede'` usada em todo o app), então a degradação é segura.
  if (error?.code === '42703') {
    const SEL_SEM_TIPO = SEL.replace(', tipo', '');
    const { data: d2, error: e2 } = await sb().from('servidor').select(SEL_SEM_TIPO).order('nome');
    if (e2) throw e2;
    _cache = (d2 || []).map(s => ({
      ...s, vinculos: s.vinculos || [], telefones: tel.porServidor[s.id] || [],
    }));
    return _cache;
  }
  if (error) throw error;
  _cache = (data || []).map(s => ({
    ...s, vinculos: s.vinculos || [], telefones: tel.porServidor[s.id] || [],
  }));
  return _cache;
}

// ── Derivações do vínculo ────────────────────────────────────
// Aberto = SEM data de fim. Uma regra, um lugar.
export const vinculosAbertos = (s) => (s?.vinculos || []).filter(v => !v.fim);

// A lotação é o nome do local do vínculo aberto — escola ou SME.
// Mais de um vínculo aberto acontece (alguém responde por duas
// unidades) e esconder isso seria mentir.
export function lotacaoDe(s) {
  const nomes = vinculosAbertos(s)
    .map(v => v.unidade?.apelido || v.unidade?.nome)
    .filter(Boolean);
  return [...new Set(nomes)].join(' · ');
}

export function cargoDe(s) {
  const cargos = vinculosAbertos(s).map(v => v.papel).filter(Boolean);
  return [...new Set(cargos)].join(' · ');
}

// Servidores com vínculo ABERTO numa unidade. Usado por Horários.
export async function getServidoresDaUnidade(unidadeId) {
  const todos = await getServidores();
  return todos.filter(s => vinculosAbertos(s).some(v => v.unidade_id === unidadeId));
}

// ── CRUD servidor ────────────────────────────────────────────
const CAMPOS = ['nome', 'apelido', 'email', 'cpf', 'rg', 'nascimento',
  'inicio_rede', 'codigo_funcional'];

function limpar(p) {
  const out = {};
  for (const k of CAMPOS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

// `chave` é unique: gera a partir do nome e desempata se já existir.
async function chaveLivre(nome) {
  const base = slug(nome) || 'servidor';
  const { data } = await sb().from('servidor').select('chave').like('chave', `${base}%`);
  const usadas = new Set((data || []).map(r => r.chave));
  if (!usadas.has(base)) return base;
  let n = 2;
  while (usadas.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export async function criarServidor(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { ...limpar(payload), chave: await chaveLivre(payload.nome) };
  const { data, error } = await sb().from('servidor').insert(row).select().single();
  // Migration 023 ainda não rodou: grava sem a data de nascimento.
  if (error?.code === '42703' && 'nascimento' in row) {
    delete row.nascimento;
    const retry = await sb().from('servidor').insert(row).select().single();
    if (retry.error) throw retry.error;
    _cache = null;
    return retry.data;
  }
  if (error) throw error;
  _cache = null;
  return data;
}

export async function atualizarServidor(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = limpar(payload);
  const { error } = await sb().from('servidor').update(patch).eq('id', id);
  if (error?.code === '42703' && 'nascimento' in patch) {
    delete patch.nascimento;
    const retry = await sb().from('servidor').update(patch).eq('id', id);
    if (retry.error) throw retry.error;
    _cache = null;
    return;
  }
  if (error) throw error;
  _cache = null;
}

// Apaga o servidor. Os vínculos e horários caem junto (on delete cascade)
// — assim como os afastamentos dele. É por isso que a tela avisa.
export async function excluirServidor(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('servidor').delete().eq('id', id);
  if (error) throw error;
  _cache = null;
}
