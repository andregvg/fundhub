// ============================================================
// FundHub — core/perfil.js  (perfil, papel e permissões do usuário)
// Fica no kernel, e não em um módulo, porque é a camada de
// AUTORIZAÇÃO: o menu, o roteador e todos os módulos consultam daqui
// quem pode ver o quê. A decisão definitiva continua no RLS.
//
// O perfil carrega quatro coisas:
//   • a linha de `perfil` (papel, segmentos, servidor vinculado);
//   • o MAPA de permissões módulo → nível (ver core/permissoes.js);
//   • as unidades pelas quais a pessoa responde (nível 'proprios');
//   • se ela está de fato cadastrada — ver `naoCadastrado` abaixo.
// ============================================================
import { sb, hasSupabase } from './supabase.js';
import { definirMapa, limparMapa, podeEscrever } from './permissoes.js';
import { expandir } from './segmentos.js';

let _cache;
let _ultimoAcesso = null;   // o acesso ANTERIOR do usuário (para exibir no menu)

export async function getPerfilAtual() {
  if (_cache !== undefined) return _cache;
  if (!hasSupabase()) { _cache = null; return null; }

  const { data: { user } } = await sb().auth.getUser();
  if (!user) { _cache = null; return null; }

  // Perfil, mapa de permissões e unidades próprias numa tacada só —
  // são três chamadas independentes e o boot espera por todas.
  const [{ data: linha }, { data: mapa }, { data: unidades }] = await Promise.all([
    sb().from('perfil').select('*, servidor:servidor_id(*)').eq('email', user.email).maybeSingle(),
    sb().rpc('meu_mapa_permissoes'),
    sb().rpc('minhas_unidades'),
  ]);

  // Autenticou, mas não está na allowlist. ANTES isto virava um
  // "leitor" sintético e a pessoa navegava por um app de listas
  // vazias sem entender por quê — o RLS bloqueava tudo em silêncio.
  // Agora o estado é explícito e main.js mostra uma tela honesta.
  if (!linha) {
    _cache = { email: user.email, naoCadastrado: true, isAdmin: false, segmentos: [], unidades: [] };
    limparMapa();
    return _cache;
  }

  definirMapa(mapa || {});

  _cache = {
    ...linha,
    isAdmin: linha.papel === 'admin_sme',
    segmentos: expandir(linha.segmentos),
    // uuids das unidades sob responsabilidade (nível 'proprios')
    unidades: (unidades || []).map(r => (typeof r === 'string' ? r : r.minhas_unidades)).filter(Boolean),
  };
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
export function limparPerfil() { _cache = undefined; _ultimoAcesso = null; limparMapa(); }

// Força releitura sem deslogar — usado pela tela "Meus dados" depois
// de salvar, e pelo módulo Usuários quando o admin muda o próprio papel.
export async function recarregarPerfil() {
  _cache = undefined;
  return getPerfilAtual();
}

export async function isAdmin() {
  return Boolean((await getPerfilAtual().catch(() => null))?.isAdmin);
}

// Açúcar para as views: `ctx.perfil` já vem pronto do roteador, mas
// quem precisa checar escrita num módulo específico usa isto.
export const podeEditar = (modulo) => podeEscrever(modulo);
