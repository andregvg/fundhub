// ============================================================
// FundHub — core/perfil.js  (perfil/papel do usuário logado)
// Fica no kernel, e não em um módulo, porque é a camada de
// AUTORIZAÇÃO: o roteador e todos os módulos consultam daqui quem
// pode ver o quê. A decisão definitiva continua no RLS do banco.
// ============================================================
import { sb, hasSupabase } from './supabase.js';

let _cache;
let _ultimoAcesso = null;   // o acesso ANTERIOR do usuário (para exibir no menu)

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

// Carimba o acesso de agora e guarda o anterior. Chamado uma vez no boot.
// A função no banco devolve o último acesso ANTERIOR (antes deste login).
export async function registrarAcesso() {
  if (!hasSupabase()) return null;
  try {
    const { data } = await sb().rpc('registrar_acesso');
    _ultimoAcesso = data || null;
  } catch (_) { _ultimoAcesso = null; }
  return _ultimoAcesso;
}

// ISO do acesso anterior do usuário (ou null se é o primeiro).
export function ultimoAcessoAnterior() { return _ultimoAcesso; }

// Chamar no logout: o próximo login recarrega o perfil do banco.
export function limparPerfil() { _cache = undefined; _ultimoAcesso = null; }

export async function isAdmin() {
  return Boolean((await getPerfilAtual().catch(() => null))?.isAdmin);
}
