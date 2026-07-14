// ============================================================
// FundHub — config.js
// Preencha supabaseUrl e supabaseAnonKey quando o projeto Supabase
// existir (Project Settings → API). Enquanto vazio, o app funciona
// lendo data/unidades.json (modo local). Ambos os valores são
// públicos por natureza — a proteção real é o RLS no banco.
// ============================================================
export const CONFIG = {
  appName: 'FundHub',
  supabaseUrl:     'https://uwkroffzjyzbjslepjnh.supabase.co',
  // Chave "publishable" do Supabase (Project Settings → API). É PÚBLICA por
  // design — sem login institucional + estar na allowlist (perfil), o RLS
  // não devolve nenhum dado. A chave secreta (sb_secret_…) NUNCA vai aqui.
  supabaseAnonKey: 'sb_publishable_LGg_RNYhGwVVQwciIoBswA_EwDxfR_J',
};
