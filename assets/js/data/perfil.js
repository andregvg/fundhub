// ============================================================
// FundHub — data/perfil.js  (perfil/papel do usuário logado)
// ============================================================
import { sb, hasSupabase } from '../core/supabase.js';

let _perfilCache;
export async function getPerfilAtual() {
  if (_perfilCache !== undefined) return _perfilCache;
  if (!hasSupabase()) { _perfilCache = null; return null; }
  const { data: { user } } = await sb().auth.getUser();
  if (!user) { _perfilCache = null; return null; }
  const { data } = await sb().from('perfil').select('*').eq('email', user.email).maybeSingle();
  _perfilCache = data
    ? { ...data, isAdmin: data.papel === 'admin_sme' }
    : { email: user.email, papel: 'leitor', isAdmin: false };
  return _perfilCache;
}
