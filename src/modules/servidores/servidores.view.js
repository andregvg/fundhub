// ============================================================
// FundHub — modules/servidores/servidores.view.js
// Servidores: cadastro das pessoas e dos seus vínculos com as
// escolas. Cobre também quem é lotado na SEDE (equipe de
// acompanhamento, agentes administrativos), que não tem vínculo com
// unidade mas tem afastamento a controlar.
//
// A gaveta é o centro do módulo: abre a pessoa e, dentro dela, os
// vínculos — que é onde a escola de fato entra na história.
// ============================================================
import {
  PAPEIS, ANO_LETIVO, LOTACOES, CARGOS_SEDE, rotulaPapel, rotulaLotacao,
  getServidores, criarServidor, atualizarServidor, excluirServidor,
  criarVinculo, encerrarVinculo, excluirVinculo,
} from './servidores.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { sincronizarTelefones } from '../telefones/telefones.model.js';
import { esc, norm, falha } from '../../shared/dom.js';
import { hojeISO, fmtData } from '../../shared/format.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../shared/ui/drawer.js';
import { phonesEditorHtml, montarPhonesEditor, lerPhonesEditor, telefonesTexto } from '../../shared/ui/phones.js';
import { criarFiltroSegmento, indexarUnidades } from '../../shared/ui/filtro-segmento.js';
import { podeEscrever } from '../../core/permissoes.js';

