// ============================================================
// FundHub - modules/usuarios/usuarios.model.js
// A allowlist (tabela `perfil`): quem entra, com qual papel, em quais
// segmentos e com quais exceções de permissão.
//
// Desde a migration 021 o papel não é mais um rótulo decorativo: ele
// carrega um MAPA módulo → nível (tabela papel_permissao) que o RLS
// consulta. Editar o papel de alguém aqui muda o que essa pessoa
// consegue ler no banco, não só o que ela vê na tela.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { registrarCache } from '../../shared/cache.js';
import { registrarEvento, EVENTO } from '../../core/eventos.js';

// Fallback caso a tabela `papel` não responda (banco antigo, offline).
// A fonte de verdade é o banco - isto é só para a tela não quebrar.
const PAPEIS_FALLBACK = {
  admin_sme: 'Administrador',
  equipe_sme: 'Equipe SME',
  transporte: 'Transporte',
  gestor_escolar: 'Gestor(a) escolar',
  leitor: 'Leitor',
};

let _papeis = null;
export function limparCachePapeis() { _papeis = null; }
registrarCache(limparCachePapeis);

const papeisFallback = () =>
  Object.entries(PAPEIS_FALLBACK).map(([chave, rotulo], i) => ({ chave, rotulo, ordem: i }));

// Catálogo de papéis, do banco. [{ chave, rotulo, descricao, ordem }]
// O fallback NUNCA é gravado em _papeis: uma falha de rede transitória
// não pode congelar os cinco papéis embutidos pelo resto da sessão -
// a próxima chamada tem que voltar a tentar o banco.
export async function getPapeis() {
  if (_papeis) return _papeis;
  if (!hasSupabase()) return papeisFallback();
  const { data, error } = await sb().from('papel').select('*').order('ordem');
  if (error || !data?.length) return papeisFallback();
  _papeis = data;
  return _papeis;
}

// Mapa de rótulos, para exibir sem ir ao banco de novo.
export async function rotulosDePapel() {
  const ps = await getPapeis();
  return Object.fromEntries(ps.map(p => [p.chave, p.rotulo]));
}

// Compatibilidade: código antigo importava PAPEIS como objeto.
export const PAPEIS = PAPEIS_FALLBACK;

// Presets módulo → nível de cada papel, para a tela mostrar o que a
// pessoa herda antes de aplicar exceções.
export async function getPresets() {
  if (!hasSupabase()) return {};
  const { data } = await sb().from('papel_permissao').select('*');
  const out = {};
  for (const r of data || []) (out[r.papel] ||= {})[r.modulo] = r.nivel;
  return out;
}

export async function getPerfis() {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('perfil')
    .select('*, servidor:servidor_id(id, nome, apelido, cargo, lotacao)')
    .order('ativo', { ascending: false }).order('email');
  if (error) throw error;
  return data || [];
}

const CAMPOS = ['email', 'nome', 'papel', 'ativo', 'segmentos', 'permissoes', 'servidor_id'];
function limpar(p) {
  const out = {};
  for (const k of CAMPOS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

// ── Evento de permissão ──────────────────────────────────────
// O `audit_log` já grava a linha de `perfil` campo a campo, com o valor
// de antes e o de depois - isto NÃO substitui aquilo. O que o evento
// acrescenta é a frase legível que o admin lê sem traduzir uuid nem
// abrir o diff: "fulano@… deixou de ser leitor e virou equipe_sme".
//
// Só sai quando muda algo que altera PODER: papel, exceções por módulo
// ou o próprio acesso. Trocar o nome de alguém não é evento de permissão.
function eventoPermissao(alvo, antes, depois) {
  const mudou = {};
  if ((antes?.papel ?? null) !== (depois?.papel ?? null)) {
    mudou.papel = { de: antes?.papel ?? null, para: depois?.papel ?? null };
  }
  if ((antes?.ativo ?? null) !== (depois?.ativo ?? null)) {
    mudou.ativo = { de: antes?.ativo ?? null, para: depois?.ativo ?? null };
  }
  const excAntes = JSON.stringify(antes?.permissoes ?? null);
  const excDepois = JSON.stringify(depois?.permissoes ?? null);
  if (excAntes !== excDepois) {
    mudou.modulos = Object.keys(depois?.permissoes || {});
  }
  if (!Object.keys(mudou).length) return;
  registrarEvento(EVENTO.PERMISSAO, { alvo, ...mudou });
}

export async function criarPerfil(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = limpar(payload);
  row.email = String(row.email || '').trim().toLowerCase();
  const { data, error } = await sb().from('perfil').insert(row).select().single();
  if (error) {
    // Mantém o código: é o que shared/ui/feedback.js:reportarErro usa
    // para saber se o erro cabe inline (a pessoa ainda está no formulário).
    if (error.code === '23505') {
      const e = new Error('Este e-mail já está na lista.');
      e.code = error.code;
      e.amigavel = true;
      throw e;
    }
    throw error;
  }
  eventoPermissao(row.email, null, row);
  return data;
}

// A chave primária é o e-mail - não se edita; para trocar, exclua e recrie.
// `anterior` é a linha como estava: quem chama já a tem em mãos, e sem
// ela o evento de permissão precisaria de uma leitura a mais só para
// descobrir o "de".
export async function atualizarPerfil(email, payload, anterior = null) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = limpar(payload); delete patch.email;
  const { error } = await sb().from('perfil').update(patch).eq('email', email);
  if (error) {
    if (error.code === '23505') {
      const e = new Error('Este servidor já está vinculado a outro acesso.');
      e.code = error.code;
      e.amigavel = true;
      throw e;
    }
    throw error;
  }
  eventoPermissao(email, anterior, patch);
}

export async function excluirPerfil(email) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('perfil').delete().eq('email', email);
  if (error) throw error;
  registrarEvento(EVENTO.PERMISSAO, { alvo: email, acesso: 'removido' });
}

// ── Meus dados ───────────────────────────────────────────────
// O usuário comum lê e escreve só a PRÓPRIA linha (policy perfil_upd
// + trigger fn_perfil_protege_privilegio, que devolve papel,
// segmentos e permissões ao valor antigo se quem edita não é admin).
export async function getMeuPerfil() {
  if (!hasSupabase()) return null;
  const { data: { user } } = await sb().auth.getUser();
  if (!user) return null;
  // O servidor embeda os vínculos: "Meus dados" exibe cargo e local de
  // trabalho via vinculosAbertos()/cargoDe()/localDeTrabalhoDe()
  // (servidores.model.js), que precisam do array - sem ele os dois
  // campos ficam sempre em branco. `tipo` fica de fora: esta tela não lê.
  const { data, error } = await sb().from('perfil')
    .select(`*, servidor:servidor_id(*, vinculos:vinculo(
      id, unidade_id, papel, ingresso, fim,
      unidade:unidade_escolar(id, nome, apelido)
    ))`).eq('email', user.email).maybeSingle();
  if (error) throw error;
  return data;
}

// Só o nome de exibição: os campos sensíveis o banco recusa mesmo que
// alguém os envie daqui, então nem os mandamos.
export async function salvarMeuNome(email, nome) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('perfil').update({ nome: nome || null }).eq('email', email);
  if (error) throw error;
}
