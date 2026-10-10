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
import { abrirMapaLocal } from '../../../shared/ui/mapa-pino.js';
import { ico } from '../../../shared/ui/icones.js';

let locaisAtivos = [];
let escolhido = null;   // Local do cadastro, ou null
let novoNome = null;    // nome digitado aceito como local NOVO, ou null
let bs = null;          // handle de criarBuscaSelecao - destruído antes de
                        // recriar (senão cada abertura do modal deixa um
                        // listener de document a mais)
let aoMudar = () => {};
let aoEditar = null;    // (local) => abre o cadastro do local; só para quem edita locais

const ENDERECO = ['f-dest-end', 'f-dest-num', 'f-dest-bairro'];

// Local do cadastro: o endereço é só um cartão (com o mapa, se há ponto).
// Local NOVO: aparecem os três campos de endereço. O CEP saiu do
// formulário - ninguém precisa dele para pedir o ônibus.
export const destinoHtml = () => `
  <fieldset class="form-grupo">
    <legend>Destino</legend>
    <div class="campos duas">
      <div id="f-local" class="col-2"></div>
      <div class="col-2 dest-cartao" id="f-dest-cartao" hidden></div>
      <div class="col-2 campos duas" id="f-dest-novo" hidden>
        <label class="col-2">Endereço <input id="f-dest-end" type="text" placeholder="Ex.: Rua Exemplo" /></label>
        <label>Número <input id="f-dest-num" type="text" inputmode="numeric" placeholder="Ex.: 123" /></label>
        <label>Bairro <input id="f-dest-bairro" type="text" placeholder="Ex.: Centro" /></label>
      </div>
      <div class="col-2 dest-mesmo" id="f-dest-mesmo" aria-live="polite"></div>
    </div>
  </fieldset>`;

const campo = (id) => document.getElementById(id);

function limparEndereco() { for (const id of ENDERECO) campo(id).value = ''; }

// Mostra o cartão do cadastrado, os campos do novo ou nada.
function mostrar(modo) {
  campo('f-dest-cartao').hidden = modo !== 'cadastrado';
  campo('f-dest-novo').hidden = modo !== 'novo';
  for (const id of ENDERECO) campo(id).required = modo === 'novo';
}

// O endereço e, ao lado dele, o mapa (só se o local tem o ponto) e o lápis
// (só para quem pode editar locais). O mapa abre numa camada própria: um
// modal reabriria o formulário do zero e a pessoa perderia o que digitou.
function pintarCartao(l) {
  const linha = [[l.endereco, l.numero].filter(Boolean).join(', '), l.bairro].filter(Boolean).join(' - ');
  const temPonto = l.latitude != null && l.longitude != null && Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude));
  campo('f-dest-cartao').innerHTML = `<span class="dest-cartao-txt">${esc(linha || 'Endereço não informado no cadastro')}</span>`
    + (temPonto ? `<button type="button" class="mini-btn" data-mapa aria-label="Ver ${esc(l.nome)} no mapa" title="Ver no mapa">${ico('visita', { tam: 16 })}</button>` : '')
    + (aoEditar ? `<button type="button" class="mini-btn" data-editar aria-label="Editar o local ${esc(l.nome)}" title="Editar local">${ico('editar', { tam: 16 })}</button>` : '');
}

function usarCadastrado(l) {
  escolhido = l; novoNome = null;
  limparEndereco(); pintarCartao(l); mostrar('cadastrado'); pintarMesmo();
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

export function ligarDestino(locais, mudou, { editar = null } = {}) {
  bs?.destruir();
  aoMudar = mudou;
  aoEditar = editar;
  locaisAtivos = (locais || []).filter(l => l.ativo);
  escolhido = null; novoNome = null;
  bs = criarBuscaSelecao(campo('f-local'), {
    rotulo: 'Local',
    opcoes: locaisAtivos.map(l => ({ id: l.id, rotulo: l.nome, detalhe: enderecoCompleto(l), busca: l.bairro || '' })),
    placeholder: 'Digite o nome do local…',
    obrigatorio: true,
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
        if (doCadastro) limparEndereco();
        mostrar('novo'); pintarMesmo();
        campo('f-dest-end').focus();
        aoMudar();
      },
    },
    onChange: (id) => {
      const l = locaisAtivos.find(x => x.id === id) || null;
      if (l) { usarCadastrado(l); return; }
      // Limpou o campo: nem cadastrado nem novo.
      escolhido = null; novoNome = null;
      limparEndereco(); mostrar(null); pintarMesmo();
      aoMudar();
    },
  });
  for (const id of ['f-dest-end', 'f-dest-num']) campo(id).addEventListener('change', pintarMesmo);
  campo('f-dest-cartao').addEventListener('click', (e) => {
    if (!escolhido) return;
    if (e.target.closest('[data-mapa]')) {
      abrirMapaLocal({ titulo: escolhido.nome, endereco: enderecoCompleto(escolhido), lat: Number(escolhido.latitude), lng: Number(escolhido.longitude) });
    } else if (e.target.closest('[data-editar]')) aoEditar?.(escolhido);
  });
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
    return { localId: l.id, local: l, nome: l.nome || '', endereco: l.endereco || '', numero: l.numero || '', bairro: l.bairro || '', cep: l.cep || null };
  }
  return { localId: null, local: null, nome: novoNome || '', endereco: val('f-dest-end'), numero: val('f-dest-num'), bairro: val('f-dest-bairro'), cep: null };
}

// Local do cadastro: basta tê-lo escolhido. Local novo: as quatro partes
// são obrigatórias - é o que a empresa de transporte vai ler na ficha.
// Devolve o erro COM o campo a que ele se refere, para o formulário apontá-lo.
export function validarDestino(d) {
  if (d.localId) return null;
  if (!novoNome) return { campo: campo('f-local').querySelector('input'), texto: 'Escolha o local na lista ou digite o nome de um local novo.' };
  const falta = ENDERECO.map(campo).find(c => !c.value.trim());
  if (falta) return { campo: falta, texto: 'Informe endereço, número e bairro do local novo.' };
  return null;
}

// O local do cadastro escolhido, para o formulário refeito reaparecer igual.
export const rascunhoDestino = () => escolhido?.id || null;
export function restaurarDestino(id) {
  const l = locaisAtivos.find(x => x.id === id);
  if (!l) return;
  bs.definirValor(l.id);
  usarCadastrado(l);
}
