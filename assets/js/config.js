// ============================================================
// FundHub — config.js
// Preencha supabaseUrl e supabaseAnonKey quando o projeto Supabase
// existir (Project Settings → API). Enquanto vazio, o app funciona
// lendo data/unidades.json (modo local). Ambos os valores são
// públicos por natureza — a proteção real é o RLS no banco.
// ============================================================
export const CONFIG = {
  appName: 'FundHub',
  supabaseUrl:     '',   // ex.: https://xxxxxxxx.supabase.co
  supabaseAnonKey: '',   // ex.: eyJhbGciOi...
};
