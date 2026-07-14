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
    numero: u.numero, nome: u.nome, nome_oficial: u.nome_oficial, apelido: u.apelido,
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

// Números para o Dashboard.
export async function getStats() {
  const unidades = await getUnidades().catch(() => []);
  const stats = { escolas: unidades.length, atividades: 0 };
  try { stats.atividades = (await getAtividades()).length; } catch (_) {}
  return stats;
}
