// ============================================================
// FundHub - shared/ui/modal.js
// Diálogo centralizado - o padrão de "detalhe/edição" do hub a partir
// de 08/09/2026. Ver a spec 2026-09-08-listas-e-modais-design.md § D8.
//
// Substituiu a gaveta lateral (`shared/ui/drawer.js`) em todo o hub no
// bloco S0b (08/09/2026). A API nasceu espelhando a dela justamente
// para que a conversão das ~20 telas fosse troca de identificador, e
// não reescrita; o arquivo da gaveta foi deletado no mesmo commit, para
// não restarem duas formas de abrir a mesma tela.
//
// O que a gaveta já tinha resolvido veio junto, com a mesma
// implementação e pelas mesmas razões - inclusive guardar a FUNÇÃO que
// reabre o de baixo, nunca o HTML dele: restaurar HTML deixaria os
// ouvintes para trás, e o de baixo precisa voltar com dado recarregado.
//
// Uso na view:
//   app.innerHTML = `… ${modalHtml()}`;
//   montarModal();
//   abrirModal(`${modalHead('Título')}<div class="modal-body">…</div>`);
//   abrirModal(html, { protegerSaida: false });   // formulário que grava na hora
// ============================================================
import { ico } from './icones.js';
import { prenderFoco } from './foco.js';
import { confirmar } from './confirmar.js';

// Marcação a incluir no final do HTML da página. O cartão fica DENTRO
// do fundo: é o fundo que centraliza (grid + place-items), e um cartão
// irmão precisaria repetir o cálculo por fora.
export const modalHtml = () => `
  <div class="modal-back" id="modal-back">
    <div class="modal" id="modal" role="dialog" aria-modal="true" aria-hidden="true"></div>
  </div>`;

export function garantirModal() {
  if (document.getElementById('modal')) return;
  document.body.insertAdjacentHTML('beforeend', modalHtml());
  montarModal();
}

let voltarPara = null;
let focoAnterior = null;
let soltarFoco = null;

// ── Dado digitado (spec 2026-10-02, D6) ──────────────────────
// A linha de base de cada campo é tirada no PRIMEIRO TOQUE da pessoa
// (tecla, ponteiro ou `beforeinput`), não na abertura. Assim digitar e apagar volta a
// "limpo", e um formulário que recebe valores depois de aberto (busca
// carregada, endereço preenchido ao escolher o local) não vira "sujo"
// sozinho: o código mudou campos que a pessoa não tocou.
const CAMPO = 'input, select, textarea';
let bases = new Map();
let proteger = false;

