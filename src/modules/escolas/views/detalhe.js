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
// ============================================================
import { getUnidades } from '../escolas.model.js';
import { linkMaps } from '../../locais/locais.model.js';
import { getEquipeDaUnidade } from '../../servidores/vinculos.model.js';
import { podeEscrever } from '../../../core/permissoes.js';
import { podeAbrirFicha } from '../../../core/registry.js';
import { abrirFicha } from '../../../core/router.js';
import { esc } from '../../../shared/dom.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { telefonesTexto, exibirTelefone, paraE164 } from '../../../shared/ui/phones.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';
import { abrirForm, removerEscola } from './formulario.js';

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
    u.tem_transporte ? `<span class="tag bus">${ico('transporte', { tam: 12 })} Transporte</span>` : '',
    u.tem_eja ? `<span class="tag eja">${ico('noturno', { tam: 12 })} EJA</span>` : '',
  ].filter(Boolean).join('');

  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val">${v}</div></div>` : '';

  abrirModal(`
    ${modalHead(esc(u.nome), esc(u.nome_oficial || ''))}
    <div class="modal-body">
      ${chips ? `<div class="tags" style="margin-bottom:14px">${chips}</div>` : ''}
      <div class="modal-acoes">
        ${ctx.podeEditar ? `<button class="mini-btn" id="edit-esc">${ico('editar')} Editar</button>` : ''}
        <a class="mini-btn" href="#/horarios?unidade=${esc(u.id)}">${ico('horario')} Horários da equipe</a>
        ${ctx.podeEditar ? `<button class="mini-btn no" id="del-esc">${ico('excluir')} Excluir</button>` : ''}
      </div>

      <h3 class="bloco-tit">Contato e localização</h3>
      ${campo('Endereço', u.endereco
        ? esc(u.endereco) + (maps ? ` · <a href="${maps}" target="_blank" rel="noopener">ver no mapa</a>` : '')
        : '')}
      ${campo('Telefones', tel)}
      ${campo('E-mail institucional', u.email ? `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>` : '')}

      <h3 class="bloco-tit">Cadastros e links</h3>
      ${campo('INEP', esc(u.inep))}
      ${campo('Regional', esc(u.regional))}
      ${u.site_apm ? campo('Site APM', `<a href="${esc(u.site_apm)}" target="_blank" rel="noopener">abrir</a>`) : ''}

      <hr class="sep" />
      <div class="vinc-head">
        <div class="field" style="margin:0"><div class="lbl" id="esc-equipe-tit">Equipe</div></div>
        <a class="mini-btn" href="#/servidores?unidade=${esc(u.id)}">Gerir em Servidores →</a>
      </div>
      <div class="people" id="esc-equipe">${loading()}</div>
      <p class="form-hint" style="margin-top:10px">
        A equipe vem dos locais de trabalho atuais. Para incluir ou encerrar alguém, use Servidores.
      </p>
    </div>`, { tamanho: 'largo', voltar: opts.voltar });

  if (ctx.podeEditar) {
    // O formulário empilha sobre a ficha: salvar volta para cá, com o dado novo.
    document.getElementById('edit-esc').addEventListener('click', () =>
      abrirForm(u, ctx, { voltar: reabrir }));
    document.getElementById('del-esc').addEventListener('click', () => removerEscola(u, ctx));
  }

  // A ficha abre na hora e a equipe chega depois: na primeira vez ela
  // depende da lista de servidores, e segurar a ficha inteira por isso
  // faria o clique parecer travado.
  pintarEquipe(document.getElementById('esc-equipe'), u, { voltar: reabrir, aoMudar: opts.aoMudar });
}

// A equipe vem do model de VÍNCULOS (getEquipeDaUnidade), e não de
// `u.pessoas` (vw_escola_pessoas): é o que traz o id para abrir a ficha, o
// telefone para a máscara, e o cache que toda gravação em servidor ou local
// de trabalho invalida - editar alguém por cima desta ficha e voltar mostra
// a equipe já atualizada. Quem é a equipe e com que cargo é regra do
// vínculo, e fica lá; esta tela só desenha.
async function pintarEquipe(box, u, abrirOpts) {
  let pessoas;
  try {
    pessoas = await getEquipeDaUnidade(u.id);
  } catch (err) {
    if (box.isConnected) box.innerHTML = erroBox(err);
    return;
  }
  // O modal pode ter sido trocado enquanto a lista chegava (← rápido, outra
  // ficha por cima): ligar ouvintes num nó desconectado seria trabalho perdido.
  if (!box.isConnected) return;

  const tit = document.getElementById('esc-equipe-tit');
  if (tit) tit.textContent = `Equipe (${pessoas.length})`;

  if (!pessoas.length) {
    box.innerHTML = '<p class="count">Sem pessoas vinculadas.</p>';
    return;
  }

  const verServidor = podeAbrirFicha('servidores');
  const editarServidor = verServidor && podeEscrever('servidores');
  box.innerHTML = pessoas.map(p => cardPessoa(p, { clicavel: verServidor, editar: editarServidor })).join('');

  box.querySelectorAll('[data-abrir-servidor]').forEach(b => b.addEventListener('click', () =>
    abrirFicha('servidores', b.dataset.abrirServidor, abrirOpts)));
  box.querySelectorAll('[data-editar-servidor]').forEach(b => b.addEventListener('click', () =>
    abrirFicha('servidores', b.dataset.editarServidor, { ...abrirOpts, editar: true })));
}

// Sem apelido: ele serve para ACHAR a pessoa numa lista, e a ficha do
// servidor já o tirou pelo mesmo motivo. O card clicável segue o padrão do
// "link esticado" (.person-abrir, components.css): o nome é o botão de
// verdade, e o e-mail e o telefone continuam links por cima dele.
function cardPessoa(p, { clicavel, editar }) {
  const nome = esc(p.nome);
  const telefone = p.telefone
    ? `<span>${ico('celular', { tam: 12 })} <a href="tel:${esc(paraE164(p.telefone) || p.telefone)}">${esc(exibirTelefone(p.telefone))}</a></span>`
    : '';
  return `
    <div class="person ${clicavel ? 'clicavel' : ''}">
      ${p.cargo ? `<div class="role">${esc(p.cargo)}</div>` : ''}
      ${clicavel
        ? `<button type="button" class="pname person-abrir" data-abrir-servidor="${esc(p.id)}"
             aria-label="Abrir ficha de ${nome}">${nome}</button>`
        : `<div class="pname">${nome}</div>`}
      <div class="pmeta">
        ${p.email ? `<span>${ico('email', { tam: 12 })} <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></span>` : ''}
        ${telefone}
      </div>
      ${editar ? `
        <div class="person-acoes">
          <button type="button" class="mini-btn" data-editar-servidor="${esc(p.id)}"
                  aria-label="Editar servidor ${nome}">${ico('editar')}</button>
        </div>` : ''}
    </div>`;
}
