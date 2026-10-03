// ============================================================
// FundHub - modules/servidores/servidores.model.js
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
import { registrarCache } from '../../shared/cache.js';
// Telefones vêm da tabela dedicada (fonte única) - model → model.
import { getTelefonesMapas } from '../telefones/telefones.model.js';

// As colunas que podem faltar entram por partes: migrations são aplicadas
// à mão, e entre o deploy e o SQL a consulta precisa cair para a forma que
// o banco já entende (42703), em vez de quebrar a tela.
const sel = ({ funcao, tipo }) => `*, vinculos:vinculo(
  id, unidade_id, papel, ${funcao ? 'funcao, ' : ''}ingresso, fim,
  unidade:unidade_escolar(id, nome, apelido${tipo ? ', tipo' : ''})
)`;
// Da mais completa para a mais antiga: tudo → sem a função do gestor (045)
// → sem o tipo da unidade (023). Quem consome trata `funcao` ausente como
// "não definida" e `tipo` ausente como "não é sede".
const FORMAS = [{ funcao: true, tipo: true }, { funcao: false, tipo: true }, { funcao: false, tipo: false }];

let _cache = null;
export function limparCacheServidores() { _cache = null; }
registrarCache(limparCacheServidores);

export async function getServidores() {
  if (_cache) return _cache;
  if (!hasSupabase()) { _cache = []; return _cache; }
  // Telefones e servidores não dependem um do outro: disparados juntos. O
  // catch vazio evita rejeição solta se o laço lançar antes do await abaixo;
  // o `await telP` do caminho de sucesso continua propagando o erro.
  const telP = getTelefonesMapas();
  telP.catch(() => {});
  let ultimo = null;
  for (const forma of FORMAS) {
    const { data, error } = await sb().from('servidor').select(sel(forma)).order('nome');
    if (error?.code === '42703') { ultimo = error; continue; }
    if (error) throw error;
    const tel = await telP;
    _cache = (data || []).map(s => ({
      ...s, vinculos: s.vinculos || [], telefones: tel.porServidor[s.id] || [],
    }));
    return _cache;
  }
  throw ultimo;
}

// ── Derivações do vínculo ────────────────────────────────────
// Aberto = SEM data de fim. Uma regra, um lugar.
export const vinculosAbertos = (s) => (s?.vinculos || []).filter(v => !v.fim);

// O local de trabalho é o nome da unidade do vínculo aberto - escola,
// Sede ou local interno da SME. Mais de um vínculo aberto acontece
// (alguém responde por duas unidades) e esconder isso seria mentir.
// `completo`: o nome oficial em vez do apelido. O apelido existe para
// caber no card da lista; no cabeçalho da ficha e no formulário há
// espaço, e é o nome oficial que se confere. Qual nome representa o
// local de trabalho é regra de domínio - por isso está aqui, não na view (R3).
export function localDeTrabalhoDe(s, { completo = false } = {}) {
  const nomes = vinculosAbertos(s)
    .map(v => (completo ? v.unidade?.nome : (v.unidade?.apelido || v.unidade?.nome)))
    .filter(Boolean);
  return [...new Set(nomes)].join(' · ');
}

export function cargoDe(s) {
  const cargos = vinculosAbertos(s).map(v => v.papel).filter(Boolean);
  return [...new Set(cargos)].join(' · ');
}

// Função do gestor (spec 2026-10-03, D12): 1 ou 2, só no cargo Gestor(a).
// Entra no RÓTULO do cargo - "Gestor(a) 1" - e não num elemento novo de
// tela. Mora aqui, com as outras derivações do vínculo, e não em
// vinculos.model.js: aquele importa este, e o contrário fecharia um ciclo.
export const CARGO_GESTOR = 'Gestor(a)';
export function rotulaVinculo(v) {
  const cargo = v?.papel || '';
  return cargo === CARGO_GESTOR && (v.funcao === 1 || v.funcao === 2) ? `${cargo} ${v.funcao}` : cargo;
}

// Como cargoDe, mas para EXIBIR: com a função. cargoDe continua sendo a
// chave de comparação (filtro por cargo, equipe gestora) - "Gestor(a) 1"
// não é um cargo, é um cargo com função.
export function cargoExibidoDe(s) {
  return [...new Set(vinculosAbertos(s).map(rotulaVinculo).filter(Boolean))].join(' · ');
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
// - assim como os afastamentos dele. É por isso que a tela avisa.
export async function excluirServidor(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('servidor').delete().eq('id', id);
  if (error) throw error;
  _cache = null;
}