let perfil = null, lista = [], unidades = [], idxUnidades = {};
let seg = null, podeEditar = false;
let filtro = { q: '', papel: '', lotacao: '', semVinculo: false };

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;
  podeEditar = podeEscrever('servidores');

  app.innerHTML = `
    <div class="page-head">
      <h1>Servidores</h1>
      <p>Cadastro funcional, lotações e vínculos com as escolas — ano letivo ${ANO_LETIVO}.</p>
    </div>
    <div class="toolbar">
      <label class="search">🔎
        <input id="sv-q" type="search" placeholder="Buscar por nome, apelido, e-mail, cargo ou escola…" autocomplete="off" />
      </label>
      <span class="count" id="sv-count"></span>
      <button id="sv-novo" class="btn-primary" hidden>+ Novo servidor</button>
    </div>
    <div id="sv-seg" class="toolbar-linha"></div>
    <div class="toolbar-linha">
      <div class="filters" id="sv-filtros">
        ${PAPEIS.map(p => `<button class="chip" data-papel="${p}">${esc(rotulaPapel(p))}</button>`).join('')}
        <span class="fseg-sep" aria-hidden="true"></span>
        ${LOTACOES.map(([v, r]) => `<button class="chip" data-lotacao="${v}">${esc(r)}</button>`).join('')}
        <button class="chip" data-flag="sem">⚠️ Sem vínculo</button>
      </div>
    </div>
    <div class="cards" id="sv-cards">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();

  try {
    [lista, unidades] = await Promise.all([getServidores(), getUnidades().catch(() => [])]);
    idxUnidades = indexarUnidades(unidades);
  } catch (err) {
    document.getElementById('sv-cards').innerHTML = erroBox(err);
    return;
  }

  // O segmento de um servidor é o das escolas em que ele atua.
  seg = criarFiltroSegmento(document.getElementById('sv-seg'), {
    perfil, onChange: pintar, chaveMemoria: 'fundhub:seg:servidores',
  });

  document.getElementById('sv-q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
  document.getElementById('sv-filtros').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.papel != null) filtro.papel = filtro.papel === b.dataset.papel ? '' : b.dataset.papel;
    if (b.dataset.lotacao != null) filtro.lotacao = filtro.lotacao === b.dataset.lotacao ? '' : b.dataset.lotacao;
    if (b.dataset.flag === 'sem') filtro.semVinculo = !filtro.semVinculo;
    pintar();
  });

  if (podeEditar) {
    const novo = document.getElementById('sv-novo');
    novo.hidden = false;
    novo.addEventListener('click', () => formServidor(null));
  }

  pintar();
}

// Vínculos ativos do ano corrente — é o que a tela mostra por padrão.
const vinculosVigentes = (s) => s.vinculos.filter(v => v.ativo && v.ano === ANO_LETIVO);

function combina(s) {
  const vig = vinculosVigentes(s);
  if (filtro.papel && !vig.some(v => v.papel === filtro.papel)) return false;
  if (filtro.lotacao && (s.lotacao || 'escola') !== filtro.lotacao) return false;
  if (filtro.semVinculo && vig.length) return false;

  // Recorte por segmento: entra quem atua em ALGUMA escola do
  // segmento. Quem é da sede não tem escola — e por isso continua
  // visível, senão o filtro esconderia justamente a equipe da SME.
  if (seg && seg.selecionados().length && (s.lotacao || 'escola') !== 'sede') {
    const bate = vig.some(v => seg.combina(idxUnidades[v.unidade_id]));
    if (!bate) return false;
  }

  if (filtro.q) {
    const alvo = norm([
      s.nome, s.apelido, s.email, s.cargo, s.codigo_funcional,
      ...(s.telefones || []).map(t => t.numero),
      ...vig.map(v => `${v.unidade?.nome} ${v.unidade?.apelido} ${rotulaPapel(v.papel)}`),
    ].join(' '));
    if (!alvo.includes(norm(filtro.q))) return false;
  }
  return true;
}

function pintar() {
  document.querySelectorAll('#sv-filtros .chip').forEach(b => {
    const on = (b.dataset.papel != null && b.dataset.papel === filtro.papel)
      || (b.dataset.lotacao != null && b.dataset.lotacao === filtro.lotacao)
      || (b.dataset.flag === 'sem' && filtro.semVinculo);
    b.classList.toggle('on', on);
  });

  const vis = lista.filter(combina).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  document.getElementById('sv-count').textContent = `${vis.length} de ${lista.length} servidores`;

  const box = document.getElementById('sv-cards');
  if (!lista.length) {
    box.innerHTML = emptyState('👥', 'Nenhum servidor cadastrado',
      perfil?.isAdmin ? 'Clique em “Novo servidor” para começar.' : 'Peça a um administrador para cadastrar a equipe.');
    return;
  }
  box.innerHTML = vis.map(card).join('')
    || emptyState('🔎', 'Nenhum servidor encontrado', 'Ajuste a busca ou os filtros.');
  box.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', () => detalhe(c.dataset.id)));
}

function card(s) {
  const daSede = (s.lotacao || 'escola') === 'sede';
  const vig = vinculosVigentes(s);
  const papeis = [...new Set(vig.map(v => v.papel))]
    .map(p => `<span class="seg">${esc(rotulaPapel(p))}</span>`).join('');

  // Quem é da sede não tem vínculo com escola: mostrar "sem vínculo"
  // seria um falso alerta. O que identifica essa pessoa é o cargo.
  const lugares = daSede
    ? `<span class="tag">🏛 ${esc(s.cargo || 'Sede da SME')}</span>`
    : vig.length
      ? vig.map(v => `<span class="tag">${esc(v.unidade?.apelido || v.unidade?.nome || '—')}</span>`).join('')
      : `<span class="tag eja">⚠️ Sem vínculo em ${ANO_LETIVO}</span>`;

  // Nome completo em caixa alta (como nos sistemas oficiais); o
  // apelido logo abaixo, em caixa normal — não precisa de destaque.
  return `<article class="card" data-id="${esc(s.id)}" tabindex="0">
    <div class="card-top">
      <h3 class="nome-oficial">${esc(s.nome)}</h3>
      ${papeis}
    </div>
    ${s.apelido ? `<div class="apelido">${esc(s.apelido)}</div>` : ''}
    <div class="tags">${lugares}</div>
  </article>`;
}

// ── Detalhe ──────────────────────────────────────────────────
function detalhe(id) {
  const s = lista.find(x => x.id === id);
  if (!s) return;

  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val">${v}</div></div>` : '';
  const acoes = podeEditar ? `
    <div class="drawer-acoes">
      <button class="mini-btn" id="sv-edit">✎ Editar</button>
      <button class="mini-btn no" id="sv-del">🗑 Excluir</button>
    </div>` : '';

  abrirDrawer(`
    ${drawerHead(`<span class="nome-oficial">${esc(s.nome)}</span>`, esc(s.apelido || ''))}
    <div class="drawer-body">
      ${acoes}
      ${campo('Lotação', esc(rotulaLotacao(s.lotacao)) + (s.cargo ? ` · ${esc(s.cargo)}` : ''))}
      ${campo('E-mail', s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '')}
      ${campo('Telefones', (s.telefones || []).length ? telefonesTexto(s.telefones) : '')}
      ${campo('Código funcional', esc(s.codigo_funcional || ''))}
      ${campo('CPF', esc(s.cpf || ''))}
      ${campo('RG', esc(s.rg || ''))}
      ${campo('Ingresso na rede', s.inicio_rede ? esc(fmtData(s.inicio_rede)) : '')}
      <hr class="sep" />
      <div class="vinc-head">
        <div class="field" style="margin:0"><div class="lbl">Vínculos com escolas</div></div>
        ${podeEditar ? `<button class="mini-btn" id="sv-vinc">+ Vincular a uma escola</button>` : ''}
      </div>
      <div class="people" id="sv-vinculos">${listaVinculos(s)}</div>
    </div>`);

  if (!podeEditar) return;
  document.getElementById('sv-edit').addEventListener('click', () => formServidor(s));
  document.getElementById('sv-del').addEventListener('click', () => removerServidor(s));
  document.getElementById('sv-vinc').addEventListener('click', () => formVinculo(s));
  ligarAcoesVinculo(s);
}

