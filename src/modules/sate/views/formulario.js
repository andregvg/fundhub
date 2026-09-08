// ============================================================
// FundHub - sate/views/formulario.js
// O modal de nova solicitação. Substitui a aba "Nova solicitação"
// (spec 2026-09-08-sate-solicitacoes-design.md § D2, D3, D6).
//
// Dois modos: atividade do CATÁLOGO (gerida pela SME) ou atividade
// LIVRE (organizada pela escola, com destino informado à mão).
//
// Os campos se agrupam por PERGUNTA - o que, quando, quem vai, contato -
// e não por tipo de campo. No modal largo os blocos deixam o formulário
// legível de relance; em tela estreita eles são as âncoras que dizem
// onde a pessoa está numa coluna longa.
// ============================================================
import { criarSolicitacao, listSolicitacoes } from '../sate.model.js';
import { saldoDoDia, livreManhaSeguinte } from '../saldo.model.js';
import { avaliarPedido, onibusPara, vansPara } from '../regras.model.js';
import { capacidadeOnibus, capacidadeVan, intervaloMinMin, antecedenciaMinDias } from '../sate.config.js';
import { getDiaCalendario } from '../../calendario/calendario.model.js';
import { esc, val, falha } from '../../../shared/dom.js';
import { hojeISO, addDias, fmtData, isUuid } from '../../../shared/format.js';
import { modalHead, abrirModal, fecharModal } from '../../../shared/ui/modal.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

let ctx = null;
let modo = 'catalogo';
// Cada consulta de saldo recebe um número. Digitar "40" dispara duas
// mudanças, e sem isto a resposta da primeira pode chegar depois da
// segunda e pintar o saldo do número errado.
let pedidoSaldo = 0;
let deb = null;

export function abrirFormulario(contexto) {
  ctx = contexto;
  const { perfil, atividades, unidades, aprovador } = ctx;
  const minData = aprovador ? hojeISO() : addDias(hojeISO(), antecedenciaMinDias());

  const opts = (lista, valor, rotulo) => lista
    .map(x => `<option value="${esc(valor(x))}">${esc(rotulo(x))}</option>`).join('');

  abrirModal(`
    ${modalHead('Nova solicitação', 'Transporte para atividade extraclasse')}
    <div class="modal-body">
      <form id="sol-form" class="esc-form sol-form">

        <fieldset class="form-grupo">
          <legend>O que</legend>
          <div class="campos">
            <div class="modo-toggle">
              <label class="inline"><input type="radio" name="modo" value="catalogo" ${modo === 'catalogo' ? 'checked' : ''} /> Atividade do catálogo</label>
              <label class="inline"><input type="radio" name="modo" value="livre" ${modo === 'livre' ? 'checked' : ''} /> Outra atividade (organizada pela escola)</label>
            </div>
            <label class="m-catalogo">Atividade
              <select id="f-ativ"><option value="">Selecione…</option>${opts(atividades, a => a.id, a => a.nome)}</select></label>
            <label class="m-livre">Nome da atividade
              <input id="f-ativ-livre" type="text" placeholder="Ex.: Visita ao teatro municipal" /></label>
            <label class="m-livre">Destino
              <select id="f-local">
                <option value="">- outro destino (digitar abaixo) -</option>
                ${opts((ctx.locais || []).filter(l => l.ativo), l => l.id, l => l.nome)}
              </select></label>
            <label class="m-livre" id="w-dest-nome">Nome do destino
              <input id="f-dest-nome" type="text" placeholder="Ex.: Teatro municipal" /></label>
            <label class="m-livre" id="w-dest-end">Endereço do destino
              <input id="f-dest-end" type="text" placeholder="Rua, nº - bairro" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Quando</legend>
          <div class="campos duas">
            <label>Data <input id="f-data" type="date" min="${minData}" required /></label>
            <label>Período
              <select id="f-per" required>
                <option value="">Selecione…</option>
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
              </select></label>
            <label>Horário de embarque <input id="f-emb" type="time" /></label>
            <label>Horário de retorno <input id="f-ret" type="time" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Quem vai</legend>
          <div class="campos duas">
            <label class="col-2">Escola
              <select id="f-esc" required><option value="">Selecione…</option>${
                opts([...unidades].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')),
                     u => u.id || u.numero, u => u.apelido || u.nome)}</select></label>
            <label>Turma(s) <input id="f-turmas" type="text" placeholder="Ex.: 5º A, 5º B" /></label>
            <label>Nº de estudantes <input id="f-alunos" type="number" inputmode="numeric" min="1" required /></label>
            <label class="col-2">Nº de cadeirantes (transporte adaptado)
              <input id="f-cadeira" type="number" inputmode="numeric" min="0" value="0" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Contato e observação</legend>
          <div class="campos">
            <label>Contato do professor(a) <input id="f-contato" type="text" placeholder="Nome e telefone" /></label>
            <label>Observação <textarea id="f-obs" rows="2"></textarea></label>
          </div>
        </fieldset>

        <div id="f-saldo" class="sol-saldo" aria-live="polite"></div>
        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-submit" class="btn-primary">Enviar solicitação</button>
        </div>
      </form>
    </div>`, { tamanho: 'largo' });

  ligar();
}

