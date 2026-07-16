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

// Dias marcados "não conceder afastamentos" dentro de um intervalo
// (inclusive). Usado pelo módulo Afastamentos para avisar antes de gravar.
export async function getDiasBloqueiamAfastamento(de, ate) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('dia_calendario')
    .select('data, evento').eq('bloqueia_afastamento', true)
    .gte('data', de).lte('data', ate).order('data');
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

// Gera os ISOs (yyyy-mm-dd) de um intervalo inclusivo, sem passar por
// toISOString() (que troca o dia dependendo do fuso).
function isosDoPeriodo(de, ate) {
  const out = [];
  const d = new Date(de + 'T00:00:00');
  const fim = new Date(ate + 'T00:00:00');
  while (d <= fim) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// Aplica a MESMA configuração (menos a data) a todo um intervalo de dias
// — para marcar recesso, feriados prolongados, semana de provas etc. de
// uma vez. Devolve quantos dias foram gravados.
export async function upsertPeriodo(diaBase, de, ate) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data: _omit, ...base } = diaBase;
  const agora = new Date().toISOString();
  const rows = isosDoPeriodo(de, ate).map(data => ({ ...base, data, atualizado_em: agora }));
  if (!rows.length) throw new Error('Intervalo inválido.');
  const { error } = await sb().from('dia_calendario').upsert(rows, { onConflict: 'data' });
  if (error) throw error;
  return rows.length;
}

// Importa/atualiza vários dias de uma vez (usado pela importação do
// calendário escolar). `rows` já vêm normalizados pela view.
export async function upsertDias(rows) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  if (!rows.length) return 0;
  const agora = new Date().toISOString();
  const stamped = rows.map(r => ({ ...r, atualizado_em: agora }));
  const { error } = await sb().from('dia_calendario').upsert(stamped, { onConflict: 'data' });
  if (error) throw error;
  return rows.length;
}
