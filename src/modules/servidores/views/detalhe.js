// ============================================================
// FundHub — servidores/views/detalhe.js  (gaveta de detalhe + vínculos)
// A gaveta é o centro do módulo: abre a pessoa e, dentro dela, os
// vínculos com escolas — que é onde a escola de fato entra na história.
// ============================================================
import { vinculosAbertos, cargoDe, lotacaoDe } from '../servidores.model.js';
import { rotulaCargo } from '../vinculos.model.js';
import { esc } from '../../../shared/dom.js';
import { fmtData, fmtIdade } from '../../../shared/format.js';
import { drawerHead, abrirDrawer } from '../../../shared/ui/drawer.js';
import { telefonesTexto } from '../../../shared/ui/phones.js';
import { formVinculo, removerVinculo } from './vinculo.js';

// `ctx`: { lista, podeEditar, cargos, locais, recarregar, abrirFormServidor, removerServidor }
// — ver servidores.view.js § ctxAtual(). Os locais do formulário de
// vínculo vêm de ctx.locais (getLocais() de escolas.model.js), não de
// ctx.unidades (que aqui é só escola — ver escolas.model.js § getUnidades).
export function detalhe(id, ctx) {
  const s = ctx.lista.find(x => x.id === id);
  if (!s) return;

  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val">${v}</div></div>` : '';
  const campoAcao = (rotulo, valor, aria) => `
    <div class="field">
      <div class="lbl">${rotulo}</div>
      <div class="val campo-derivado">
        ${valor ? esc(valor) : '<span class="vazio">Sem vínculo</span>'}
        ${ctx.podeEditar
          ? `<button type="button" class="mini-btn" data-vinc-edit="1"
               aria-label="${aria}">${valor ? '✎' : '+'}</button>`
          : ''}
      </div>
    </div>`;
  const acoes = ctx.podeEditar ? `
    <div class="drawer-acoes">
      <button class="mini-btn" id="sv-edit">✎ Editar</button>
      <a class="mini-btn" href="#/horarios?servidor=${esc(s.id)}">🕒 Horário de trabalho</a>
      <button class="mini-btn no" id="sv-del">🗑 Excluir</button>
    </div>` : `
    <div class="drawer-acoes">
      <a class="mini-btn" href="#/horarios?servidor=${esc(s.id)}">🕒 Horário de trabalho</a>
    </div>`;

  abrirDrawer(`
    ${drawerHead(`<span class="nome-oficial">${esc(s.nome)}</span>`, esc(s.apelido || ''))}
    <div class="drawer-body">
      ${acoes}
      ${campoAcao('Cargo / função', cargoDe(s), 'Editar o vínculo')}
      ${campoAcao('Lotação', lotacaoDe(s), 'Editar o vínculo')}
      ${campo('E-mail', s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '')}
      ${campo('Telefones', (s.telefones || []).length ? telefonesTexto(s.telefones) : '')}
      ${campo('Nascimento', s.nascimento
        ? `${esc(fmtData(s.nascimento))}${fmtIdade(s.nascimento) ? ` · ${esc(fmtIdade(s.nascimento))}` : ''}`
        : '')}
      ${campo('Código funcional', esc(s.codigo_funcional || ''))}
      ${campo('CPF', esc(s.cpf || ''))}
      ${campo('RG', esc(s.rg || ''))}
      ${campo('Ingresso na rede', s.inicio_rede ? esc(fmtData(s.inicio_rede)) : '')}
      <hr class="sep" />
      <div class="vinc-head">
        <div class="field" style="margin:0"><div class="lbl">Vínculos com escolas</div></div>
        ${ctx.podeEditar ? `<button class="mini-btn" id="sv-vinc">+ Novo vínculo</button>` : ''}
      </div>
      <div class="people" id="sv-vinculos">${listaVinculos(s, ctx.podeEditar)}</div>
    </div>`);

  if (ctx.podeEditar) {
    document.getElementById('sv-edit').addEventListener('click', () => ctx.abrirFormServidor(s));
    document.getElementById('sv-del').addEventListener('click', () => ctx.removerServidor(s));
    document.querySelector('[data-vinc-edit]')?.addEventListener('click', () =>
      formVinculo(s, vinculosAbertos(s)[0] || null, ctx, { voltar: (freshCtx) => detalhe(s.id, freshCtx || ctx) }));
    document.getElementById('sv-vinc').addEventListener('click', () =>
      formVinculo(s, null, ctx, { voltar: (freshCtx) => detalhe(s.id, freshCtx || ctx) }));
    const box = document.getElementById('sv-vinculos');
    box.querySelectorAll('[data-edit-vinc]').forEach(b => b.addEventListener('click', () => {
      const v = s.vinculos.find(x => x.id === b.dataset.editVinc);
      formVinculo(s, v, ctx, { voltar: (freshCtx) => detalhe(s.id, freshCtx || ctx) });
    }));
    box.querySelectorAll('[data-del-vinc]').forEach(b =>
      b.addEventListener('click', () => removerVinculo(s, b.dataset.delVinc, ctx)));
  }
}

function listaVinculos(s, podeEditar) {
  if (!s.vinculos.length) return '<p class="count">Nenhum vínculo cadastrado.</p>';

  // Abertos primeiro; o histórico fica abaixo, apagado.
  const ordenados = [...s.vinculos].sort((a, b) =>
    (Number(Boolean(a.fim)) - Number(Boolean(b.fim)))
    || String(b.ingresso || '').localeCompare(String(a.ingresso || '')));

  return ordenados.map(v => {
    const encerrado = Boolean(v.fim);
    const periodo = [
      v.ingresso ? `desde ${fmtData(v.ingresso)}` : '',
      v.fim ? `até ${fmtData(v.fim)}` : '',
    ].filter(Boolean).join(' · ');
    const acoes = podeEditar ? `
      <div class="vinc-acoes">
        <button class="mini-btn" data-edit-vinc="${esc(v.id)}" aria-label="Editar vínculo">✎</button>
        <button class="mini-btn no" data-del-vinc="${esc(v.id)}" aria-label="Excluir vínculo">🗑</button>
      </div>` : '';
    return `<div class="person ${encerrado ? 'inativo' : ''}">
      <div class="role">${esc(rotulaCargo(v.papel))}${encerrado ? ' · encerrado' : ''}</div>
      <div class="pname">${v.unidade?.tipo === 'sede' ? '🏛 ' : ''}${esc(v.unidade?.nome || '—')}</div>
      <div class="pmeta">
        ${periodo ? `<span>${esc(periodo)}</span>` : ''}
        ${acoes}
      </div>
    </div>`;
  }).join('');
}