function ligar() {
  const form = document.getElementById('sol-form');

  // Mostrar/esconder é por `hidden`, não por classe: as regras de rótulo
  // de `.form-grupo .campos` somam cinco classes e venceriam um
  // `display: none` vindo de sate.css. `[hidden]` em base.css resolve
  // isso de uma vez para o hub inteiro.
  const aplicarModo = () => {
    const livre = modo === 'livre';
    form.querySelectorAll('.m-livre').forEach(el => { el.hidden = !livre; });
    form.querySelectorAll('.m-catalogo').forEach(el => { el.hidden = livre; });
    if (livre) alternarDestino();
  };
  form.querySelectorAll('input[name="modo"]').forEach(r =>
    r.addEventListener('change', () => { modo = r.value; aplicarModo(); revisar(); }));

  // Local do catálogo já traz nome e endereço: os campos de texto somem.
  const localSel = document.getElementById('f-local');
  function alternarDestino() {
    const usaCatalogo = !!localSel.value;
    document.getElementById('w-dest-nome').hidden = usaCatalogo;
    document.getElementById('w-dest-end').hidden = usaCatalogo;
  }
  localSel.addEventListener('change', alternarDestino);
  aplicarModo();

  for (const id of ['f-data', 'f-per', 'f-alunos', 'f-cadeira', 'f-emb', 'f-ret', 'f-ativ']) {
    document.getElementById(id).addEventListener('change', revisar);
  }
  document.getElementById('f-alunos').addEventListener('input', revisar);
  form.addEventListener('submit', enviar);
  revisar();
}

// ── Saldo ao vivo ────────────────────────────────────────────
// Consulta o banco no máximo a cada 400 ms, e só quando data e período
// já foram escolhidos - sem eles não há saldo a mostrar.
function revisar() {
  clearTimeout(deb);
  deb = setTimeout(pintarSaldo, 400);
}

async function pintarSaldo() {
  const box = document.getElementById('f-saldo');
  const btn = document.getElementById('f-submit');
  if (!box) return;   // o modal fechou enquanto o debounce corria

  const data = val('f-data');
  const periodo = document.getElementById('f-per').value;
  const alunos = parseInt(val('f-alunos'), 10) || 0;
  if (!data || !periodo || !alunos) { box.innerHTML = ''; btn.disabled = false; return; }

  const meu = ++pedidoSaldo;
  let saldo, livreAmanha = 0, viagensDoDia = [];
  try {
    [saldo, livreAmanha, viagensDoDia] = await Promise.all([
      saldoDoDia(data),
      periodo === 'noite' ? livreManhaSeguinte(data) : Promise.resolve(0),
      periodo === 'tarde' ? listSolicitacoes({ de: data, ate: data }) : Promise.resolve([]),
    ]);
  } catch (_) { box.innerHTML = ''; btn.disabled = false; return; }
  if (meu !== pedidoSaldo) return;   // resposta velha: descarta

  const r = avaliar({ data, periodo, alunos, saldo, livreAmanha, viagensDoDia });
  const s = saldo.onibus[periodo];

  const linhas = [
    `<div class="sol-saldo-num"><b>${s.livre}</b> de ${s.total} ônibus livres em ${esc(fmtData(data))}`
    + ` · este pedido usa <b>${r.onibus}</b></div>`,
    ...r.erros.map(e => `<div class="sol-erro">${esc(e.texto)}</div>`),
    ...r.avisos.map(a => `<div class="sol-aviso">${esc(a.texto)}</div>`),
  ];
  box.innerHTML = linhas.join('');
  // Erro barra; aviso não. Para quem aprova, `avaliarPedido` já devolveu
  // como aviso o que para a escola seria erro - a tela só pinta.
  btn.disabled = r.erros.length > 0;
}

