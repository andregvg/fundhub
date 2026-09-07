// ============================================================
// FundHub - core/eventos.js  (emissor de eventos de aplicação)
// A API de instrumentação do hub: um logger, e só isso. Quem LÊ o log é
// o módulo Auditoria (modules/auditoria/eventos.model.js) - logger e
// visualizador de log são coisas diferentes, e o contrato entre elas é
// a tabela `evento_log` mais a função `registrar_evento()`.
//
// Por que no kernel e não no módulo: o próprio kernel emite - o
// roteador marca `acesso_negado`, o perfil marca `acesso`. E o kernel
// nunca importa `modules/` (R1). Por que em `core/` e não em `shared/`:
// guarda estado de sessão (o `acesso` sai uma vez por sessão, não a
// cada releitura de perfil) e é irmão conceitual de `perfil.js`.
//
// O que ele registra é o que ACONTECEU. O que MUDOU no dado continua
// sendo trabalho do trigger `fn_audit()` no Postgres, que ninguém
// precisa lembrar de chamar. Ver a spec
// docs/superpowers/specs/2026-09-07-registros-e-logs-design.md.
// ============================================================
import { sb, hasSupabase } from './supabase.js';

// Lista fechada, espelhada no CHECK de `evento_log` e na validação de
// `registrar_evento()` (migration 032). Acrescentar tipo aqui exige
// acrescentar lá - e a migration é que manda.
export const EVENTO = {
  ACESSO: 'acesso',                  // sessão nova (não renovação de token)
  EXPORTACAO: 'exportacao',          // alguém baixou uma lista
  PERMISSAO: 'permissao',            // papel ou nível de alguém mudou
  ACESSO_NEGADO: 'acesso_negado',    // o roteador barrou uma rota oculta
};

// Já emitidos nesta sessão, para não repetir o que não muda: o `acesso`
// sai uma vez por carregamento do app, e um `acesso_negado` na mesma
// rota não vira dez linhas porque a pessoa insistiu no F5.
const jaEmitidos = new Set();

/**
 * Registra um evento. NÃO retorna promessa que o chamador deva esperar:
 * log é observabilidade, não caminho crítico - nenhuma tela fica mais
 * lenta por causa dele e nenhuma ação falha porque ele falhou.
 *
 * Falha em silêncio por desenho, inclusive quando a migration 032 ainda
 * não rodou neste banco (a função não existe e o PostgREST devolve
 * erro). O módulo degrada, não quebra a tela - .claude/rules/dados.md.
 *
 * @param {string} tipo      um dos valores de EVENTO
 * @param {object} contexto  metadado pequeno: quantidade, formato, alvo.
 *                           NUNCA conteúdo nem dado pessoal (R7) - todo
 *                           admin lê este log.
 */
export function registrarEvento(tipo, contexto = {}) {
  if (!hasSupabase()) return;
  try {
    sb().rpc('registrar_evento', { p_tipo: tipo, p_contexto: contexto })
      .then(() => {}, () => {});   // sem await, sem rejeição solta
  } catch (_) { /* log nunca derruba quem o chamou */ }
}

// Como registrarEvento, mas só na primeira vez que aquela `chave`
// aparece na sessão. `chave` default = o próprio tipo.
export function registrarEventoUnico(tipo, contexto = {}, chave = tipo) {
  if (jaEmitidos.has(chave)) return;
  jaEmitidos.add(chave);
  registrarEvento(tipo, contexto);
}

// Chamar no logout, junto de limparPerfil(): a próxima sessão volta a
// registrar o acesso dela.
export function limparEventos() { jaEmitidos.clear(); }
