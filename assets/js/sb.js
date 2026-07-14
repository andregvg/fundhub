// ============================================================
// FundHub — sb.js  (cliente Supabase compartilhado)
// A anon key é pública por design: sem login institucional, o RLS
// não devolve nenhum dado. Segurança = RLS, não segredo da chave.
// ============================================================
import { CONFIG } from './config.js';

export function hasSupabase() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

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
