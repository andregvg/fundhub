// ============================================================
// SMEHub — data.js  (camada de acesso a dados)
// Estratégia de progressão: se CONFIG tiver Supabase, usa o banco;
// caso contrário, cai no data/unidades.json empacotado. As telas
// consomem sempre a mesma forma de objeto, independente da origem.
// ============================================================
import { CONFIG } from './config.js';

let _client = null;
export function hasSupabase() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}
export function source() { return hasSupabase() ? 'supabase' : 'local'; }

function client() {
  if (!hasSupabase()) return null;
  if (!_client) {
    // supabase-js UMD é carregado no index.html (global `supabase`)
    _client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  }
  return _client;
}

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
    const sb = client();
    const [{ data: unidades, error: e1 }, { data: vw, error: e2 }] = await Promise.all([
      sb.from('unidade_escolar').select('*').order('nome'),
      sb.from('vw_escola_pessoas').select('*'),
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

  // modo local
  const resp = await fetch('data/unidades.json', { cache: 'no-cache' });
  const json = await resp.json();
  _cache = json.unidades;
  return _cache;
}

function rotulaPapel(p) {
  return { gestor: 'Gestor(a)', coordenador: 'Coordenador(a)', supervisor: 'Supervisor(a)' }[p] || p;
}
