// ============================================================
// FundHub — modules/usuarios/usuarios.model.js
// A allowlist (tabela `perfil`): quem entra, com qual papel, em quais
// segmentos e com quais exceções de permissão.
//
// Desde a migration 021 o papel não é mais um rótulo decorativo: ele
// carrega um MAPA módulo → nível (tabela papel_permissao) que o RLS
// consulta. Editar o papel de alguém aqui muda o que essa pessoa
// consegue ler no banco, não só o que ela vê na tela.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';

// Fallback caso a tabela `papel` não responda (banco antigo, offline).
// A fonte de verdade é o banco — isto é só para a tela não quebrar.
const PAPEIS_FALLBACK = {
  admin_sme: 'Administrador',
  equipe_sme: 'Equipe SME',
  transporte: 'Transporte',
  gestor_escolar: 'Gestor(a) escolar',
  leitor: 'Leitor',
};

let _papeis = null;

// Catálogo de papéis, do banco. [{ chave, rotulo, descricao, ordem }]
export async function getPapeis() {
  if (_papeis) return _papeis;
  if (!hasSupabase()) {
    _papeis = Object.entries(PAPEIS_FALLBACK).map(([chave, rotulo], i) => ({ chave, rotulo, ordem: i }));
    return _papeis;
  }
  const { data, error } = await sb().from('papel').select('*').order('ordem');
  if (error || !data?.length) {
    _papeis = Object.entries(PAPEIS_FALLBACK).map(([chave, rotulo], i) => ({ chave, rotulo, ordem: i }));
    return _papeis;
  }
  _papeis = data;
  return _papeis;
}

// Mapa de rótulos, para exibir sem ir ao banco de novo.
export async function rotulosDePapel() {
  const ps = await getPapeis();
  return Object.fromEntries(ps.map(p => [p.chave, p.rotulo]));
}

// Compatibilidade: código antigo importava PAPEIS como objeto.
export const PAPEIS = PAPEIS_FALLBACK;

// Presets módulo → nível de cada papel, para a tela mostrar o que a
// pessoa herda antes de aplicar exceções.
export async function getPresets() {
  if (!hasSupabase()) return {};
  const { data } = await sb().from('papel_permissao').select('*');
  const out = {};
  for (const r of data || []) (out[r.papel] ||= {})[r.modulo] = r.nivel;
  return out;
}

export async function getPerfis() {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('perfil')
    .select('*, servidor:servidor_id(id, nome, apelido, cargo, lotacao)')
    .order('ativo', { ascending: false }).order('email');
  if (error) throw error;
  return data || [];
}

const CAMPOS = ['email', 'nome', 'papel', 'ativo', 'segmentos', 'permissoes', 'servidor_id'];
function limpar(p) {
  const out = {};
  for (const k of CAMPOS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

export async function criarPerfil(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = limpar(payload);
  row.email = String(row.email || '').trim().toLowerCase();
  const { data, error } = await sb().from('perfil').insert(row).select().single();
  if (error) {
    if (error.code === '23505') throw new Error('Este e-mail já está na lista.');
    throw error;
  }
  return data;
}

// A chave primária é o e-mail — não se edita; para trocar, exclua e recrie.
export async function atualizarPerfil(email, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = limpar(payload); delete patch.email;
  const { error } = await sb().from('perfil').update(patch).eq('email', email);
  if (error) {
    if (error.code === '23505') throw new Error('Este servidor já está vinculado a outro acesso.');
    throw error;
  }
}

export async function excluirPerfil(email) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('perfil').delete().eq('email', email);
  if (error) throw error;
}

// ── Meus dados ───────────────────────────────────────────────
// O usuário comum lê e escreve só a PRÓPRIA linha (policy perfil_upd
// + trigger fn_perfil_protege_privilegio, que devolve papel,
// segmentos e permissões ao valor antigo se quem edita não é admin).
export async function getMeuPerfil() {
  if (!hasSupabase()) return null;
  const { data: { user } } = await sb().auth.getUser();
  if (!user) return null;
  const { data, error } = await sb().from('perfil')
    .select('*, servidor:servidor_id(*)').eq('email', user.email).maybeSingle();
  if (error) throw error;
  return data;
}

// Só o nome de exibição: os campos sensíveis o banco recusa mesmo que
// alguém os envie daqui, então nem os mandamos.
export async function salvarMeuNome(email, nome) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('perfil').update({ nome: nome || null }).eq('email', email);
  if (error) throw error;
}
