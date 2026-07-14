// ============================================================
// FundHub — data.js  (camada de acesso a dados)
// Fonte de dados: Supabase (RLS). NENHUM dado real é versionado —
// o repositório é público. Para desenvolvimento local, o app tenta
// carregar data/unidades.local.json (gitignored); se não existir,
// mostra estado vazio. As telas consomem sempre a mesma forma de
// objeto, independente da origem.
// ============================================================
import { sb, hasSupabase } from './sb.js';

export { hasSupabase };
export function source() { return hasSupabase() ? 'supabase' : 'local'; }

// Normaliza uma linha do Supabase para a mesma forma do JSON local.
function fromDb(u, pessoasByUnidade) {
  return {
    id: u.id, numero: u.numero, nome: u.nome, nome_oficial: u.nome_oficial, apelido: u.apelido,
    segmento: u.segmento, endereco: u.endereco, telefones: u.telefones || [],
    email: u.email, regional: u.regional_id != null ? String(u.regional_id) : '',
    tem_transporte: u.tem_transporte, oferta: u.oferta, tem_eja: u.tem_eja,
    inep: u.inep, pdde: u.pdde, site_apm: u.site_apm, drive_id: u.drive_id,
    pessoas: pessoasByUnidade[u.id] || [],
  };
}

let _cache = null;
export async function getUnidades() {
  if (_cache) return _cache;

  if (hasSupabase()) {
    const cli = sb();
    const [{ data: unidades, error: e1 }, { data: vw, error: e2 }] = await Promise.all([
      cli.from('unidade_escolar').select('*').order('nome'),
      cli.from('vw_escola_pessoas').select('*'),
    ]);
    if (e1) throw e1;
    const byU = {};
    (vw || []).forEach(r => {
      (byU[r.unidade_id] ||= []).push({
        papel: rotulaPapel(r.papel), nome: r.pessoa_nome, apelido: r.apelido,
        email: r.email, telefone: r.telefone,
      });
    });
    _cache = (unidades || []).map(u => fromDb(u, byU));
    return _cache;
  }

  // modo dev local: arquivo gitignored, ausente em produção → estado vazio
  try {
    const resp = await fetch('data/unidades.local.json', { cache: 'no-cache' });
    if (!resp.ok) { _cache = []; return _cache; }
    const json = await resp.json();
    _cache = json.unidades || [];
  } catch (_) {
    _cache = [];
  }
  return _cache;
}

function rotulaPapel(p) {
  return { gestor: 'Gestor(a)', coordenador: 'Coordenador(a)', supervisor: 'Supervisor(a)' }[p] || p;
}

// Campos editáveis de uma unidade escolar (o resto é derivado/sistema).
const CAMPOS_UNIDADE = ['nome', 'nome_oficial', 'apelido', 'segmento', 'endereco',
  'telefones', 'email', 'oferta', 'tem_transporte', 'tem_eja', 'inep', 'site_apm',
  'latitude', 'longitude', 'whatsapp', 'link_prestacao_contas'];

function limparPayloadUnidade(p) {
  const out = {};
  for (const k of CAMPOS_UNIDADE) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

export async function criarUnidade(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data, error } = await sb().from('unidade_escolar')
    .insert(limparPayloadUnidade(payload)).select().single();
  if (error) throw error;
  _cache = null;
  return data;
}

export async function atualizarUnidade(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = { ...limparPayloadUnidade(payload), atualizado_em: new Date().toISOString() };
  const { error } = await sb().from('unidade_escolar').update(patch).eq('id', id);
  if (error) throw error;
  _cache = null;
}

export async function excluirUnidade(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('unidade_escolar').delete().eq('id', id);
  if (error) throw error;
  _cache = null;
}

// ── SATE ─────────────────────────────────────────────────────
let _atvCache = null;
export async function getAtividades() {
  if (_atvCache) return _atvCache;
  if (!hasSupabase()) { _atvCache = []; return _atvCache; }
  const { data, error } = await sb()
    .from('atividade_extraclasse').select('*').eq('ativo', true).order('nome');
  if (error) throw error;
  _atvCache = data || [];
  return _atvCache;
}

// Solicitações de um dia (ISO yyyy-mm-dd), com nomes de atividade/unidade.
export async function getSolicitacoesDoDia(dataISO) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb()
    .from('solicitacao_transporte')
    .select('*, atividade:atividade_extraclasse(nome,cor), unidade:unidade_escolar(nome,apelido)')
    .eq('data', dataISO)
    .order('periodo');
  if (error) throw error;
  return data || [];
}

// Perfil do usuário logado (papel/allowlist). null se não logado.
let _perfilCache;
export async function getPerfilAtual() {
  if (_perfilCache !== undefined) return _perfilCache;
  if (!hasSupabase()) { _perfilCache = null; return null; }
  const { data: { user } } = await sb().auth.getUser();
  if (!user) { _perfilCache = null; return null; }
  const { data } = await sb().from('perfil').select('*').eq('email', user.email).maybeSingle();
  _perfilCache = data
    ? { ...data, isAdmin: data.papel === 'admin_sme' }
    : { email: user.email, papel: 'leitor', isAdmin: false };
  return _perfilCache;
}

// Lista de solicitações (com nomes de atividade/unidade). filtros opcionais.
export async function listSolicitacoes({ status, de, ate } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('solicitacao_transporte')
    .select('*, atividade:atividade_extraclasse(nome,cor,usa_onibus), unidade:unidade_escolar(nome,apelido)')
    .order('data', { ascending: false });
  if (status) q = q.eq('status', status);
  if (de) q = q.gte('data', de);
  if (ate) q = q.lte('data', ate);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function criarSolicitacao(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data: { user } } = await sb().auth.getUser();
  const row = { ...payload, criado_por: user?.email || null, status: 'solicitado' };
  const { data, error } = await sb().from('solicitacao_transporte').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarStatusSolicitacao(id, status) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('solicitacao_transporte')
    .update({ status, atualizado_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// Números para o Dashboard.
export async function getStats() {
  const unidades = await getUnidades().catch(() => []);
  const stats = { escolas: unidades.length, atividades: 0 };
  try { stats.atividades = (await getAtividades()).length; } catch (_) {}
  return stats;
}
