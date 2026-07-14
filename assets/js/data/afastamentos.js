// ============================================================
// FundHub — data/afastamentos.js  (afastamentos de servidores)
// ============================================================
import { sb, hasSupabase } from '../core/supabase.js';

export const TIPOS_AFASTAMENTO = [
  'Férias', 'Licença Saúde (LTS)', 'Licença Maternidade',
  'Licença Prêmio', 'Atestado', 'Afastamento SME', 'Outro',
];

const SEL = '*, servidor:servidor(nome,apelido), unidade:unidade_escolar(nome,apelido)';

// Lista afastamentos. Opção { vigentesEm: 'yyyy-mm-dd' } filtra os vigentes na data.
export async function getAfastamentos({ vigentesEm } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('afastamento').select(SEL).order('inicio', { ascending: false });
  if (vigentesEm) q = q.lte('inicio', vigentesEm).or(`fim.is.null,fim.gte.${vigentesEm}`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function criarAfastamento(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data: { user } } = await sb().auth.getUser();
  const row = { ...payload, criado_por: user?.email || null };
  const { data, error } = await sb().from('afastamento').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarAfastamento(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('afastamento').update(payload).eq('id', id);
  if (error) throw error;
}

export async function excluirAfastamento(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('afastamento').delete().eq('id', id);
  if (error) throw error;
}
