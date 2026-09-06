// ============================================================
// FundHub - modules/escolas/escolas.model.js
// Repositório das unidades escolares. É o "M" do MVC: só fala com o
// banco, nunca com o DOM. Outros módulos (SATE, Afastamentos,
// Notificações, Dashboard) importam DESTE arquivo - nunca da view.
//
// Fonte: Supabase (RLS). Nenhum dado real é versionado. Em dev-local,
// tenta data/unidades.local.json (gitignored); senão, estado vazio.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { agoraISO } from '../../shared/format.js';
import { registrarCache } from '../../shared/cache.js';
// Telefones agora vêm da tabela dedicada (fonte única) - model → model.
import { getTelefonesMapas } from '../telefones/telefones.model.js';

// Normaliza uma linha do Supabase para a mesma forma do JSON local.
// `telefones` é uma lista de OBJETOS { id, tipo, numero, rotulo, principal }
// vinda da tabela `telefone` (não mais o array de strings legado).
function fromDb(u, pessoasByUnidade, telByUnidade) {
  return {
    id: u.id, numero: u.numero, nome: u.nome, nome_oficial: u.nome_oficial, apelido: u.apelido,
    segmento: u.segmento, endereco: u.endereco, telefones: telByUnidade[u.id] || [],
    email: u.email, regional: u.regional_id != null ? String(u.regional_id) : '',
    tem_transporte: u.tem_transporte, oferta: u.oferta, tem_eja: u.tem_eja,
    inep: u.inep, pdde: u.pdde, site_apm: u.site_apm, drive_id: u.drive_id,
    latitude: u.latitude, longitude: u.longitude,
    pessoas: pessoasByUnidade[u.id] || [],
  };
}

// Converte telefones do JSON dev-local (strings) para a forma de objetos.
function telDevLocal(u) {
  return (u.telefones || []).map((t, i) =>
    typeof t === 'string' ? { numero: t, tipo: 'fixo', principal: i === 0 } : t);
}

let _cache = null;

export async function getUnidades() {
  if (_cache) return _cache;

  if (hasSupabase()) {
    const cli = sb();
    let [{ data: unidades, error: e1 }, { data: vw }, tel] = await Promise.all([
      cli.from('unidade_escolar').select('*').eq('tipo', 'escola').order('nome'),
      cli.from('vw_escola_pessoas').select('*'),
      getTelefonesMapas(),
    ]);
    // Migration 023 ainda não rodou: sem a coluna `tipo`, é tudo escola.
    if (e1 && e1.code === '42703') {
      const retry = await cli.from('unidade_escolar').select('*').order('nome');
      if (retry.error) throw retry.error;
      unidades = retry.data;
    } else if (e1) {
      throw e1;
    }
    const byU = {};
    (vw || []).forEach(r => {
      // vw_escola_pessoas já devolve o cargo legível (migration 023 § 3b/4).
      (byU[r.unidade_id] ||= []).push({
        papel: r.papel, nome: r.pessoa_nome, apelido: r.apelido,
        email: r.email, telefone: r.telefone,
      });
    });
    _cache = (unidades || []).map(u => fromDb(u, byU, tel.porUnidade));
    return _cache;
  }

  // dev-local: arquivo gitignored, ausente em produção → estado vazio
  try {
    const resp = await fetch('data/unidades.local.json', { cache: 'no-cache' });
    if (!resp.ok) { _cache = []; return _cache; }
    const json = await resp.json();
    _cache = (json.unidades || []).map(u => ({ ...u, telefones: telDevLocal(u) }));
  } catch (_) {
    _cache = [];
  }
  return _cache;
}

// LOCAIS DE TRABALHO = escolas + a Sede + as gerências/subsecretarias
// internas da SME (tipo 'interno'). Só o formulário de local de
// trabalho e o seletor de Horários usam isto; a lista de Escolas
// continua sendo só escola (getUnidades).
let _locais = null;

// Um único registro cobre os dois caches deste model: getUnidades()
// e getLocais() são leituras independentes, mas o botão Atualizar
// invalida as duas de uma vez.
registrarCache(() => { _cache = null; _locais = null; });

