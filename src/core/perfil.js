// ============================================================
// FundHub — core/perfil.js  (perfil/papel do usuário logado)
// Fica no kernel, e não em um módulo, porque é a camada de
// AUTORIZAÇÃO: o roteador e todos os módulos consultam daqui quem
// pode ver o quê. A decisão definitiva continua no RLS do banco.
// ============================================================
import { sb, hasSupabase } from './supabase.js';

let _cache;

export async function getPerfilAtual() {
  if (_cache !== undefined) return _cache;
  if (!hasSupabase()) { _cache = null; return null; }
  const { data: { user } } = await sb().auth.getUser();
  if (!user) { _cache = null; return null; }
  const { data } = await sb().from('perfil').select('*').eq('email', user.email).maybeSingle();
  _cache = data
    ? { ...data, isAdmin: data.papel === 'admin_sme' }
    : { email: user.email, papel: 'leitor', isAdmin: false };
  return _cache;
}

// Chamar no logout: o próximo login recarrega o perfil do banco.
export function limparPerfil() { _cache = undefined; }

export async function isAdmin() {
  return Boolean((await getPerfilAtual().catch(() => null))?.isAdmin);
}
