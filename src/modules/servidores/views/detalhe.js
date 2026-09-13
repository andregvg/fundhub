// ============================================================
// FundHub - servidores/views/detalhe.js  (a FICHA do servidor)
// O modal é o centro do módulo: abre a pessoa e, dentro dela, os
// vínculos com escolas - que é onde a escola de fato entra na história.
//
// É também a `ficha` do manifesto: `abrir(id, opts)` monta o próprio
// contexto a partir dos models, e por isso abre igual por cima da lista
// de Servidores ou da ficha de uma escola. Spec
// 2026-09-13-fichas-entre-modulos-design.md.
// ============================================================
import { getServidores, cargoDe, localDeTrabalhoDe } from '../servidores.model.js';
import { getLocais, eLocalInterno } from '../../escolas/escolas.model.js';
import { getCargos, rotulaCargo } from '../vinculos.model.js';
import { podeEscrever } from '../../../core/permissoes.js';
import { podeAbrirFicha } from '../../../core/registry.js';
import { abrirFicha } from '../../../core/router.js';
import { esc } from '../../../shared/dom.js';
import { fmtData, fmtIdade, fmtCPF, fmtRG } from '../../../shared/format.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { telefonesTexto } from '../../../shared/ui/phones.js';
import { toast } from '../../../shared/ui/toast.js';
import { formVinculo, removerVinculo } from './vinculo.js';
import { formServidor, removerServidor } from './formulario.js';
import { ico } from '../../../shared/ui/icones.js';

// `opts`:
//   voltar  - reabre o modal de baixo (a pilha). Repassado a TUDO que esta
//             ficha empilha e reabre, para o ← nunca perder a origem.
//   editar  - abre direto o formulário de edição, com o `voltar` de quem
//             chamou. Sem permissão de escrita, cai na ficha.
//   aoMudar - chamada depois de uma gravação, para a tela de BAIXO repintar.
export async function abrir(id, opts = {}) {
  const ctx = await contexto(opts);
  const s = ctx.lista.find(x => x.id === id);
  if (!s) {
    toast({ titulo: 'Servidor não encontrado', texto: 'O cadastro pode ter sido excluído.', tipo: 'atencao' });
    return;
  }
  if (opts.editar && ctx.podeEditar) {
    formServidor(s, ctx, { voltar: opts.voltar });
    return;
  }
  detalhe(s.id, ctx, opts);
}

// O contexto que as views deste módulo esperam, lido dos models - que
// guardam cache, então por cima da lista de Servidores isto não refaz
// consulta. `recarregar` avisa a tela de baixo PRIMEIRO: se ela for a lista
// de Servidores, é ela quem busca de novo, e o contexto novo lê o cache já
// atualizado em vez de repetir a consulta.
async function contexto(opts) {
  const [lista, cargos, locais] = await Promise.all([
    getServidores(),
    getCargos().catch(() => []),
    getLocais().catch(() => []),
  ]);
  const ctx = {
    lista, cargos, locais,
    podeEditar: podeEscrever('servidores'),
    recarregar: async () => { await opts.aoMudar?.(); return contexto(opts); },
    abrirDetalhe: (id) => abrir(id, { ...opts, editar: false }),
    abrirFormServidor: (s, o) => formServidor(s, ctx, o),
    removerServidor: (s) => removerServidor(s, ctx),
  };
  return ctx;
}

