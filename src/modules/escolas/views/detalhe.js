// ============================================================
// FundHub - escolas/views/detalhe.js  (a FICHA da escola)
// Atributos booleanos (transporte, EJA) viram chip no cabeçalho - um
// campo inteiro para dizer "EJA: Não" ocupava espaço para informar
// nada. Os demais campos ficam agrupados sob título de bloco.
//
// É também a `ficha` do manifesto: `abrir(id, opts)` monta o próprio
// contexto a partir dos models, e por isso abre igual por cima da lista
// de Escolas ou da ficha de um servidor. Spec
// 2026-09-13-fichas-entre-modulos-design.md.
// O cabeçalho mostra o nome e, embaixo, as tags; o nome no SAE vai para
// "Mais detalhes" quando difere (spec 2026-10-03, D7).
// Revista em 04/10/2026: o contato vem sem rótulo (o ícone e a forma do dado
// já dizem o que é - e-mail, telefones, endereço, nesta ordem); na equipe,
// nome e cargo dividem a linha. O que é DA ESCOLA - contato, supervisão e
// "Mais detalhes" - mora num cartão só, com o ✎ de editar no canto; a
// equipe vem depois, com os atalhos dela (horários, gerir). A supervisão é
// dado da escola, não gente da equipe (D13). Excluir saiu daqui: fica no pé
// do formulário de edição, longe do clique distraído.
// ============================================================
import { getUnidades } from '../escolas.model.js';
import { linkMaps } from '../../locais/geografia.model.js';
import { getEquipeDaUnidade } from '../../servidores/equipe.model.js';
import { podeEscrever } from '../../../core/permissoes.js';
import { podeAbrirFicha } from '../../../core/registry.js';
import { abrirFicha } from '../../../core/router.js';
import { esc, norm, urlSegura } from '../../../shared/dom.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { telefonesTexto, exibirTelefone, paraE164 } from '../../../shared/ui/phones.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';
import { abrirForm } from './formulario.js';

// `opts`:
//   voltar  - reabre o modal de baixo (a pilha). Repassado a tudo que esta
//             ficha empilha, para o ← nunca perder a origem.
//   aoMudar - chamada depois de uma gravação, para a tela de BAIXO repintar.
// (`editar` do contrato não se aplica: ninguém de fora edita uma escola.)
export async function abrir(id, opts = {}) {
  const unidades = await getUnidades();
  // `numero` é a chave no dev-local, onde a unidade não tem uuid.
  const u = unidades.find(x => String(x.id) === String(id))
    || unidades.find(x => String(x.numero) === String(id));
  if (!u) {
    toast({ titulo: 'Escola não encontrada', texto: 'O cadastro pode ter sido excluído.', tipo: 'atencao' });
    return;
  }
  detalhe(u, contexto(opts), opts);
}

function contexto(opts) {
  const ctx = {
    podeEditar: podeEscrever('escolas'),
    recarregar: async () => { await opts.aoMudar?.(); return ctx; },
  };
  return ctx;
}