export const valorDoCampo = (el) =>
  (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;

export function algumMudou(mapa) {
  for (const [el, v] of mapa) if (el.isConnected !== false && valorDoCampo(el) !== v) return true;
  return false;
}

// Tira a linha de base do campo, se ainda não houver. Rádio: marcar B
// desmarca A sem toque em A; sem a base do grupo todo, voltar de B para A
// deixaria um "sujo" falso (A nunca teve base).
export function registrarBase(mapa, el) {
  if (mapa.has(el)) return;
  mapa.set(el, valorDoCampo(el));
  if (el.type === 'radio' && el.name) {
    for (const r of el.form?.elements ?? [])
      if (r.type === 'radio' && r.name === el.name && !mapa.has(r)) mapa.set(r, valorDoCampo(r));
  }
}

// Clique no <label> de uma caixa de seleção também é toque nela.
function aoTocar(e) {
  if (!proteger) return;
  const el = e.target.closest?.(CAMPO) || e.target.closest?.('label')?.control;
  if (!el || !el.closest('.modal-body form')) return;
  registrarBase(bases, el);
}

// Para o CÓDIGO que escreve num campo EM RESPOSTA a um gesto da pessoa que
// não é toque no campo - clique no mapa que põe o pino e preenche latitude e
// longitude, data escolhida no calendário nativo. Chamar ANTES de escrever o
// valor: o campo passa a contar como digitado, como se ela tivesse tocado.
// Valor posto pelo código SEM gesto (busca que carrega, endereço preenchido)
// continua não contando - por isso isto é opt-in, e não automático.
export function marcarTocado(campo) {
  if (proteger && campo?.closest?.('.modal-body form')) registrarBase(bases, campo);
}

// ── Campo obrigatório ganha "*" no rótulo ────────────────────
// Vale para todo formulário aberto em modal, sem a view pedir: basta o campo
// ter `required` (ou `aria-required`, na busca com seleção). O rótulo do hub
// é uma coluna (texto em cima, campo embaixo), então o * não pode ser um
// irmão do texto - cairia numa linha própria. O texto é embrulhado num
// <span> e o * vai dentro dele.
const OBRIGATORIO = ':is(input, select, textarea):is([required], [aria-required="true"])';

function marcarObrigatorios(m) {
  for (const rotulo of m.querySelectorAll('.modal-body form label')) {
    const campo = rotulo.control;
    const marca = rotulo.querySelector(':scope > .lbl-txt > .obrig');
    if (!campo?.matches(OBRIGATORIO)) { marca?.remove(); continue; }
    if (marca) continue;
    let txt = rotulo.querySelector(':scope > .lbl-txt');
    if (!txt) {
      const no = [...rotulo.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
      if (!no) continue;   // rótulo sem texto (só ícone): nada a marcar
      txt = document.createElement('span');
      txt.className = 'lbl-txt';
      txt.textContent = no.textContent.trim();
      no.replaceWith(txt);
    }
    txt.insertAdjacentHTML('beforeend', '<span class="obrig" title="Obrigatório" aria-hidden="true">*</span>');
  }
}

// As quatro portas de DISPENSA pela pessoa - fundo, Esc, × e ← - passam
// por aqui. `fecharModal()` exportado continua direto: quem fecha pelo
// código (depois de salvar) não pergunta nada.
async function tentarFechar() {
  if (proteger && algumMudou(bases)) {
    const descartar = await confirmar('Descartar o que você preencheu?', {
      detalhe: 'Se fechar agora, as informações digitadas serão perdidas.',
      textoOk: 'Descartar', textoCancelar: 'Continuar editando', perigo: true,
    });
    if (!descartar) return;
  }
  fecharModal();
}

// O Esc não é ouvido aqui: ele vem com a armadilha de foco (foco.js),
// que só existe enquanto o modal está aberto e só responde quando o
// modal é a superfície de CIMA - com uma confirmação por cima, o Esc é
// dela, e fecha só ela.
export function montarModal() {
  document.getElementById('modal-back')?.addEventListener('click', aoCliqueFundo);
  // Captura: a base precisa ser lida ANTES de a tecla ou o clique mudar o valor.
  const m = document.getElementById('modal');
  m?.addEventListener('keydown', aoTocar, true);
  m?.addEventListener('pointerdown', aoTocar, true);
  // Autopreenchimento, ditado e teclado de celular mudam o valor sem keydown;
  // o `beforeinput` também vem antes da mudança. Não há `focusin` de propósito:
  // ele daria base ao campo focado na abertura, antes de qualquer preenchimento tardio.
  m?.addEventListener('beforeinput', aoTocar, true);
  // Observador e não uma chamada na abertura: há modal que desenha o
  // formulário depois (corpo assíncrono) e campo que vira obrigatório no
  // meio do preenchimento (o endereço de um local novo, no SATE). A marcação
  // é idempotente, então a mudança que ela mesma causa não a realimenta.
  if (m) new MutationObserver(() => marcarObrigatorios(m))
    .observe(m, { childList: true, subtree: true, attributes: true, attributeFilter: ['required', 'aria-required'] });
}

const aberto = () => document.getElementById('modal-back')?.classList.contains('open');

// Só o fundo fecha. Sem esta checagem, um clique que começasse dentro do
// cartão e terminasse fora fecharia o formulário no meio da digitação.
function aoCliqueFundo(e) {
  if (e.target.id === 'modal-back') tentarFechar();
}

// `tamanho`: 'estreito' (420px) | 'medio' (560px, padrão) | 'largo' (760px).
export function abrirModal(html, { voltar = null, tamanho = 'medio', protegerSaida = null } = {}) {
  garantirModal();
  const m = document.getElementById('modal');
  const back = document.getElementById('modal-back');
  if (!m || !back) return;

  // Guarda quem tinha o foco antes do PRIMEIRO modal da pilha, para
  // devolvê-lo quando a pilha inteira fechar.
  if (!aberto()) focoAnterior = document.activeElement;
  voltarPara = voltar;

  m.className = `modal ${tamanho}`;
  m.innerHTML = html;
  bases = new Map();
  // Decidido na abertura: modal cujo <form> só é desenhado depois (corpo
  // assíncrono) precisa passar `protegerSaida: true`.
  proteger = protegerSaida ?? !!m.querySelector('.modal-body form');
  m.setAttribute('aria-hidden', 'false');
  back.classList.add('open');

  const head = m.querySelector('.modal-head');
  if (head && !head.id) head.id = 'modal-titulo';
  m.setAttribute('aria-labelledby', 'modal-titulo');

  if (voltar) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-voltar';
    btn.setAttribute('aria-label', 'Voltar');
    btn.innerHTML = ico('voltar');
    head?.prepend(btn);
    btn.addEventListener('click', tentarFechar);
  }

  m.querySelector('.modal-close')?.addEventListener('click', tentarFechar);

  // A armadilha é presa uma vez por PILHA, não por modal: o elemento é
  // sempre o mesmo (#modal, com o innerHTML trocado), e prender de novo
  // deixaria dois laços de Tab concorrendo sobre o mesmo nó.
  if (!soltarFoco) soltarFoco = prenderFoco(m, { aoEsc: () => tentarFechar() });

  // Primeiro campo do formulário, se houver; senão o botão de fechar. Um
  // modal de edição que abre com o foco no × obriga a pessoa a tabular
  // até o começo do formulário toda vez.
  //
  // Rádio e caixa de seleção ficam de FORA da busca: neles as setas do
  // teclado trocam a opção, então abrir com o foco ali muda a escolha de
  // quem só ia navegar. Um campo de texto não tem esse efeito colateral.
  const alvo = m.querySelector(
      '.modal-body input:not([type="radio"]):not([type="checkbox"]), '
      + '.modal-body select, .modal-body textarea')
    || m.querySelector('.modal-voltar') || m.querySelector('.modal-close');
  alvo?.focus();
}

// `tudo: true` fecha a PILHA inteira em vez de desempilhar um nível.
// Existe porque uma ação pode encerrar o fluxo todo: depois de negar uma
// solicitação no modal de justificativa, voltar ao detalhe da mesma
// solicitação para fechá-lo em seguida é trabalho visível e inútil.
export function fecharModal({ tudo = false } = {}) {
  // Se há um modal embaixo, "fechar" é voltar para ele - e é ele que
  // chama abrirModal de novo, já com o dado atualizado.
  if (voltarPara && !tudo) {
    const volta = voltarPara;
    voltarPara = null;
    volta();
    return;
  }
  voltarPara = null;
  const m = document.getElementById('modal');
  document.getElementById('modal-back')?.classList.remove('open');
  m?.setAttribute('aria-hidden', 'true');
  soltarFoco?.();
  soltarFoco = null;
  focoAnterior?.focus?.();
  focoAnterior = null;
  // A pilha inteira fechou. Quem abriu algo que muda a tela de baixo (o
  // painel de configuração) reage a isto - ver core/router.js.
  document.dispatchEvent(new CustomEvent('modal:fechou'));
}

// O ícone que o título de um modal leva quando quem abre não diz outro: o
// da PÁGINA em que a pessoa está (o roteador e sate.js o definem a cada
// rota). Assim todo modal de um módulo sai com o ícone do módulo, sem que
// cada tela escolha o seu - que é como nascem três ícones para a mesma coisa.
let iconePadrao = '';
export function definirIconeDoModal(nome) { iconePadrao = nome || ''; }

// Cabeçalho padrão (o botão de fechar é ligado por abrirModal).
// `icone`: só para o modal que é de OUTRO assunto que a página - a ficha da
// escola aberta de dentro de Servidores é 'escola', o painel é 'config'.
// Título que já traz um <svg> fica como veio.
export const modalHead = (titulo, sub = '', { icone = iconePadrao } = {}) => {
  const comIcone = icone && !String(titulo).includes('<svg');
  // O ícone é um quadrado do tamanho do × e do ←, ao lado das duas linhas
  // (título e subtítulo): os três botões do cabeçalho leem como uma família.
  return `
  <div class="modal-head" id="modal-titulo">
    ${comIcone ? `<span class="modal-ico" aria-hidden="true">${ico(icone, { tam: 20 })}</span>` : ''}
    <div><h2>${titulo}</h2>${sub ? `<small>${sub}</small>` : ''}</div>
    <button class="modal-close" type="button" aria-label="Fechar">${ico('fechar')}</button>
  </div>`;
};
