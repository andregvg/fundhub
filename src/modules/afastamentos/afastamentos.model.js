// ============================================================
// FundHub — modules/afastamentos/afastamentos.model.js
// Afastamentos de servidores (servidor × tipo × período × unidade).
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';

export const TIPOS_AFASTAMENTO = [
  'Férias', 'Licença Saúde (LTS)', 'Licença Maternidade',
  'Licença Prêmio', 'Atestado', 'Afastamento SME', 'Outro',
];

// Cor por tipo — usada na barra lateral do item e nos painéis.
export const CORES_AFASTAMENTO = {
  'Férias': '#0ea5a4', 'Licença Saúde (LTS)': '#dc2626', 'Licença Maternidade': '#db2777',
  'Licença Prêmio': '#f59e0b', 'Atestado': '#ea580c', 'Afastamento SME': '#2563eb', 'Outro': '#64708a',
};

const SEL = '*, servidor:servidor(nome,apelido), unidade:unidade_escolar(nome,apelido)';

// Lista afastamentos. { vigentesEm: 'yyyy-mm-dd' } filtra os vigentes na data.
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
  const row = { ...payload, criado_por: await emailAtual() };
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
