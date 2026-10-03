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
//                   pessoa em outro aparelho. No login, ela vence.
//
// O script do <head> das duas páginas ESPELHA resolverTema(): mudou a
// regra aqui, mude lá.
// ============================================================
import { pref, definirPref } from './configuracoes.js';

const CHAVE = 'fundhub:tema';
const TEMAS = ['claro', 'escuro'];
const sistema = () => window.matchMedia('(prefers-color-scheme: dark)');

// Pura: a escolha gravada vence; sem ela (ou com valor estranho), o sistema.
export function resolverTema(gravado, sistemaEscuro) {
  return TEMAS.includes(gravado) ? gravado : (sistemaEscuro ? 'escuro' : 'claro');
}

// Modo privado ou armazenamento bloqueado: segue sem lembrar.
function lerLocal() { try { return localStorage.getItem(CHAVE); } catch (_) { return null; } }
function gravarLocal(tema) { try { localStorage.setItem(CHAVE, tema); } catch (_) { /* sem lembrança */ } }

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
}

// Depois do login, com as preferências carregadas: a da conta vence a do
// aparelho.
export function sincronizarTemaDaConta() {
  const daConta = pref('geral', 'tema');
  if (TEMAS.includes(daConta) && daConta !== lerLocal()) { gravarLocal(daConta); aplicar(daConta); }
}

export async function definirTema(tema) {
  if (!TEMAS.includes(tema)) return;
  gravarLocal(tema);
  aplicar(tema);
  // Sem banco, sem sessão ou sem a tabela: a escolha local já vale.
  try { await definirPref('geral', 'tema', tema); } catch (_) { /* fica só neste aparelho */ }
}
