// ============================================================
// FundHub — modules/escolas/escolas.model.js
// Repositório das unidades escolares. É o "M" do MVC: só fala com o
// banco, nunca com o DOM. Outros módulos (SATE, Afastamentos,
// Notificações, Dashboard) importam DESTE arquivo — nunca da view.
//
// Fonte: Supabase (RLS). Nenhum dado real é versionado. Em dev-local,
// tenta data/unidades.local.json (gitignored); senão, estado vazio.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
// Quem é dono do vocabulário de papéis é o módulo Gestores — model → model.
import { rotulaPapel } from '../servidores/servidores.model.js';

// Normaliza uma linha do Supabase para a mesma forma do JSON local.
function fromDb(u, pessoasByUnidade) {
  return {
    id: u.id, numero: u.numero, nome: u.nome, nome_oficial: u.nome_oficial, apelido: u.apelido,
    segmento: u.segmento, endereco: u.endereco, telefones: u.telefones || [],
    email: u.email, regional: u.regional_id != null ? String(u.regional_id) : '',
    tem_transporte: u.tem_transporte, oferta: u.oferta, tem_eja: u.tem_eja,
    inep: u.inep, pdde: u.pdde, site_apm: u.site_apm, drive_id: u.drive_id,
    latitude: u.latitude, longitude: u.longitude,
    pessoas: pessoasByUnidade[u.id] || [],
  };
}

let _cache = null;

export async function getUnidades() {
  if (_cache) return _cache;

  if (hasSupabase()) {
    const cli = sb();
    const [{ data: unidades, error: e1 }, { data: vw }] = await Promise.all([
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

  // dev-local: arquivo gitignored, ausente em produção → estado vazio
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

// Campos editáveis de uma unidade (o resto é derivado/sistema).
const CAMPOS = ['nome', 'nome_oficial', 'apelido', 'segmento', 'endereco',
  'telefones', 'email', 'oferta', 'tem_transporte', 'tem_eja', 'inep', 'site_apm',
  'latitude', 'longitude', 'whatsapp', 'link_prestacao_contas'];

function limpar(p) {
  const out = {};
  for (const k of CAMPOS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

export async function criarUnidade(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data, error } = await sb().from('unidade_escolar')
    .insert(limpar(payload)).select().single();
  if (error) throw error;
  _cache = null;
  return data;
}

export async function atualizarUnidade(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = { ...limpar(payload), atualizado_em: new Date().toISOString() };
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