// Monta o argumento de avaliarPedido a partir do que está na tela.
function avaliar({ data, periodo, alunos, saldo, livreAmanha, viagensDoDia }) {
  const livre = {}, livreVan = {};
  for (const p of ['manha', 'tarde', 'noite']) {
    livre[p] = saldo.onibus[p].livre;
    livreVan[p] = saldo.van_adaptada[p].livre;
  }
  const dias = Math.round((new Date(data + 'T00:00:00') - new Date(hojeISO() + 'T00:00:00')) / 86400000);
  return avaliarPedido({
    periodo, qtdAlunos: alunos,
    qtdCadeirantes: parseInt(val('f-cadeira'), 10) || 0,
    livre, livreVan, livreManhaSeguinte: livreAmanha,
    diasDeAntecedencia: dias,
    viagensDoDia: viagensDoDia.filter(v => v.periodo === 'manha'),
    horarioEmbarque: val('f-emb') || null,
    horarioRetorno: val('f-ret') || null,
    capacidadeOnibus: capacidadeOnibus(),
    capacidadeVan: capacidadeVan(),
    intervaloMin: intervaloMinMin(),
    antecedenciaMin: antecedenciaMinDias(),
    aprovador: !!ctx.aprovador,
  });
}

// ── Envio ────────────────────────────────────────────────────
async function enviar(e) {
  e.preventDefault();
  const msg = document.getElementById('f-msg'); msg.className = 'auth-msg';
  const { atividades, aprovador } = ctx;

  const escId = document.getElementById('f-esc').value;
  const data = val('f-data');
  const periodo = document.getElementById('f-per').value;
  const qtd = parseInt(val('f-alunos'), 10);
  const cadeira = parseInt(val('f-cadeira'), 10) || 0;

  let atividade = null, atividadeLivre = null, usaOnibus = true;
  let localId = null, destinoNome = null, destinoEnd = null;
  if (modo === 'catalogo') {
    atividade = atividades.find(x => x.id === document.getElementById('f-ativ').value);
    if (!atividade) return falha(msg, 'Selecione uma atividade do catálogo (ou use “Outra atividade”).');
    usaOnibus = atividade.usa_onibus;
    localId = atividade.local_id || null;
  } else {
    atividadeLivre = val('f-ativ-livre');
    if (!atividadeLivre) return falha(msg, 'Informe o nome da atividade organizada pela escola.');
    const local = (ctx.locais || []).find(l => l.id === document.getElementById('f-local').value);
    if (local) { localId = local.id; destinoNome = local.nome; destinoEnd = local.endereco || null; }
    else { destinoNome = val('f-dest-nome') || null; destinoEnd = val('f-dest-end') || null; }
  }

  if (!escId || !data || !periodo || !qtd) return falha(msg, 'Preencha escola, data, período e nº de estudantes.');
  if (data < hojeISO()) return falha(msg, 'A data não pode ser no passado.');
  if (atividade?.min_participantes && qtd < atividade.min_participantes) {
    return falha(msg, `Esta atividade exige no mínimo ${atividade.min_participantes} participantes.`);
  }

  // Bloqueios do calendário escolar. Quem aprova passa por cima.
  if (!aprovador) {
    try {
      const dia = await getDiaCalendario(data);
      if (dia?.bloqueia_extraclasse) return falha(msg, `Data bloqueada para extraclasse${dia.evento ? ` (${dia.evento})` : ''}.`);
      if (dia && dia.letivo === false) return falha(msg, `${fmtData(data)} não é dia letivo${dia.evento ? ` (${dia.evento})` : ''}.`);
    } catch (_) { /* sem calendário carregado, segue */ }
  }

  const payload = {
    atividade_id: atividade ? atividade.id : null,
    atividade_livre: atividadeLivre,
    unidade_id: isUuid(escId) ? escId : null,
    data, periodo,
    qtd_alunos: qtd,
    qtd_cadeirante: cadeira,
    qtd_onibus: usaOnibus ? onibusPara(qtd, capacidadeOnibus()) : 0,
    qtd_vans: vansPara(cadeira, capacidadeVan()),
    turmas: val('f-turmas') || null,
    local_id: localId,
    destino_nome: destinoNome,
    destino_endereco: destinoEnd,
    horario_embarque: val('f-emb') || null,
    horario_retorno: val('f-ret') || null,
    contato_professor: val('f-contato') || null,
    observacao: val('f-obs') || null,
  };

  const escola = (ctx.unidades || []).find(u => (u.id || u.numero) === escId)?.nome || '';
  const btn = document.getElementById('f-submit');
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    await criarSolicitacao(payload);
    fecharModal();
    ctx.recarregar?.();
    toast({ titulo: 'Solicitação enviada', texto: escola, tipo: 'sucesso' });
  } catch (err) {
    reportarErro(err, { msg, titulo: 'Não foi possível enviar' });
    btn.disabled = false; btn.textContent = 'Enviar solicitação';
  }
}
