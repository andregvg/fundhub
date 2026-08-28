// ============================================================
// FundHub - shared/ui/toast.js
// Mensagens de sistema. Entram pela direita, no topo, logo abaixo
// da barra de cabeçalho, e saem sozinhas.
//
// A REGRA DE USO, que vale para o hub inteiro:
//   • validação de campo    → inline no formulário, junto do campo
//                             (shared/dom.js → falha/ok);
//   • resultado da ação     → toast.
// "Informe o e-mail" é inline: a correção é ali. "Acesso adicionado"
// e "Não foi possível salvar" são toast: a gaveta já fechou.
//
// Erro dura mais porque erro precisa ser lido - e costuma trazer um
// texto do Postgres que a pessoa vai querer copiar. Por isso o hover
// também pausa o timer.
// ============================================================
import { esc } from '../dom.js';
import { ico } from './icones.js';

const TIPOS = ['sucesso', 'atencao', 'erro', 'info'];

// O vocabulário antigo era do domínio de notificações ('novo', 'upd',
// 'del'). Continua aceito para não reescrever aquele módulo.
const LEGADO = { ok: 'sucesso', no: 'erro', del: 'erro', upd: 'atencao', novo: 'info' };

const ICO_TIPO = { sucesso: 'ok', atencao: 'atencao', erro: 'erro', info: 'info' };

const DURACAO = { sucesso: 5000, atencao: 6000, erro: 8000, info: 5000 };

const MAX_VISIVEIS = 4;

export function normalizarTipo(tipo) {
  const t = String(tipo ?? '');
  if (TIPOS.includes(t)) return t;
  return LEGADO[t] || 'info';
}

export const duracaoPadrao = (tipo) => DURACAO[normalizarTipo(tipo)];

// UM container. Dois containers fixos no mesmo `top` se sobreporiam na
// tela. O papel vai em cada toast, não na caixa: role="alert" para erro
// (assertivo por definição) e role="status" para os demais - que é o
// padrão ARIA para notificação transitória.
function caixa() {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.className = 'toasts';
    document.body.appendChild(box);
  }
  return box;
}

export function toast({ titulo, texto = '', tipo = 'info', duracao } = {}) {
  const t = normalizarTipo(tipo);
  const box = caixa();
  const ms = duracao ?? DURACAO[t];

  const el = document.createElement('div');
  el.className = `toast t-${t}`;
  el.setAttribute('role', t === 'erro' ? 'alert' : 'status');
  el.innerHTML = `
    <span class="toast-ico">${ico(ICO_TIPO[t], { tam: 18 })}</span>
    <div class="toast-txt">
      <b>${esc(titulo)}</b>
      ${texto ? `<span>${esc(texto)}</span>` : ''}
    </div>
    <button type="button" class="toast-x" aria-label="Fechar aviso">${ico('fechar', { tam: 14 })}</button>`;
  box.appendChild(el);

  // O quinto empurra o mais antigo: pilha que cresce sem limite vira
  // cortina e esconde a própria tela.
  while (box.children.length > MAX_VISIVEIS) box.firstElementChild.remove();

  requestAnimationFrame(() => el.classList.add('show'));

  let timer = setTimeout(sair, ms);
  function sair() {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }
  el.querySelector('.toast-x').addEventListener('click', () => { clearTimeout(timer); sair(); });
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(sair, 2000); });
}

export function limparToasts() {
  document.getElementById('toasts')?.remove();
}
