// ============================================================
// FundHub - modules/calendario/calendario.model.js
// Dias do calendário escolar. É a fonte dos BLOQUEIOS de data que o
// SATE consulta antes de aceitar uma solicitação.
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { agoraISO } from '../../shared/format.js';

export const TIPOS_DIA = ['calendário escolar', 'evento pedagógico', 'cultural', 'prova', 'feriado'];

// ISO de uma data civil, montado a partir dos componentes locais.
// NUNCA toISOString(): ele volta um dia à noite no fuso do Brasil.
const isoDe = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
  const patch = { ...dia, atualizado_em: agoraISO() };
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
    out.push(isoDe(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// Aplica a MESMA configuração (menos a data) a todo um intervalo de dias
// - para marcar recesso, feriados prolongados, semana de provas etc. de
// uma vez. Devolve quantos dias foram gravados.
export async function upsertPeriodo(diaBase, de, ate) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data: _omit, ...base } = diaBase;
  const agora = agoraISO();
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
  const agora = agoraISO();
  const stamped = rows.map(r => ({ ...r, atualizado_em: agora }));
  const { error } = await sb().from('dia_calendario').upsert(stamped, { onConflict: 'data' });
  if (error) throw error;
  return rows.length;
}

// Proposta de TDC do ano: 1ª e 3ª quartas letivas de cada mês, com as
// chaves recebidas alternando ao longo do ano inteiro (não reiniciando
// a cada mês).
//
// É PROPOSTA, nunca gravação direta. A alternância é um chute
// razoável, não um fato: feriado, recesso e decisão local mudam a
// sequência, e só uma pessoa sabe qual. O gerador poupa a digitação
// de duas dezenas de datas; a decisão continua sendo humana. Por ser
// proposta editável, um único não letivo removido troca a polaridade
// de TODAS as datas seguintes (efeito global na alternância, não só
// local naquele mês) - é o comportamento esperado, não um bug; a tela
// (Task 3) deixa cada linha ser corrigida à mão antes de gravar.
//
// `naoLetivos` aceita Set ou array (normalizado aqui). `chaves` aceita
// string[] OU o formato cru de getEscalas() ({chave, rotulo, ordem}[]),
// para poder ser chamada direto com o catálogo do banco sem quem chama
// precisar mapear `.chave` antes; default e `null`/`undefined`/array
// vazio caem no par padrão do módulo.
export function gerarPropostaTDC(ano, { naoLetivos, chaves } = {}) {
  const nl = naoLetivos instanceof Set ? naoLetivos : new Set(naoLetivos || []);
  const chavesNorm = (chaves && chaves.length ? chaves : ['tdc-presencial', 'tdc-virtual'])
    .map(k => (typeof k === 'string' ? k : k?.chave))
    .filter(Boolean);
  if (!chavesNorm.length) return [];
  const datas = [];
  for (let mes = 0; mes < 12; mes++) {
    const quartas = [];
    const d = new Date(ano, mes, 1);
    while (d.getMonth() === mes) {
      if (d.getDay() === 3) quartas.push(isoDe(d));
      d.setDate(d.getDate() + 1);
    }
    for (const iso of [quartas[0], quartas[2]]) {
      if (iso && !nl.has(iso)) datas.push(iso);
    }
  }
  // A alternância corre sobre a sequência que SOBROU: se a 1ª quarta
  // caiu num não letivo, a 3ª assume a vez dela. É o comportamento
  // que a escola espera - o revezamento não "perde a vez".
  return datas.map((data, i) => ({ data, escala: chavesNorm[i % chavesNorm.length] }));
}

// ── Escalas: leitura ─────────────────────────────────────────
export async function getEscalasRede(de, ate) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('dia_calendario')
    .select('data, escala').not('escala', 'is', null)
    .gte('data', de).lte('data', ate).order('data');
  if (error) {
    if (['42P01', '42703'].includes(error.code)) return [];
    throw error;
  }
  return data || [];
}

export async function getEscalasUnidade(unidadeId, de, ate) {
  if (!hasSupabase() || !unidadeId) return [];
  const { data, error } = await sb().from('escala_unidade')
    .select('data, escala').eq('unidade_id', unidadeId)
    .gte('data', de).lte('data', ate).order('data');
  if (error) {
    if (['42P01', '42703'].includes(error.code)) return [];
    throw error;
  }
  return data || [];
}

// ── Escalas: escrita ─────────────────────────────────────────
export async function definirEscalaRede(dataISO, escala) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('dia_calendario')
    .upsert({ data: dataISO, escala: escala || null, atualizado_em: agoraISO() },
            { onConflict: 'data' });
  if (error) throw error;
}

// Gravar `null` aqui NÃO é o mesmo que apagar a linha: a linha com
// escala nula diz "esta escola cancelou o TDC nesta data", e vence o
// calendário da rede. Para devolver a data à rede, use limparEscalaUnidade.
export async function definirEscalaUnidade(unidadeId, dataISO, escala) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('escala_unidade')
    .upsert({ unidade_id: unidadeId, data: dataISO, escala: escala || null, criado_por: await emailAtual() },
            { onConflict: 'unidade_id,data' });
  if (error) throw error;
}

export async function limparEscalaUnidade(unidadeId, dataISO) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('escala_unidade')
    .delete().eq('unidade_id', unidadeId).eq('data', dataISO);
  if (error) throw error;
}
