// ============================================================
// FundHub - modules/horarios/exibicao.model.js
// Terceiro model público do módulo horarios (mesmo padrão de
// sate/sate.model.js + sate/atividades.model.js): quem aparece na
// grade de uma escola, em que ordem e contando ou não na cobertura -
// o aggregate `horario_exibicao`, distinto de `horario_bloco`
// (horarios.model.js) e da matemática pura de grade (grade.model.js).
//
// Sem linha = padrão (exibe se for cargo de gestão, conta na
// cobertura, ordem alfabética). Ver ordenarParaGrade em grade.model.js.
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';

export async function getExibicao(unidadeId) {
  if (!hasSupabase() || !unidadeId) return [];
  const { data, error } = await sb().from('horario_exibicao')
    .select('servidor_id, ordem, conta_cobertura')
    .eq('unidade_id', unidadeId).order('ordem');
  if (error) {
    if (error.code === '42P01') return [];      // migration 024 ainda não rodou
    throw error;
  }
  return data || [];
}

// Grava a ordem inteira de uma vez. As duas armadilhas do upsert em
// lote do PostgREST valem aqui: todas as linhas precisam ter as
// MESMAS chaves (nada de `undefined`, que some do JSON e quebra o
// lote), e onConflict só infere índice único simples.
export async function salvarOrdem(unidadeId, servidorIds) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const atual = await getExibicao(unidadeId);
  const cobertura = new Map(atual.map(e => [e.servidor_id, e.conta_cobertura]));
  const quem = await emailAtual();
  const rows = servidorIds.map((servidor_id, ordem) => ({
    unidade_id: unidadeId,
    servidor_id,
    ordem,
    conta_cobertura: cobertura.has(servidor_id) ? cobertura.get(servidor_id) : true,
    atualizado_por: quem,
  }));
  if (rows.length) {
    const { error } = await sb().from('horario_exibicao')
      .upsert(rows, { onConflict: 'unidade_id,servidor_id' });
    if (error) throw error;
  }

  // Quem tinha linha e saiu da lista deixa de ter linha - senão a grade
  // continuaria mostrando essa pessoa, com uma ordem que já não significa nada.
  const novosIds = new Set(servidorIds);
  const removidos = atual.filter(e => !novosIds.has(e.servidor_id)).map(e => e.servidor_id);
  if (removidos.length) {
    const { error } = await sb().from('horario_exibicao')
      .delete().eq('unidade_id', unidadeId).in('servidor_id', removidos);
    if (error) throw error;
  }
}

export async function definirCobertura(unidadeId, servidorId, conta) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const atual = await getExibicao(unidadeId);
  const linha = atual.find(e => e.servidor_id === servidorId);
  const row = {
    unidade_id: unidadeId,
    servidor_id: servidorId,
    ordem: linha ? linha.ordem : atual.length,
    conta_cobertura: Boolean(conta),
    atualizado_por: await emailAtual(),
  };
  const { error } = await sb().from('horario_exibicao')
    .upsert(row, { onConflict: 'unidade_id,servidor_id' });
  if (error) throw error;
}

// "Voltar à ordem padrão": apaga as linhas da unidade e a grade
// recai no alfabético por cargo e nome.
export async function limparExibicao(unidadeId) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('horario_exibicao').delete().eq('unidade_id', unidadeId);
  if (error) throw error;
}
