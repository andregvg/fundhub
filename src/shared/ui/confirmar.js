// ============================================================
// FundHub - shared/ui/confirmar.js
// Diálogo de confirmação assíncrono, no padrão visual do hub -
// substitui o confirm() nativo (bloqueante, não estilizável, fora do
// design system). Ver .claude/rules/ui.md § R16.
//
// Uso na view (a função chamadora precisa ser async):
//   if (!(await confirmar('Excluir X?'))) return;
//   if (!(await confirmar('Excluir X?', { detalhe: '...', perigo: true }))) return;
// ============================================================
import { esc } from '../dom.js';
import { prenderFoco } from './foco.js';

let resolverAtual = null;
let onEscAtual = null;
let soltarFoco = null;
let focoAnterior = null;

function caixa() {
  let box = document.getElementById('confirmar-back');
  if (!box) {
    box = document.createElement('div');
    box.id = 'confirmar-back';
    box.className = 'confirmar-back';
    document.body.appendChild(box);
  }
  return box;
}

// `titulo` é a pergunta; `detalhe` (opcional) é o texto de apoio abaixo.
// `perigo: true` pinta o botão de confirmação como ação destrutiva.
export function confirmar(titulo, { detalhe = '', textoOk = 'Confirmar', textoCancelar = 'Cancelar', perigo = false } = {}) {
  // Uma confirmação pendente é sempre encerrada (como "não") antes de
  // abrir a próxima - não dá para empilhar dois diálogos.
  fechar(false);

  return new Promise((resolve) => {
    resolverAtual = resolve;
    focoAnterior = document.activeElement;
    const box = caixa();
    box.innerHTML = `
      <div class="confirmar-card" role="alertdialog" aria-modal="true" aria-labelledby="cf-titulo">
        <h3 id="cf-titulo">${esc(titulo)}</h3>
        ${detalhe ? `<p>${esc(detalhe)}</p>` : ''}
        <div class="confirmar-acoes">
          <button type="button" class="btn-secundario" id="cf-nao">${esc(textoCancelar)}</button>
          <button type="button" class="${perigo ? 'btn-perigo' : 'btn-primary'}" id="cf-sim">${esc(textoOk)}</button>
        </div>
      </div>`;
    box.classList.add('open');

    box.querySelector('#cf-sim').addEventListener('click', () => fechar(true));
    box.querySelector('#cf-nao').addEventListener('click', () => fechar(false));
    box.addEventListener('click', onCliqueFundo);

    onEscAtual = (e) => { if (e.key === 'Escape') fechar(false); };
    document.addEventListener('keydown', onEscAtual);

    // Diálogo com aria-modal="true" precisa segurar o Tab, senão a
    // tabulação sai do "Confirmar" e vai para o menu da tela de trás.
    soltarFoco = prenderFoco(box.querySelector('.confirmar-card'));

    box.querySelector('#cf-nao').focus();
  });
}

function onCliqueFundo(e) {
  if (e.target.id === 'confirmar-back') fechar(false);
}

function fechar(resultado) {
  const box = document.getElementById('confirmar-back');
  if (!box || !resolverAtual) return;
  box.classList.remove('open');
  box.removeEventListener('click', onCliqueFundo);
  if (onEscAtual) document.removeEventListener('keydown', onEscAtual);
  soltarFoco?.();
  soltarFoco = null;
  const resolve = resolverAtual;
  resolverAtual = null;
  onEscAtual = null;
  // Devolve o foco a quem abriu - senão, depois de confirmar, o Tab
  // recomeça do topo da página em vez de voltar ao botão de origem.
  focoAnterior?.focus?.();
  focoAnterior = null;
  resolve(resultado);
}
