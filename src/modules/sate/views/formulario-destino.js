// ============================================================
// FundHub - sate/views/formulario-destino.js
// O grupo DESTINO do modal de solicitação (spec 2026-09-27, D2).
// Separado de formulario.js por ter estado e contrato próprios: o modo
// (local da lista × local digitado) e a busca - o formulário só pergunta
// "qual é o destino?" e "está válido?".
// ============================================================
import { enderecoCompleto } from '../../locais/locais.model.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { val } from '../../../shared/dom.js';

let locaisAtivos = [];
let escolhido = null;   // Local da lista, ou null
let livre = false;      // true = a escola digita o local
let bs = null;          // handle de criarBuscaSelecao - guardado para poder
                         // limpar a seleção ao entrar no modo livre e para
                         // destruir() antes de recriar (senão cada abertura
                         // do modal deixa um listener de document a mais).

// `label for` não alcançaria o input de dentro de criarBuscaSelecao (ele
// monta a própria estrutura no id passado) - por isso o rótulo é `.lbl`.
export const destinoHtml = () => `
  <fieldset class="form-grupo">
    <legend>Destino</legend>
    <div class="campos duas">
      <div class="col-2 dest-lista">
        <div class="lbl">Local</div>
        <div id="f-local-busca"></div>
        <button type="button" class="mini-btn dest-alternar" id="f-dest-livre">Local não está na lista</button>
      </div>
      <label class="col-2 dest-livre" hidden>Nome do local
        <input id="f-dest-nome" type="text" placeholder="Ex.: Museu Exemplo" /></label>
      <label class="col-2">Endereço <input id="f-dest-end" type="text" placeholder="Ex.: Rua Exemplo" readonly /></label>
      <label>Número <input id="f-dest-num" type="text" inputmode="numeric" placeholder="Ex.: 123" readonly /></label>
      <label>Bairro <input id="f-dest-bairro" type="text" placeholder="Ex.: Centro" readonly /></label>
      <button type="button" class="mini-btn dest-alternar col-2 dest-livre" id="f-dest-lista" hidden>Escolher da lista</button>
    </div>
  </fieldset>`;

const campo = (id) => document.getElementById(id);

function preencher(l) {
  campo('f-dest-end').value = l?.endereco || '';
  campo('f-dest-num').value = l?.numero || '';
  campo('f-dest-bairro').value = l?.bairro || '';
}

// `[hidden]` vence as cinco classes de rótulo de `.form-grupo .campos`
// (ver o mesmo comentário no formulário antigo) - por isso a alternância
// usa o atributo, nunca uma classe/`display`.
//
// As duas direções ficam consistentes com `lerDestino()`: entrar no modo
// livre limpa a escolha da busca (o widget e `escolhido`); voltar para a
// lista limpa o que foi digitado. Sem isso a tela mostra um destino que
// `lerDestino()` já não devolve mais (spec 2026-09-27, revisão).
function aplicarModo() {
  document.querySelectorAll('.dest-livre').forEach(el => { el.hidden = !livre; });
  document.querySelector('.dest-lista').hidden = livre;
  for (const id of ['f-dest-end', 'f-dest-num', 'f-dest-bairro']) campo(id).readOnly = !livre;
  if (livre) {
    escolhido = null; bs?.definirValor(''); preencher(null); campo('f-dest-nome').focus();
  } else {
    campo('f-dest-nome').value = '';
    preencher(null);
  }
}

export function ligarDestino(locais, aoMudar) {
  // Reabrir o modal chama ligarDestino() de novo sobre um markup novo -
  // sem destruir a instância anterior, o listener de document dela (ver
  // busca-selecao.js) fica preso para sempre.
  bs?.destruir();
  locaisAtivos = (locais || []).filter(l => l.ativo);
  escolhido = null; livre = false;
  bs = criarBuscaSelecao(campo('f-local-busca'), {
    opcoes: locaisAtivos.map(l => ({ id: l.id, rotulo: l.nome, detalhe: enderecoCompleto(l), busca: l.bairro || '' })),
    placeholder: 'Digite para buscar o local…',
    vazioTexto: 'Nenhum local com esse nome - use "Local não está na lista"',
    onChange: (id) => { escolhido = locaisAtivos.find(l => l.id === id) || null; preencher(escolhido); aoMudar(); },
  });
  campo('f-dest-livre').addEventListener('click', () => { livre = true; aplicarModo(); aoMudar(); });
  campo('f-dest-lista').addEventListener('click', () => { livre = false; aplicarModo(); aoMudar(); });
  campo('f-dest-nome').addEventListener('change', aoMudar);
}

export function lerDestino() {
  if (!livre) {
    const l = escolhido;
    return { localId: l?.id || null, local: l, nome: l?.nome || '', endereco: l?.endereco || '', numero: l?.numero || '', bairro: l?.bairro || '' };
  }
  return { localId: null, local: null, nome: val('f-dest-nome'), endereco: val('f-dest-end'), numero: val('f-dest-num'), bairro: val('f-dest-bairro') };
}

// Local da lista: basta tê-lo escolhido. Local digitado: as quatro partes
// são obrigatórias - é o que a empresa de transporte vai ler na ficha.
export function validarDestino(d) {
  if (d.localId) return null;
  if (!livre) return 'Escolha o local na lista (ou use "Local não está na lista").';
  if (!d.nome || !d.endereco || !d.numero || !d.bairro) return 'Informe nome, endereço, número e bairro do local.';
  return null;
}
