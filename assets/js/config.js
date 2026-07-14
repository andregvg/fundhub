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
  // Cole aqui a "anon public" key (Project Settings → API). É PÚBLICA por
  // design — sem login institucional, o RLS não devolve nenhum dado.
  // Enquanto vazia, o app roda em modo dev local (sem login).
  supabaseAnonKey: '',
};