function listaVinculos(s) {
  if (!s.vinculos.length) return '<p class="count">Nenhum vínculo cadastrado.</p>';

  // Vigentes primeiro; o histórico fica abaixo, apagado.
  const ordenados = [...s.vinculos].sort((a, b) =>
    (b.ativo - a.ativo) || (b.ano - a.ano) || String(a.papel).localeCompare(b.papel));

  return ordenados.map(v => {
    const encerrado = !v.ativo || v.ano !== ANO_LETIVO;
    const periodo = [
      v.ingresso ? `desde ${fmtData(v.ingresso)}` : '',
      v.fim ? `até ${fmtData(v.fim)}` : '',
    ].filter(Boolean).join(' · ');
    const acoes = podeEditar ? `
      <div class="vinc-acoes">
        ${v.ativo ? `<button class="mini-btn" data-encerrar="${v.id}">Encerrar</button>` : ''}
        <button class="mini-btn no" data-del-vinc="${v.id}" aria-label="Excluir vínculo">🗑</button>
      </div>` : '';
    return `<div class="person ${encerrado ? 'inativo' : ''}">
      <div class="role">${esc(rotulaPapel(v.papel))} · ${esc(v.ano)}${v.ativo ? '' : ' · encerrado'}</div>
      <div class="pname">${esc(v.unidade?.nome || '—')}</div>
      <div class="pmeta">
        ${periodo ? `<span>${esc(periodo)}</span>` : ''}
        ${acoes}
      </div>
    </div>`;
  }).join('');
}

function ligarAcoesVinculo(s) {
  const box = document.getElementById('sv-vinculos');
  box.querySelectorAll('[data-encerrar]').forEach(b =>
    b.addEventListener('click', () => encerrar(s, b.dataset.encerrar)));
  box.querySelectorAll('[data-del-vinc]').forEach(b =>
    b.addEventListener('click', () => removerVinculo(s, b.dataset.delVinc)));
}

