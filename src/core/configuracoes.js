// ============================================================
// FundHub - core/configuracoes.js  (configurações por módulo)
// Espelha core/permissoes.js: dois mapas carregados uma vez no boot,
// lidos SÍNCRONO por todo mundo, sem tela própria.
//
//   config_modulo       → conf(modulo, chave)  → decisão da REDE
//   preferencia_usuario → pref(modulo, chave)  → escolha da PESSOA
//
// O PADRÃO de cada configuração NÃO mora aqui - mora no <x>.config.js
// do módulo, no acesso (`?? valor`). Aqui só há "o que foi gravado".
//
// Sem a migration 026: 42P01 nas leituras → mapas vazios → todo
// consumidor cai no padrão. Mesma degradação de telefones/locais.
// ============================================================
import { sb, hasSupabase } from './supabase.js';

// Chave composta "modulo/chave" → valor jsonb já desserializado.
let _rede = {};
let _pessoa = {};

const k = (modulo, chave) => `${modulo}/${chave}`;

export const GRUPOS = Object.freeze([
  { id: 'exibicao',     rotulo: 'Exibição' },
  { id: 'regras',       rotulo: 'Regras e limites' },
  { id: 'calendario',   rotulo: 'Calendário e escalas' },
  { id: 'notificacoes', rotulo: 'Notificações' },
]);

export async function carregarConfiguracoes() {
  if (!hasSupabase()) { _rede = {}; _pessoa = {}; return; }
  const [rede, pessoa] = await Promise.all([
    sb().from('config_modulo').select('modulo, chave, valor'),
    sb().from('preferencia_usuario').select('modulo, chave, valor'),
  ]);
  _rede = indexar(rede);
  _pessoa = indexar(pessoa);
}

// 42P01 (tabela ausente) e qualquer outra falha → mapa vazio: a tela
// abre no padrão em vez de quebrar.
function indexar({ data, error }) {
  if (error || !data) return {};
  const out = {};
  for (const r of data) out[k(r.modulo, r.chave)] = r.valor;
  return out;
}

export const conf = (modulo, chave) => _rede[k(modulo, chave)];
export const pref = (modulo, chave) => _pessoa[k(modulo, chave)];

export async function definirConf(modulo, chave, valor) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data: u } = await sb().auth.getUser();
  const { error } = await sb().from('config_modulo').upsert(
    { modulo, chave, valor, atualizado_por: u?.user?.email || null, atualizado_em: new Date().toISOString() },
    { onConflict: 'modulo,chave' });
  if (error) throw error;
  _rede[k(modulo, chave)] = valor;   // gravou, atualiza o mapa em memória
}

export async function definirPref(modulo, chave, valor) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data: u } = await sb().auth.getUser();
  const email = u?.user?.email;
  if (!email) throw new Error('Sessão expirada.');
  const { error } = await sb().from('preferencia_usuario').upsert(
    { email, modulo, chave, valor, atualizado_em: new Date().toISOString() },
    { onConflict: 'email,modulo,chave' });
  if (error) throw error;
  _pessoa[k(modulo, chave)] = valor;
}

export function limparConfiguracoes() { _rede = {}; _pessoa = {}; }

// Só para teste: injeta os mapas sem tocar no banco.
export function _semearParaTeste(rede = {}, pessoa = {}) { _rede = { ...rede }; _pessoa = { ...pessoa }; }