function detalhe(id, ctx, opts) {
  const s = ctx.lista.find(x => x.id === id);
  if (!s) return;
  // Reabrir esta ficha - a partir do formulário, do vínculo ou da escola -
  // sempre com o MESMO `opts`: é o que mantém o ← até a origem.
  const reabrir = () => abrir(s.id, { ...opts, editar: false });

  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val">${v}</div></div>` : '';

  // Cargo e escola do vínculo aberto sobem para o cabeçalho: é o que
  // identifica a pessoa funcionalmente. No corpo eles seriam a terceira
  // exibição do mesmo fato - a lista de vínculos abaixo já traz cargo,
  // escola e período. O apelido sai daqui: ele ajuda a ACHAR a pessoa, e
  // isso é papel do card na lista, não da ficha dela.
  const sub = [cargoDe(s), localDeTrabalhoDe(s, { completo: true })]
    .filter(Boolean).map(esc).join(' · ');

  const acoes = ctx.podeEditar ? `
    <div class="modal-acoes">
      <button class="mini-btn" id="sv-edit">${ico('editar')} Editar</button>
      <a class="mini-btn" href="#/horarios?servidor=${esc(s.id)}">${ico('horario')} Horário de trabalho</a>
      <button class="mini-btn no" id="sv-del">${ico('excluir')} Excluir</button>
    </div>` : `
    <div class="modal-acoes">
      <a class="mini-btn" href="#/horarios?servidor=${esc(s.id)}">${ico('horario')} Horário de trabalho</a>
    </div>`;

  abrirModal(`
    ${modalHead(`<span class="nome-oficial">${esc(s.nome)}</span>`, sub)}
    <div class="modal-body">
      ${acoes}
      ${campo('E-mail', s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '')}
      ${campo('Telefones', telefonesTexto(s.telefones))}
      ${campo('Nascimento', s.nascimento
        ? `${esc(fmtData(s.nascimento))}${fmtIdade(s.nascimento) ? ` · ${esc(fmtIdade(s.nascimento))}` : ''}`
        : '')}
      <div class="sv-docs">
        ${campo('Código funcional', esc(s.codigo_funcional || ''))}
        ${campo('CPF', esc(fmtCPF(s.cpf)))}
        ${campo('RG', esc(fmtRG(s.rg)))}
      </div>
      ${campo('Ingresso na rede', s.inicio_rede ? esc(fmtData(s.inicio_rede)) : '')}
      <hr class="sep" />
      <div class="vinc-head">
        <div class="field" style="margin:0"><div class="lbl">Locais de trabalho</div></div>
        ${ctx.podeEditar ? `<button class="mini-btn" id="sv-vinc">${ico('adicionar')} Adicionar local de trabalho</button>` : ''}
      </div>
      <div class="people" id="sv-vinculos">${listaVinculos(s, ctx.podeEditar)}</div>
    </div>`, { tamanho: 'largo', voltar: opts.voltar });

  const box = document.getElementById('sv-vinculos');

  // O card de um local que é ESCOLA abre a ficha dela por cima desta.
  box.querySelectorAll('[data-abrir-escola]').forEach(b => b.addEventListener('click', () =>
    abrirFicha('escolas', b.dataset.abrirEscola, { voltar: reabrir, aoMudar: opts.aoMudar })));

  if (ctx.podeEditar) {
    // Editar a partir da ficha EMPILHA o modal: o ← devolve para cá, com o
    // dado recarregado. Sem isto, salvar fechava a pilha inteira e jogava a
    // pessoa de volta na lista, perdendo o contexto que ela mesma abriu.
    document.getElementById('sv-edit').addEventListener('click', () =>
      ctx.abrirFormServidor(s, { voltar: reabrir }));
    document.getElementById('sv-del').addEventListener('click', () => ctx.removerServidor(s));
    document.getElementById('sv-vinc').addEventListener('click', () =>
      formVinculo(s, null, ctx, { voltar: reabrir }));
    box.querySelectorAll('[data-edit-vinc]').forEach(b => b.addEventListener('click', () => {
      const v = s.vinculos.find(x => x.id === b.dataset.editVinc);
      formVinculo(s, v, ctx, { voltar: reabrir });
    }));
    box.querySelectorAll('[data-del-vinc]').forEach(b =>
      b.addEventListener('click', () => removerVinculo(s, b.dataset.delVinc, ctx)));
  }
}

function listaVinculos(s, podeEditar) {
  if (!s.vinculos.length) return '<p class="count">Nenhum local de trabalho cadastrado.</p>';

  // Abertos primeiro; o histórico fica abaixo, apagado.
  const ordenados = [...s.vinculos].sort((a, b) =>
    (Number(Boolean(a.fim)) - Number(Boolean(b.fim)))
    || String(b.ingresso || '').localeCompare(String(a.ingresso || '')));
  const verEscola = podeAbrirFicha('escolas');

  return ordenados.map(v => {
    const encerrado = Boolean(v.fim);
    const periodo = [
      v.ingresso ? `desde ${fmtData(v.ingresso)}` : '',
      v.fim ? `até ${fmtData(v.fim)}` : '',
    ].filter(Boolean).join(' · ');
    const acoes = podeEditar ? `
      <div class="vinc-acoes">
        <button class="mini-btn" data-edit-vinc="${esc(v.id)}" aria-label="Editar local de trabalho">${ico('editar')}</button>
        <button class="mini-btn no" data-del-vinc="${esc(v.id)}" aria-label="Excluir local de trabalho">${ico('excluir')}</button>
      </div>` : '';
    // Local interno (Sede, gerências) não tem ficha: o card fica só texto.
    const interno = v.unidade && eLocalInterno(v.unidade);
    const nome = esc(v.unidade?.nome || 'sem local');
    const clicavel = verEscola && v.unidade_id && v.unidade && !interno;
    const pname = clicavel
      ? `<button type="button" class="pname person-abrir" data-abrir-escola="${esc(v.unidade_id)}"
           aria-label="Abrir ficha da escola ${nome}">${nome}</button>`
      : `<div class="pname">${interno ? ico('sede', { tam: 12 }) + ' ' : ''}${nome}</div>`;
    return `<div class="person ${encerrado ? 'inativo' : ''} ${clicavel ? 'clicavel' : ''}">
      <div class="role">${esc(rotulaCargo(v.papel))}${encerrado ? ' · encerrado' : ''}</div>
      ${pname}
      <div class="pmeta">
        ${periodo ? `<span>${esc(periodo)}</span>` : ''}
        ${acoes}
      </div>
    </div>`;
  }).join('');
}
