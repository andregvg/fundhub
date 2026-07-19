// ============================================================
// FundHub — core/config.js
// Configuração do app. Ambos os valores abaixo são PÚBLICOS por
// natureza — a proteção real é o RLS no banco.
// Deixar `supabaseAnonKey` vazio ativa o modo dev-local (sem gate
// de login, sem dados). Ver docs/HANDOFF.md § "Teste local".
// ============================================================
export const CONFIG = {
  appName: 'FundHub',
  // Versão do sistema. Ao lançar, subir aqui E registrar em CHANGELOG.md.
  // Semântica: MINOR = módulo novo ou mudança de modelo; PATCH = correção.
  versao: '0.9.0',
  supabaseUrl: 'https://uwkroffzjyzbjslepjnh.supabase.co',
  // Chave "publishable" do Supabase (Project Settings → API). É PÚBLICA por
  // design — sem login institucional + estar na allowlist (perfil), o RLS
  // não devolve nenhum dado. A chave secreta (sb_secret_…) NUNCA vai aqui.
  supabaseAnonKey: 'sb_publishable_LGg_RNYhGwVVQwciIoBswA_EwDxfR_J',
  dominioInstitucional: '@educacao.pmrp.sp.gov.br',
};
