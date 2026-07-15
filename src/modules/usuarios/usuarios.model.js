// ============================================================
// FundHub — modules/usuarios/usuarios.model.js
// A allowlist (tabela `perfil`): quem entra e com qual papel. Antes
// isso só se fazia por SQL manual. RLS: perfil_all = is_admin().
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';

export const PAPEIS = {
  admin_sme: 'Administrador',
  transporte: 'Transporte',
  leitor: 'Leitor',
};

export async function getPerfis() {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('perfil')
    .select('*').order('ativo', { ascending: false }).order('email');
  if (error) throw error;
  return data || [];
}

const CAMPOS = ['email', 'nome', 'papel', 'ativo'];
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
  if (error) throw error;
}

export async function excluirPerfil(email) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('perfil').delete().eq('email', email);
  if (error) throw error;
}
