// ============================================================
// FundHub - modules/auditoria/eventos.model.js
// Leitura do evento_log - o que ACONTECEU no sistema (login,
// exportação, mudança de permissão, acesso negado). O que MUDOU no
// dado é o audit_log, lido por auditoria.model.js.
//
// Este arquivo NÃO emite evento: quem emite é core/eventos.js, no
// kernel, porque o próprio kernel precisa emitir (o roteador marca
// acesso negado, o perfil marca acesso) e o kernel não importa módulo
// (R1). Logger e visualizador de log são coisas diferentes; o contrato
// entre elas é a tabela mais a função registrar_evento().
//
// Aqui mora também a RETENÇÃO dos dois logs: é o evento_log que cresce
// depressa, e a poda de um não faz sentido sem a do outro. O plano
// gratuito do Supabase dá 500 MB e estourar derruba o hub inteiro -
// por isso o número fica à vista do admin, em auditoria.config.js.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';

export const TIPOS = {
  acesso: 'Entrada no sistema',
  exportacao: 'Exportação de dados',
  permissao: 'Mudança de permissão',
  acesso_negado: 'Acesso negado',
};

// Frase legível de um evento, a partir do contexto. É o que a aba
// Atividade mostra na linha - o jsonb cru fica na gaveta de detalhe.
export function resumoEvento(e) {
  const c = e.contexto || {};
  switch (e.tipo) {
    case 'acesso':
      return 'Entrou no sistema';
    case 'exportacao':
      return `Exportou ${c.lista || 'uma lista'}`
        + (c.linhas != null ? ` (${c.linhas} linha(s))` : '');
    case 'permissao':
      if (c.acesso === 'removido') return `Removeu o acesso de ${c.alvo || 'alguém'}`;
      if (c.papel) return `Mudou ${c.alvo || 'alguém'} de ${c.papel.de || 'sem papel'} para ${c.papel.para || 'sem papel'}`;
      if (c.ativo) return `${c.ativo.para ? 'Reativou' : 'Desativou'} o acesso de ${c.alvo || 'alguém'}`;
      if (c.modulos) return `Ajustou exceções de ${c.alvo || 'alguém'} em ${c.modulos.length} módulo(s)`;
      return `Alterou a permissão de ${c.alvo || 'alguém'}`;
    case 'acesso_negado':
      return `Tentou abrir "${c.modulo || 'um módulo'}" sem permissão`;
    default:
      return 'Evento';
  }
}

export async function getEventos({ tipo, autor, de, ate, limit = 200 } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('evento_log').select('*').order('criado_em', { ascending: false }).limit(limit);
  if (tipo) q = q.eq('tipo', tipo);
  if (autor) q = q.ilike('autor', `%${autor}%`);
  if (de) q = q.gte('criado_em', de + 'T00:00:00');
  if (ate) q = q.lte('criado_em', ate + 'T23:59:59');
  const { data, error } = await q;
  if (error) {
    // Migration 032 ainda não rodou: estado vazio, não tela quebrada.
    if (error.code === '42P01') {
      console.warn('Tabela evento_log ausente - rode a migration 032.');
      return [];
    }
    throw error;
  }
  return data || [];
}

// ── Retenção ─────────────────────────────────────────────────

// Contagem, tamanho e o quanto do banco já foi usado. `null` quando a
// migration 032 não rodou - a config mostra o aviso em vez do número.
export async function saudeLogs() {
  if (!hasSupabase()) return null;
  const { data, error } = await sb().rpc('saude_logs');
  if (error) { console.warn('saude_logs indisponível - rode a migration 032.'); return null; }
  return data || null;
}

// Apaga o que passou da janela de retenção. Só admin (a função no banco
// confere de novo - o front esconde o botão por conforto, a barreira é
// sempre o banco). Devolve quantas linhas saíram de cada tabela.
export async function podarLogs(diasEvento = 180, diasAudit = 730) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data, error } = await sb().rpc('podar_logs', {
    p_dias_evento: diasEvento, p_dias_audit: diasAudit,
  });
  if (error) throw error;
  return data || {};
}
