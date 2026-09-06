// ============================================================
// FundHub - calendario/views/tipos-escala.js
// A gaveta "Tipos de escala": renomear "TDC Presencial"/"TDC Virtual",
// acrescentar uma variante ou excluir uma que não está em uso - sem
// deploy nenhum, porque o formato de TDC muda a cada calendário
// escolar. Rótulo é editável; a CHAVE não (é o que está gravado em
// dia_calendario.escala / horario_bloco.escala).
//
// Vive separado de escalas.js (que passou de 400 linhas - R11): é uma
// superfície própria. Ao mudar o catálogo, chama `onMudou` para a tela
// de fundo (escalas.js) reler e repintar.
// ============================================================
import { getEscalas, definirEscalaTipo, excluirEscalaTipo, rotulaEscala } from '../../horarios/escalas.model.js';
import { esc } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';
import { abrirDrawer, drawerHead } from '../../../shared/ui/drawer.js';
import { toast } from '../../../shared/ui/toast.js';
import { confirmar } from '../../../shared/ui/confirmar.js';

let catalogo = [];
let aoMudar = () => {};

export async function abrirTiposEscala({ onMudou = () => {} } = {}) {
  aoMudar = onMudou;
  abrirDrawer(`
    ${drawerHead('Tipos de escala', 'Rótulos usados no calendário e na jornada')}
    <div class="drawer-body">
      <div class="esc-form">
        <p class="form-hint">O nome muda aqui; o que já foi gravado (as datas do
          calendário, os blocos de jornada) continua apontando para a mesma escala -
          só o rótulo na tela muda.</p>
        <div id="et-lista"></div>
        <form id="et-novo" class="esc-row">
          <input id="et-chave" placeholder="chave (ex.: tdc-c)" required
                 pattern="[a-z0-9]+(-[a-z0-9]+)*" title="letras minúsculas, números e hífen"
                 aria-label="Chave do novo tipo de escala" />
          <input id="et-rotulo" placeholder="rótulo (ex.: TDC C)" required
                 aria-label="Rótulo do novo tipo de escala" />
          <button type="submit" class="mini-btn" aria-label="Criar tipo de escala">${ico('adicionar', { tam: 14 })}</button>
        </form>
      </div>
    </div>`);

  catalogo = await getEscalas().catch(() => []);
  pintar();
  document.getElementById('et-novo').addEventListener('submit', criar);
}

function pintar() {
  const lista = document.getElementById('et-lista');
  if (!lista) return;
  lista.innerHTML = catalogo.map(e => `
    <div class="et-linha" data-chave="${esc(e.chave)}">
      <label class="lbl et-campo">${esc(e.chave)}
        <input class="et-rotulo" value="${esc(e.rotulo)}" aria-label="Rótulo de ${esc(e.chave)}" />
      </label>
      ${e.chave !== 'normal'
        ? `<button type="button" class="mini-btn no et-del" aria-label="Excluir a escala ${esc(e.rotulo)}">${ico('excluir', { tam: 14 })}</button>`
        : ''}
    </div>`).join('');
  lista.querySelectorAll('.et-rotulo').forEach(inp => {
    inp.addEventListener('change', () => renomear(inp.closest('[data-chave]').dataset.chave, inp.value));
  });
  lista.querySelectorAll('.et-del').forEach(b => {
    b.addEventListener('click', () => excluir(b.closest('[data-chave]').dataset.chave));
  });
}

async function renomear(chave, rotulo) {
  try {
    await definirEscalaTipo(chave, { rotulo });
    catalogo = await getEscalas();
    toast({ titulo: 'Rótulo atualizado', texto: rotulo, tipo: 'sucesso' });
    aoMudar();
  } catch (err) {
    toast({ titulo: 'Não foi possível renomear', texto: err.message || String(err), tipo: 'erro' });
    pintar();                                       // desfaz visualmente
  }
}

async function criar(e) {
  e.preventDefault();
  const chave = document.getElementById('et-chave').value.trim();
  const rotulo = document.getElementById('et-rotulo').value.trim();
  if (!chave || !rotulo) return;
  try {
    await definirEscalaTipo(chave, { rotulo, ordem: catalogo.length });
    catalogo = await getEscalas();
    document.getElementById('et-chave').value = '';
    document.getElementById('et-rotulo').value = '';
    pintar();
    aoMudar();
    toast({ titulo: 'Tipo de escala criado', texto: rotulo, tipo: 'sucesso' });
  } catch (err) {
    toast({ titulo: 'Não foi possível criar', texto: err.message || String(err), tipo: 'erro' });
  }
}

async function excluir(chave) {
  const ok = await confirmar(`Excluir a escala "${rotulaEscala(chave, catalogo)}"?`, {
    detalhe: 'Só é possível se ela não estiver em nenhuma data do calendário nem em nenhuma jornada.',
    textoOk: 'Excluir', perigo: true,
  });
  if (!ok) return;
  try {
    await excluirEscalaTipo(chave);
    catalogo = await getEscalas();
    toast({ titulo: 'Escala excluída', tipo: 'sucesso' });
    pintar();
    aoMudar();
  } catch (err) {
    toast({ titulo: 'Não foi possível excluir', texto: err.message || String(err), tipo: 'erro' });
  }
}
