// ============================================================
// FundHub — escolas/views/detalhe.js  (gaveta de detalhe da escola)
// Atributos booleanos (transporte, EJA) viram chip no cabeçalho — um
// campo inteiro para dizer "EJA: Não" ocupava espaço para informar
// nada. Os demais campos ficam agrupados sob título de bloco.
// ============================================================
import { esc } from '../../../shared/dom.js';
import { drawerHead, abrirDrawer } from '../../../shared/ui/drawer.js';
import { telefonesTexto } from '../../../shared/ui/phones.js';
import { ico } from '../../../shared/ui/icones.js';

// `ctx`: { perfil, podeEditar, recarregar, abrirForm, removerEscola }
// — ver escolas.view.js § ctxAtual().
export function detalhe(u, ctx) {
  const tel = telefonesTexto(u.telefones);
  const maps = u.endereco
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u.endereco + ', Ribeirão Preto, SP')}`
    : '';

  // Atributo booleano vira CHIP no cabeçalho. Um campo inteiro para
  // dizer "EJA: Não" ocupava espaço para informar nada.
  const chips = [
    u.segmento ? `<span class="seg">${esc(u.segmento)}</span>` : '',
    u.oferta ? `<span class="tag">${esc(u.oferta)}</span>` : '',
    u.tem_transporte ? `<span class="tag bus">${ico('transporte', { tam: 12 })} Transporte</span>` : '',
    u.tem_eja ? `<span class="tag eja">${ico('noturno', { tam: 12 })} EJA</span>` : '',
  ].filter(Boolean).join('');

  const pessoas = (u.pessoas || []).filter(p => p.nome).map(p => `
    <div class="person">
      <div class="role">${esc(p.papel)}</div>
      <div class="pname">${esc(p.nome)}${p.apelido ? ` · ${esc(p.apelido)}` : ''}</div>
      <div class="pmeta">
        ${p.email ? `<span>${ico('email', { tam: 12 })} <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></span>` : ''}
        ${p.telefone ? `<span>${ico('celular', { tam: 12 })} ${esc(p.telefone)}</span>` : ''}
      </div>
    </div>`).join('') || '<p class="count">Sem pessoas vinculadas.</p>';

  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val">${v}</div></div>` : '';

  abrirDrawer(`
    ${drawerHead(esc(u.nome), esc(u.nome_oficial || ''))}
    <div class="drawer-body">
      ${chips ? `<div class="tags" style="margin-bottom:14px">${chips}</div>` : ''}
      <div class="drawer-acoes">
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
        <div class="field" style="margin:0"><div class="lbl">Equipe (${(u.pessoas || []).length})</div></div>
        <a class="mini-btn" href="#/servidores?unidade=${esc(u.id)}">Gerir em Servidores →</a>
      </div>
      <div class="people">${pessoas}</div>
      <p class="form-hint" style="margin-top:10px">
        A equipe vem dos vínculos abertos. Para incluir ou encerrar alguém, use Servidores.
      </p>
    </div>`);

  if (ctx.podeEditar) {
    document.getElementById('edit-esc').addEventListener('click', () => ctx.abrirForm(u));
    document.getElementById('del-esc').addEventListener('click', () => ctx.removerEscola(u));
  }
}