function detalhe(u, ctx, opts) {
  const reabrir = () => abrir(u.id || u.numero, opts);
  const tel = telefonesTexto(u.telefones);
  // Pela coordenada quando a escola já foi localizada: é o ponto exato em
  // que o SATE calcula o trajeto. Pelo texto do endereço só na falta dela.
  const maps = linkMaps(u.latitude, u.longitude) || (u.endereco
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u.endereco + ', Ribeirão Preto, SP')}`
    : '');

  // Atributo booleano vira CHIP no cabeçalho. Um campo inteiro para
  // dizer "EJA: Não" ocupava espaço para informar nada.
  const chips = [
    u.segmento ? `<span class="seg">${esc(u.segmento)}</span>` : '',
    u.oferta ? `<span class="tag">${esc(u.oferta)}</span>` : '',
    u.tem_eja ? `<span class="tag eja">${ico('noturno', { tam: 12 })} EJA</span>` : '',
    u.tem_transporte ? `<span class="tag bus">${ico('onibus', { tam: 12 })} Transporte</span>` : '',
  ].filter(Boolean).join('');

  const linha = (icone, html) => html ? `<li>${icone ? ico(icone, { tam: 14 }) + ' ' : ''}${html}</li>` : '';

  abrirModal(`
    ${modalHead(`<span class="nome-oficial">${esc(u.nome)}</span>`,
      chips ? `<span class="tags">${chips}</span>` : '')}
    <div class="modal-body">
      <section class="esc-info">
        ${ctx.podeEditar ? `<button type="button" class="mini-btn esc-info-editar" id="edit-esc"
            aria-label="Editar escola" title="Editar escola">${ico('editar')}</button>` : ''}
        <ul class="esc-contato">
        ${linha('email', u.email ? `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>` : '')}
        ${linha('', tel)}
        ${linha('visita', u.endereco
          ? esc(u.endereco) + (maps ? ` · <a href="${maps}" target="_blank" rel="noopener">ver no mapa</a>` : '')
          : '')}
        </ul>
        <div class="esc-sup" id="esc-supervisao"></div>
        ${maisDetalhes(u)}
      </section>

      <div class="esc-secao">
        <h3 id="esc-equipe-tit">Equipe</h3>
        <span class="esc-secao-acoes">
          <a class="mini-btn" href="#/horarios?unidade=${esc(u.id)}">${ico('horario')} Horários da equipe</a>
          <a class="mini-btn" href="#/servidores?unidade=${esc(u.id)}">Gerir em Servidores →</a>
        </span>
      </div>
      <div class="people" id="esc-equipe">${loading()}</div>
      <p class="form-hint esc-nota">
        A equipe vem dos locais de trabalho atuais. Para incluir ou encerrar alguém, use Servidores.
      </p>
    </div>`, { tamanho: 'largo', voltar: opts.voltar });

  if (ctx.podeEditar) {
    // O formulário empilha sobre a ficha: salvar volta para cá, com o dado novo.
    document.getElementById('edit-esc').addEventListener('click', () =>
      abrirForm(u, ctx, { voltar: reabrir }));
  }

  // A ficha abre na hora e a equipe chega depois: na primeira vez ela
  // depende da lista de servidores, e segurar a ficha inteira por isso
  // faria o clique parecer travado.
  pintarEquipe(document.getElementById('esc-equipe'), document.getElementById('esc-supervisao'), u, { voltar: reabrir, aoMudar: opts.aoMudar });
}

// O que não precisa aparecer de cara (spec 2026-10-03, D7): identificadores
// que se consultam de vez em quando. Sem nenhum preenchido, o bloco nem nasce.
function maisDetalhes(u) {
  const campo = (l, v) => v ? `<dt>${l}</dt><dd>${v}</dd>` : '';
  const itens = [
    u.nome_oficial && norm(u.nome_oficial).trim() !== norm(u.nome).trim() ? campo('Nome no SAE', esc(u.nome_oficial)) : '',
    campo('INEP', esc(u.inep)),
    campo('Regional', esc(u.regional)),
    // Valor digitado à mão: só http(s) vira link; o resto aparece como texto.
    u.site_apm ? campo('Site APM', urlSegura(u.site_apm)
      ? `<a href="${esc(u.site_apm)}" target="_blank" rel="noopener">abrir</a>` : esc(u.site_apm)) : '',
  ].join('');
  return itens ? `<details class="mais-detalhes"><summary>Mais detalhes</summary><dl>${itens}</dl></details>` : '';
}

// A equipe vem do model da EQUIPE (getEquipeDaUnidade), e não de
// `u.pessoas` (vw_escola_pessoas): é o que traz o id para abrir a ficha, o
// telefone para a máscara, e o cache que toda gravação em servidor ou local
// de trabalho invalida - editar alguém por cima desta ficha e voltar mostra
// a equipe já atualizada. Quem é a equipe e com que cargo é regra do
// vínculo, e fica lá; esta tela só desenha.
async function pintarEquipe(box, boxSup, u, abrirOpts) {
  let pessoas;
  try {
    pessoas = await getEquipeDaUnidade(u.id);
  } catch (err) {
    if (box.isConnected) box.innerHTML = erroBox(err);
    // O erro completo fica sob "Equipe"; a supervisão só avisa, sem repetir.
    if (boxSup?.isConnected) boxSup.innerHTML = '';
    return;
  }
  // O modal pode ter sido trocado enquanto a lista chegava (← rápido, outra
  // ficha por cima): ligar ouvintes num nó desconectado seria trabalho perdido.
  if (!box.isConnected) return;

  // Supervisão não é equipe (spec 2026-10-03, D13): é dado da escola, em
  // bloco próprio. A lista já vem na ordem da equipe - Gestor 1, Gestor 2,
  // coordenação, demais (servidores/equipe.model.js).
  const equipe = pessoas.filter(p => !p.supervisao);
  const supervisao = pessoas.filter(p => p.supervisao);

  const tit = document.getElementById('esc-equipe-tit');
  if (tit) tit.textContent = `Equipe (${equipe.length})`;

  const verServidor = podeAbrirFicha('servidores');
  const editarServidor = verServidor && podeEscrever('servidores');
  const opcoes = { clicavel: verServidor, editar: editarServidor };

  box.innerHTML = equipe.length
    ? equipe.map(p => cardPessoa(p, opcoes)).join('') : '<p class="count">Sem pessoas vinculadas.</p>';
  if (boxSup) {
    boxSup.innerHTML = `<span class="esc-sup-rot">Supervisão</span>`
      + (supervisao.length ? supervisao.map(p => linhaSupervisao(p, opcoes)).join('') : '<span>Sem supervisão informada.</span>');
  }

  // Os dois blocos são nós novos desta abertura: ligar uma vez, aqui.
  for (const raiz of [box, boxSup].filter(Boolean)) {
    raiz.querySelectorAll('[data-abrir-servidor]').forEach(b => b.addEventListener('click', () =>
      abrirFicha('servidores', b.dataset.abrirServidor, abrirOpts)));
    raiz.querySelectorAll('[data-editar-servidor]').forEach(b => b.addEventListener('click', () =>
      abrirFicha('servidores', b.dataset.editarServidor, { ...abrirOpts, editar: true })));
  }
}

// Sem apelido: ele serve para ACHAR a pessoa numa lista, e a ficha do
// servidor já o tirou pelo mesmo motivo. O card clicável segue o padrão do
// "link esticado" (.person-abrir, components.css): o nome é o botão de
// verdade, e o e-mail e o telefone continuam links por cima dele.
const emailDe = (p) => p.email
  ? `<span>${ico('email', { tam: 12 })} <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></span>` : '';
const telefoneDe = (p) => p.telefone
  ? `<span>${ico('celular', { tam: 12 })} <a href="tel:${esc(paraE164(p.telefone) || p.telefone)}">${esc(exibirTelefone(p.telefone))}</a></span>` : '';

// A supervisão em UMA linha discreta: nome, ✎ ao lado dele, e-mail e
// telefone. Sem cartão - quem supervisiona não é da equipe da escola.
function linhaSupervisao(p, { clicavel, editar }) {
  const nome = esc(p.nome);
  return `
    <span class="esc-sup-item">
      ${clicavel
        ? `<button type="button" class="esc-sup-nome" data-abrir-servidor="${esc(p.id)}"
             aria-label="Abrir ficha de ${nome}">${nome}</button>`
        : `<b>${nome}</b>`}
      ${editar ? `<button type="button" class="esc-sup-editar" data-editar-servidor="${esc(p.id)}"
                    aria-label="Editar servidor ${nome}">${ico('editar', { tam: 13 })}</button>` : ''}
      ${emailDe(p)}${telefoneDe(p)}
    </span>`;
}

function cardPessoa(p, { clicavel, editar }) {
  const nome = esc(p.nome);
  return `
    <div class="person ${clicavel ? 'clicavel' : ''}">
      <div class="person-topo">
        ${clicavel
          ? `<button type="button" class="pname person-abrir" data-abrir-servidor="${esc(p.id)}"
               aria-label="Abrir ficha de ${nome}">${nome}</button>`
          : `<div class="pname">${nome}</div>`}
        ${p.cargo ? `<span class="person-cargo">${esc(p.cargo)}</span>` : ''}
      </div>
      <div class="pmeta">
        ${emailDe(p)}
        ${telefoneDe(p)}
      </div>
      ${editar ? `
        <div class="person-acoes">
          <button type="button" class="mini-btn" data-editar-servidor="${esc(p.id)}"
                  aria-label="Editar servidor ${nome}">${ico('editar')}</button>
        </div>` : ''}
    </div>`;
}