// Sede e local interno da SME contam como "não-escola": ícone de
// prédio, e o filtro de segmento não os esconde (não têm segmento).
export const eLocalInterno = (u) => (u?.tipo || '') !== 'escola';

// Ordem do seletor de local de trabalho: a Sede primeiro (procurá-la
// no meio de 144 nomes seria absurdo), depois os internos, depois as
// escolas - cada grupo em ordem alfabética.
export function ordenarLocais(lista) {
  const rank = (t) => (t === 'sede' ? 0 : t === 'interno' ? 1 : 2);
  return [...lista].sort((a, b) =>
    rank(a.tipo) - rank(b.tipo) || a.nome.localeCompare(b.nome, 'pt'));
}

export async function getLocais() {
  if (_locais) return _locais;
  if (!hasSupabase()) { _locais = []; return _locais; }
  const { data, error } = await sb().from('unidade_escolar')
    .select('id, nome, tipo').order('nome');
  // Migration 023 ainda não rodou: sem a coluna `tipo`, é tudo escola.
  if (error && error.code === '42703') {
    const { data: d2 } = await sb().from('unidade_escolar').select('id, nome').order('nome');
    _locais = (d2 || []).map(u => ({ ...u, tipo: 'escola' }));
    return _locais;
  }
  if (error) throw error;
  _locais = ordenarLocais(data || []);
  return _locais;
}

// Locais de trabalho que NÃO são escolas: a Sede e as gerências/
// subsecretarias. Editados no painel de configuração de Escolas.
export async function getLocaisInternos() {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('unidade_escolar')
    .select('id, nome, tipo, vinculos:vinculo(count)')
    .in('tipo', ['sede', 'interno']).order('nome');
  if (error) {
    if (error.code === '42703') return [];   // 023 não rodou
    throw error;
  }
  return (data || []).map(u => ({
    id: u.id, nome: u.nome, tipo: u.tipo,
    vinculos: u.vinculos?.[0]?.count ?? 0,
  }));
}

export async function criarLocalInterno(nome) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe o nome do local.');
  const { data, error } = await sb().from('unidade_escolar')
    .insert({ nome: limpo, tipo: 'interno' }).select().single();
  if (error) {
    if (error.code === '23514') {             // CHECK: a 028 ainda não rodou
      const e = new Error('Atualização do banco pendente - locais internos ainda não estão liberados.');
      e.amigavel = true; throw e;
    }
    throw error;
  }
  _cache = null; _locais = null;
  return data;
}

export async function renomearLocalInterno(id, nome) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe o nome do local.');
  const { error } = await sb().from('unidade_escolar')
    .update({ nome: limpo, atualizado_em: agoraISO() }).eq('id', id);
  if (error) throw error;
  _cache = null; _locais = null;
}

export async function excluirLocalInterno(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('unidade_escolar').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {             // FK: há vínculo apontando
      const e = new Error('Há servidores neste local de trabalho. Encerre-os antes de excluí-lo.');
      e.amigavel = true; throw e;
    }
    throw error;
  }
  _cache = null; _locais = null;
}

// Campos editáveis de uma unidade (o resto é derivado/sistema).
// Telefones NÃO entram aqui: moram na tabela `telefone` (ver
// telefones.model.js) e são sincronizados à parte pela view.
const CAMPOS = ['nome', 'nome_oficial', 'apelido', 'segmento', 'endereco',
  'email', 'oferta', 'tem_transporte', 'tem_eja', 'inep', 'site_apm',
  'latitude', 'longitude', 'link_prestacao_contas'];

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
  _cache = null; _locais = null;
  return data;
}

export async function atualizarUnidade(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = { ...limpar(payload), atualizado_em: agoraISO() };
  const { error } = await sb().from('unidade_escolar').update(patch).eq('id', id);
  if (error) throw error;
  _cache = null; _locais = null;
}

export async function excluirUnidade(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('unidade_escolar').delete().eq('id', id);
  if (error) throw error;
  _cache = null; _locais = null;
}
