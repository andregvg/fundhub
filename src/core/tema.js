// ============================================================
// FundHub - core/tema.js  (tema claro / escuro)
// Spec: docs/superpowers/specs/2026-10-03-formularios-tema-e-equipe-da-escola-design.md § D10.
//
// O tema é um ATRIBUTO: <html data-tema="claro|escuro">. O CSS inteiro
// obedece a ele (tokens.css), e não mais a `prefers-color-scheme` - a
// pessoa escolhe, e o sistema só decide enquanto ela não escolheu.
//
// A escolha mora em dois lugares, e os dois têm motivo:
//   localStorage  - vale ANTES do login e nas duas páginas (index.html e
//                   sate.html têm a mesma origem), e é o que o script do
//                   <head> lê para pintar sem piscar;
//   preferência   - ('geral', 'tema') em preferencia_usuario: acompanha a
//                   pessoa em outro aparelho.
//
// Quem vence no login: a conta, com UMA exceção. Gravar na conta pode
// falhar (sem rede, sessão vencida) e a escolha local já vale; se o login
// seguinte adotasse a conta às cegas, ele desfaria justamente a escolha que
// a pessoa acabou de fazer. Por isso a gravação que falhou deixa uma marca
// PENDENTE no navegador, e o próximo login reenvia a escolha em vez de
// adotar a conta (decidirSincronismo).
//
// O script do <head> das duas páginas ESPELHA resolverTema(): mudou a
// regra aqui, mude lá.
// ============================================================
import { pref, definirPref } from './configuracoes.js';

const CHAVE = 'fundhub:tema';
const CHAVE_PENDENTE = 'fundhub:tema-pendente';
const TEMAS = ['claro', 'escuro'];
const sistema = () => window.matchMedia('(prefers-color-scheme: dark)');

// Pura: a escolha gravada vence; sem ela (ou com valor estranho), o sistema.
export function resolverTema(gravado, sistemaEscuro) {
  return TEMAS.includes(gravado) ? gravado : (sistemaEscuro ? 'escuro' : 'claro');
}

// Modo privado ou armazenamento bloqueado: segue sem lembrar.
function lerLocal() { try { return localStorage.getItem(CHAVE); } catch (_) { return null; } }
function gravarLocal(tema) { try { localStorage.setItem(CHAVE, tema); } catch (_) { /* sem lembrança */ } }

// A marca "a última escolha não chegou à conta".
function marcarPendente(sim) {
  try { sim ? localStorage.setItem(CHAVE_PENDENTE, '1') : localStorage.removeItem(CHAVE_PENDENTE); } catch (_) { /* sem lembrança */ }
}
function temPendente() { try { return localStorage.getItem(CHAVE_PENDENTE) === '1'; } catch (_) { return false; } }

// Pura: o que fazer no login com o tema da conta.
//   'reenviar' - a última escolha feita aqui não chegou à conta: ela vale, e
//                é a conta que precisa ser atualizada;
//   'adotar'   - a conta tem um tema diferente do deste navegador;
//   'nada'     - sem tema na conta, ou já iguais.
export function decidirSincronismo({ daConta, local, pendente }) {
  if (pendente && TEMAS.includes(local)) return daConta === local ? 'nada' : 'reenviar';
  return TEMAS.includes(daConta) && daConta !== local ? 'adotar' : 'nada';
}

export const temaAtual = () => document.documentElement.dataset.tema || 'claro';

function aplicar(tema) {
  document.documentElement.dataset.tema = tema;
  // Quem mostra o tema (menu de usuário, Configurações) se atualiza por aqui.
  document.dispatchEvent(new CustomEvent('tema:mudou', { detail: tema }));
}

// Uma vez, no boot de cada página.
export function iniciarTema() {
  aplicar(resolverTema(lerLocal(), sistema().matches));
  // Sem escolha, o tema acompanha o sistema mesmo com a página aberta.
  sistema().addEventListener('change', (e) => {
    if (!TEMAS.includes(lerLocal())) aplicar(resolverTema(null, e.matches));
  });
  // Outra aba (o SATE aberto ao lado do FundHub) trocou o tema: esta acompanha.
  window.addEventListener('storage', (e) => {
    if (e.key === CHAVE && TEMAS.includes(e.newValue)) aplicar(e.newValue);
  });
}

// Depois do login, com as preferências carregadas (ver o cabeçalho: a conta
// vence, salvo escolha pendente de envio). Nunca lança.
export async function sincronizarTemaDaConta() {
  const daConta = pref('geral', 'tema');
  const local = lerLocal();
  const pendente = temPendente();
  const decisao = decidirSincronismo({ daConta, local, pendente });
  if (decisao === 'adotar') {
    gravarLocal(daConta); marcarPendente(false); aplicar(daConta);
  } else if (decisao === 'reenviar') {
    try { await definirPref('geral', 'tema', local); marcarPendente(false); } catch (_) { /* segue pendente */ }
  } else if (pendente && daConta === local) {
    marcarPendente(false);
  }
}

export async function definirTema(tema) {
  if (!TEMAS.includes(tema)) return;
  gravarLocal(tema);
  aplicar(tema);
  // Marca ANTES de tentar: se a gravação falhar (ou a página fechar no meio),
  // o próximo login sabe que esta escolha ainda não chegou à conta.
  marcarPendente(true);
  // Sem banco, sem sessão ou sem a tabela: a escolha local já vale.
  try { await definirPref('geral', 'tema', tema); marcarPendente(false); } catch (_) { /* fica pendente, só neste aparelho */ }
}
