// ============================================================
// FundHub - sate/views/formulario-destino.js
// O grupo DESTINO do modal de solicitação (spec 2026-09-27, D2; refeito
// na spec 2026-10-02, D13). Separado de formulario.js por ter estado e
// contrato próprios: o local escolhido ou o local NOVO digitado - o
// formulário só pergunta "qual é o destino?" e "está válido?".
//
// Não há mais botão "Local não está na lista" nem modo alternado. O campo
// Local é a única entrada: a busca acha o cadastrado (inclusive com erro
// de digitação) e o último item da lista aceita o texto como local novo.
// Contra duplicata, três camadas sem clique a mais: a lista mostra o que
// existe onde o olhar já está; criar fica atrás de uma escolha
// deliberada quando há parecidos; e o endereço denuncia o mesmo lugar
// com outro nome. O backstop é o "Conferir local" da Gerência.
// ============================================================
import { enderecoCompleto, localNoEndereco } from '../../locais/locais.model.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { esc, val } from '../../../shared/dom.js';

let locaisAtivos = [];
let escolhido = null;   // Local do cadastro, ou null
let novoNome = null;    // nome digitado aceito como local NOVO, ou null
let bs = null;          // handle de criarBuscaSelecao - destruído antes de
                        // recriar (senão cada abertura do modal deixa um
                        // listener de document a mais)
let aoMudar = () => {};

const ENDERECO = ['f-dest-end', 'f-dest-num', 'f-dest-bairro'];

export const destinoHtml = () => `
  <fieldset class="form-grupo">
    <legend>Destino</legend>
    <div class="campos duas">
      <div id="f-local" class="col-2"></div>
      <label class="col-2">Endereço <input id="f-dest-end" type="text" placeholder="Ex.: Rua Exemplo" readonly /></label>
      <label>Número <input id="f-dest-num" type="text" inputmode="numeric" placeholder="Ex.: 123" readonly /></label>
      <label>Bairro <input id="f-dest-bairro" type="text" placeholder="Ex.: Centro" readonly /></label>
      <div class="col-2 dest-mesmo" id="f-dest-mesmo" aria-live="polite"></div>
    </div>
  </fieldset>`;

const campo = (id) => document.getElementById(id);

function preencher(l) {
  campo('f-dest-end').value = l?.endereco || '';
  campo('f-dest-num').value = l?.numero || '';
  campo('f-dest-bairro').value = l?.bairro || '';
}

// Local do cadastro: endereço só leitura (vem do cadastro). Local novo:
// os três campos destravam e passam a ser obrigatórios.
function destravar(novo) {
  for (const id of ENDERECO) campo(id).readOnly = !novo;
}

function usarCadastrado(l) {
  escolhido = l; novoNome = null;
  preencher(l); destravar(false); pintarMesmo();
  aoMudar();
}

// Mesmo lugar com outro nome: o endereço digitado já é de um local
// cadastrado. Aviso discreto com um clique, nunca bloqueio - dois nomes
// num endereço às vezes são dois lugares.
function pintarMesmo() {
  const box = campo('f-dest-mesmo');
  const l = novoNome ? localNoEndereco(val('f-dest-end'), val('f-dest-num'), locaisAtivos) : null;
  box.innerHTML = l
    ? `<p class="form-hint"><span>Este endereço já é de <b>${esc(l.nome)}</b>.</span>
         <button type="button" class="mini-btn" data-usar="${esc(l.id)}">Usar este</button></p>`
    : '';
}

export function ligarDestino(locais, mudou) {
  bs?.destruir();
  aoMudar = mudou;
  locaisAtivos = (locais || []).filter(l => l.ativo);
  escolhido = null; novoNome = null;
  bs = criarBuscaSelecao(campo('f-local'), {
    rotulo: 'Local',
    opcoes: locaisAtivos.map(l => ({ id: l.id, rotulo: l.nome, detalhe: enderecoCompleto(l), busca: l.bairro || '' })),
    placeholder: 'Digite o nome do local…',
    vazioTexto: 'Digite ao menos 3 letras para cadastrar um local novo',
    criar: {
      etiqueta: 'Novo local',
      rotulo: (termo, haOutros) => (haOutros ? `Nenhum destes? Cadastrar “${termo}”` : `Usar “${termo}” como novo local`),
      aoCriar: (termo) => {
        // Só limpa o endereço ao sair de um local CADASTRADO (o endereço
        // era dele). Criar de novo - ao corrigir o nome, por exemplo - não
        // pode apagar o que a pessoa já digitou.
        const doCadastro = !!escolhido;
        escolhido = null; novoNome = termo;
        if (doCadastro) preencher(null);
        destravar(true); pintarMesmo();
        campo('f-dest-end').focus();
        aoMudar();
      },
    },
    onChange: (id) => {
      const l = locaisAtivos.find(x => x.id === id) || null;
      if (l) { usarCadastrado(l); return; }
      // Limpou o campo: nem cadastrado nem novo.
      escolhido = null; novoNome = null;
      preencher(null); destravar(false); pintarMesmo();
      aoMudar();
    },
  });
  for (const id of ['f-dest-end', 'f-dest-num']) campo(id).addEventListener('change', pintarMesmo);
  campo('f-dest-mesmo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-usar]'); if (!b) return;
    const l = locaisAtivos.find(x => x.id === b.dataset.usar); if (!l) return;
    bs.definirValor(l.id);
    usarCadastrado(l);
  });
}

export function lerDestino() {
  if (escolhido) {
    const l = escolhido;
    return { localId: l.id, local: l, nome: l.nome || '', endereco: l.endereco || '', numero: l.numero || '', bairro: l.bairro || '' };
  }
  return { localId: null, local: null, nome: novoNome || '', endereco: val('f-dest-end'), numero: val('f-dest-num'), bairro: val('f-dest-bairro') };
}

// Local do cadastro: basta tê-lo escolhido. Local novo: as quatro partes
// são obrigatórias - é o que a empresa de transporte vai ler na ficha.
export function validarDestino(d) {
  if (d.localId) return null;
  if (!novoNome) return 'Escolha o local na lista ou digite o nome de um local novo.';
  if (!d.nome || !d.endereco || !d.numero || !d.bairro) return 'Informe endereço, número e bairro do local novo.';
  return null;
}
