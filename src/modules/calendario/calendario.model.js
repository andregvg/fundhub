// ============================================================
// FundHub — modules/calendario/calendario.model.js
// Dias do calendário escolar. É a fonte dos BLOQUEIOS de data que o
// SATE consulta antes de aceitar uma solicitação.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';

export const TIPOS_DIA = ['calendário escolar', 'evento pedagógico', 'cultural', 'prova', 'feriado'];

// Dias de um mês (ano, mes 1-12).
export async function getCalendarioMes(ano, mes) {
  if (!hasSupabase()) return [];
  const ini = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const proxAno = mes === 12 ? ano + 1 : ano;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const fim = `${proxAno}-${String(proxMes).padStart(2, '0')}-01`;
  const { data, error } = await sb().from('dia_calendario')
    .select('*').gte('data', ini).lt('data', fim).order('data');
  if (error) throw error;
  return data || [];
}

export async function getDiaCalendario(dataISO) {
  if (!hasSupabase()) return null;
  const { data, error } = await sb().from('dia_calendario')
    .select('*').eq('data', dataISO).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertDiaCalendario(dia) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = { ...dia, atualizado_em: new Date().toISOString() };
  const { error } = await sb().from('dia_calendario').upsert(patch, { onConflict: 'data' });
  if (error) throw error;
}
