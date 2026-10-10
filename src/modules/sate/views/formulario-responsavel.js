// ============================================================
// FundHub - sate/views/formulario-responsavel.js
// O grupo RESPONSÁVEL PELA VISITA do modal de solicitação (spec
// 2026-10-03, D2). O campo sugere a equipe da escola escolhida - gestores
// e coordenadores, sem a supervisão - e, quando um deles é o responsável,
// preenche o telefone principal, que o cadastro já tem.
//
// <datalist> e não a busca-seleção: aqui o nome digitado à mão é resposta
// tão legítima quanto a sugestão (o responsável pode ser um professor que
// não está no cadastro), e a busca-seleção descarta o texto que não vira
// escolha. A lista tem três ou quatro nomes; o nativo dá conta.
//
// Sem equipe cadastrada, sem permissão de leitura ou com a consulta
// falhando, a lista fica vazia e o campo é texto livre - como era.
// ============================================================
import { getEquipeDaUnidade } from '../../servidores/equipe.model.js';
import { esc, norm } from '../../../shared/dom.js';
import { isUuid } from '../../../shared/format.js';
import { formatarTelefone, exibirTelefone } from '../../../shared/ui/phones.js';

let equipe = [];
// Trocar de escola duas vezes: a resposta da primeira não pode pintar por
// cima da segunda (mesmo padrão de pedidoTrajeto em formulario.js).
let pedido = 0;
// O telefone que a SUGESTÃO pôs no campo. Só esse valor pode ser desfeito
// quando o nome deixa de casar; o que a pessoa digitou nunca é apagado.
let telDaSugestao = '';

export const responsavelHtml = () => `
  <fieldset class="form-grupo">
    <legend>Responsável pela visita</legend>
    <div class="campos duas">
      <label>Nome do(a) responsável
        <input id="f-prof" type="text" list="f-prof-lista" autocomplete="off" required />
        <datalist id="f-prof-lista"></datalist></label>
      <label>Telefone / WhatsApp
        <input id="f-tel" type="tel" inputmode="tel" placeholder="(16) 99999-9999" required /></label>
    </div>
  </fieldset>`;

export function ligarResponsavel() {
  equipe = [];
  telDaSugestao = '';
  pedido++;
  const nome = document.getElementById('f-prof');
  const tel = document.getElementById('f-tel');
  // Casou com alguém da equipe: o telefone vem do cadastro. Continua
  // editável - o número do dia da visita pode ser outro. Se o nome muda e
  // deixa de casar, o telefone que a sugestão pôs sai junto: o número vai
  // para a empresa de transporte, e o de outra pessoa não pode ficar.
  nome.addEventListener('input', () => {
    const p = equipe.find(x => norm(x.nome).trim() === norm(nome.value).trim());
    if (p?.telefone) {
      telDaSugestao = exibirTelefone(p.telefone);
      tel.value = telDaSugestao;
    } else if (telDaSugestao && tel.value === telDaSugestao) {
      tel.value = '';
      telDaSugestao = '';
    }
  });
  tel.addEventListener('blur', () => { tel.value = formatarTelefone(tel.value); });
}

export async function carregarEquipe(unidadeId) {
  const meu = ++pedido;
  // A equipe da escola anterior não vale para a nova enquanto a resposta não chega.
  equipe = [];
  document.getElementById('f-prof-lista')?.replaceChildren();
  let lista = [];
  if (isUuid(unidadeId)) {
    try { lista = await getEquipeDaUnidade(unidadeId); } catch (_) { /* segue como texto livre */ }
  }
  const dl = document.getElementById('f-prof-lista');
  if (meu !== pedido || !dl) return;
  equipe = lista.filter(p => !p.supervisao);
  // Sem `label`: o Firefox mostra e filtra a lista pelo label, e o nome sumiria.
  dl.innerHTML = equipe.map(p => `<option value="${esc(p.nome)}"></option>`).join('');
}