// ── Formulário: servidor ─────────────────────────────────────
function formServidor(s) {
  const novo = !s;
  const v = (k) => esc(s?.[k] ?? '');

  const lot = s?.lotacao || 'escola';

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo servidor' : 'Editar servidor', novo ? '' : esc(s.nome))}
    <div class="drawer-body">
      <form id="sv-form" class="esc-form">

        <fieldset class="form-grupo">
          <legend>Identificação</legend>
          <div class="campos">
            <label>Nome completo <input id="s-nome" required value="${v('nome')}" /></label>
            <label>Apelido / como é chamado(a) <input id="s-apelido" value="${v('apelido')}" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Dados funcionais</legend>
          <div class="campos duas">
            <label>Código funcional <input id="s-codigo" inputmode="numeric" value="${v('codigo_funcional')}" /></label>
            <label>Ingresso na rede <input id="s-ingresso" type="date" value="${v('inicio_rede')}" /></label>
            <label>Lotação <select id="s-lotacao">
              ${LOTACOES.map(([val, r]) => `<option value="${val}" ${lot === val ? 'selected' : ''}>${esc(r)}</option>`).join('')}
            </select></label>
            <label>Cargo / função <input id="s-cargo" list="cargos" value="${v('cargo')}" />
              <datalist id="cargos">${CARGOS_SEDE.map(c => `<option>${esc(c)}</option>`).join('')}</datalist>
            </label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Documentos</legend>
          <div class="campos duas">
            <label>CPF <input id="s-cpf" inputmode="numeric" placeholder="000.000.000-00" value="${v('cpf')}" /></label>
            <label>RG <input id="s-rg" value="${v('rg')}" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Contato</legend>
          <div class="campos">
            <label>E-mail <input id="s-email" type="email" value="${v('email')}" /></label>
            ${phonesEditorHtml(s?.telefones)}
          </div>
        </fieldset>

        <div class="form-foot">
          <span id="s-msg" class="auth-msg"></span>
          <button type="submit" id="s-save" class="btn-primary">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
      ${novo ? `<p class="form-hint" style="margin-top:14px">Depois de criar, abra o servidor para vinculá-lo a uma escola.</p>` : ''}
    </div>`);

  montarPhonesEditor(document.getElementById('sv-form'));
  document.getElementById('sv-form').addEventListener('submit', (e) => salvarServidor(e, s));
}

async function salvarServidor(e, s) {
  e.preventDefault();
  const msg = document.getElementById('s-msg'); msg.className = 'auth-msg';
  const val = (id) => document.getElementById(id).value.trim();
  const payload = {
    // Nome em caixa alta na origem: os cards e a gaveta exibem assim,
    // e gravar normalizado evita a lista misturar "Maria" e "MARIA".
    nome: val('s-nome').toUpperCase(),
    apelido: val('s-apelido') || null,
    email: val('s-email') || null,
    codigo_funcional: val('s-codigo') || null,
    cargo: val('s-cargo') || null,
    lotacao: document.getElementById('s-lotacao').value,
    cpf: val('s-cpf') || null,
    rg: val('s-rg') || null,
    inicio_rede: document.getElementById('s-ingresso').value || null,
  };
  if (!payload.nome) return falha(msg, 'Informe o nome completo.');
  const telefones = lerPhonesEditor(document.getElementById('sv-form'));

  const btn = document.getElementById('s-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    const id = s ? (await atualizarServidor(s.id, payload), s.id) : (await criarServidor(payload)).id;
    await sincronizarTelefones({ servidorId: id }, telefones);
    lista = await getServidores();
    fecharDrawer(); pintar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = s ? 'Salvar' : 'Criar';
  }
}

async function removerServidor(s) {
  const n = s.vinculos.length;
  const aviso = n
    ? `Excluir "${s.nome}"?\n\nIsso apaga junto ${n} vínculo(s), os horários e os afastamentos dele. Não pode ser desfeito.`
    : `Excluir "${s.nome}"? Esta ação não pode ser desfeita.`;
  if (!confirm(aviso)) return;
  try {
    await excluirServidor(s.id);
    lista = await getServidores();
    fecharDrawer(); pintar();
  } catch (err) {
    alert('Não foi possível excluir: ' + (err.message || err));
  }
}

// ── Formulário: vínculo ──────────────────────────────────────
function formVinculo(s) {
  const opts = [...unidades].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    .map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead('Vincular a uma escola', esc(s.nome))}
    <div class="drawer-body">
      <form id="vc-form" class="esc-form">
        <label>Escola <select id="v-uni" required><option value="">Selecione…</option>${opts}</select></label>
        <label>Papel <select id="v-papel" required>
          ${PAPEIS.map(p => `<option value="${p}">${esc(rotulaPapel(p))}</option>`).join('')}
        </select></label>
        <div class="esc-row">
          <label>Ano letivo <input id="v-ano" type="number" inputmode="numeric" value="${ANO_LETIVO}" required /></label>
          <label>Data de ingresso <input id="v-ingresso" type="date" /></label>
        </div>
        <div class="form-foot">
          <span id="v-msg" class="auth-msg"></span>
          <button type="submit" id="v-save">Vincular</button>
        </div>
      </form>
    </div>`);

  document.getElementById('vc-form').addEventListener('submit', (e) => salvarVinculo(e, s));
}

async function salvarVinculo(e, s) {
  e.preventDefault();
  const msg = document.getElementById('v-msg'); msg.className = 'auth-msg';
  const unidade_id = document.getElementById('v-uni').value;
  const ano = parseInt(document.getElementById('v-ano').value, 10);
  if (!unidade_id) return falha(msg, 'Selecione a escola.');
  if (!(ano > 2000)) return falha(msg, 'Informe um ano letivo válido.');

  const btn = document.getElementById('v-save'); btn.disabled = true; btn.textContent = 'Vinculando…';
  try {
    await criarVinculo({
      servidor_id: s.id,
      unidade_id,
      papel: document.getElementById('v-papel').value,
      ano,
      ingresso: document.getElementById('v-ingresso').value || null,
    });
    lista = await getServidores();
    pintar();
    detalhe(s.id);   // volta ao detalhe, já com o vínculo novo
  } catch (err) {
    falha(msg, err.message || String(err));
    btn.disabled = false; btn.textContent = 'Vincular';
  }
}

async function encerrar(s, vinculoId) {
  const fim = prompt('Data de encerramento do vínculo (AAAA-MM-DD):', hojeISO());
  if (!fim) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fim)) return alert('Data inválida. Use o formato AAAA-MM-DD.');
  try {
    await encerrarVinculo(vinculoId, fim);
    lista = await getServidores();
    pintar();
    detalhe(s.id);
  } catch (err) {
    alert('Não foi possível encerrar: ' + (err.message || err));
  }
}

async function removerVinculo(s, vinculoId) {
  if (!confirm('Excluir este vínculo? Para preservar o histórico, prefira “Encerrar”.')) return;
  try {
    await excluirVinculo(vinculoId);
    lista = await getServidores();
    pintar();
    detalhe(s.id);
  } catch (err) {
    alert('Não foi possível excluir: ' + (err.message || err));
  }
}
