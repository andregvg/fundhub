// ============================================================
// FundHub — modules/servidores/servidores.model.js
// Servidores (gestores, coordenadores, supervisores) e seus VÍNCULOS
// com as escolas. São duas entidades e dois CRUDs:
//
//   servidor  — a pessoa. Existe independente de onde trabalha.
//   vinculo   — pessoa × escola × papel × ano. É temporal: um servidor
//               pode ter mais de um vínculo (duas escolas, ou uma troca
//               de papel no ano seguinte).
//
// A tabela `servidor` exige uma `chave` única — derivamos do nome e
// desempatamos com sufixo, para o cadastro pela tela não quebrar.
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { slug } from '../../shared/dom.js';
// Telefones vêm da tabela dedicada (fonte única) — model → model.
import { getTelefonesMapas } from '../telefones/telefones.model.js';

export const PAPEIS = ['gestor', 'coordenador', 'supervisor'];

export const ROTULO_PAPEL = {
  gestor: 'Gestor(a)',
  coordenador: 'Coordenador(a)',
  supervisor: 'Supervisor(a)',
};
export const rotulaPapel = (p) => ROTULO_PAPEL[p] || p;

// Ano letivo corrente — os vínculos e horários são por ano.
export const ANO_LETIVO = new Date().getFullYear();

const SEL = `*, vinculos:vinculo(
  id, unidade_id, papel, ano, ativo, ingresso, fim,
  unidade:unidade_escolar(id, nome, apelido)
)`;

let _cache = null;
export function limparCacheServidores() { _cache = null; }

// Lista servidores com os vínculos e os telefones embutidos.
export async function getServidores() {
  if (_cache) return _cache;
  if (!hasSupabase()) { _cache = []; return _cache; }
  const [{ data, error }, tel] = await Promise.all([
    sb().from('servidor').select(SEL).order('nome'),
    getTelefonesMapas(),
  ]);
  if (error) throw error;
  _cache = (data || []).map(s => ({
    ...s, vinculos: s.vinculos || [], telefones: tel.porServidor[s.id] || [],
  }));
  return _cache;
}

// Servidores com vínculo ativo numa unidade, no ano. Usado por Horários.
export async function getServidoresDaUnidade(unidadeId, ano = ANO_LETIVO) {
  const todos = await getServidores();
  return todos.filter(s => s.vinculos.some(v =>
    v.unidade_id === unidadeId && v.ano === ano && v.ativo));
}

// ── CRUD servidor ────────────────────────────────────────────
// `telefone` (singular) saiu: os telefones moram na tabela `telefone`
// e são sincronizados à parte pela view (ver telefones.model.js).
const CAMPOS = ['nome', 'apelido', 'email', 'cpf', 'rg', 'inicio_rede'];

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
  if (error) throw error;
  _cache = null;
  return data;
}

export async function atualizarServidor(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('servidor').update(limpar(payload)).eq('id', id);
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

// ── CRUD vínculo ─────────────────────────────────────────────
export async function criarVinculo({ servidor_id, unidade_id, papel, ano = ANO_LETIVO, ingresso = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { servidor_id, unidade_id, papel, ano, ingresso, ativo: true };
  const { data, error } = await sb().from('vinculo').insert(row).select().single();
  if (error) {
    // unique (servidor_id, unidade_id, papel, ano)
    if (error.code === '23505') throw new Error('Este servidor já tem esse papel nesta escola, neste ano.');
    throw error;
  }
  _cache = null;
  return data;
}

export async function atualizarVinculo(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('vinculo').update(payload).eq('id', id);
  if (error) throw error;
  _cache = null;
}

// Encerrar ≠ excluir: o vínculo passado é histórico e deve ser preservado.
// A tela oferece as duas coisas, com botões diferentes.
export async function encerrarVinculo(id, fim) {
  return atualizarVinculo(id, { ativo: false, fim });
}

export async function excluirVinculo(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('vinculo').delete().eq('id', id);
  if (error) throw error;
  _cache = null;
}
