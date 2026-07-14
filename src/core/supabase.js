// ============================================================
// FundHub — core/supabase.js  (cliente Supabase compartilhado)
// A anon key é pública por design: sem login institucional, o RLS
// não devolve nenhum dado. Segurança = RLS, não segredo da chave.
// ============================================================
import { CONFIG } from './config.js';

export function hasSupabase() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

// Origem atual dos dados (para o rótulo no topo).
export function source() { return hasSupabase() ? 'supabase' : 'local'; }

let _client = null;
export function sb() {
  if (!hasSupabase()) return null;
  if (!_client) {
    _client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return _client;
}

// E-mail do usuário logado (ou null). Usado para carimbar `criado_por`.
export async function emailAtual() {
  if (!hasSupabase()) return null;
  const { data } = await sb().auth.getUser();
  return data?.user?.email || null;
}
