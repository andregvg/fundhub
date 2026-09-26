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
import { criarSolicitacao } from '../sate.model.js';
import {
  lerOcupacao, intervaloDaViagem, livresPara, totalDoDia, proximoHorario, livresNoPeriodo,
} from '../disponibilidade.model.js';
import { avaliarPedido, onibusPara, vansPara } from '../regras.model.js';
import { calcularTrajeto, retratoTrajeto, explicarTrajeto } from '../rota.model.js';
import {
  capacidadeOnibus, capacidadeVan, antecedenciaMinDias,
  velocidadeOnibusKmh, margemParadaMin,
} from '../sate.config.js';
import { getDiaCalendario } from '../../calendario/calendario.model.js';
import { cadastroRapidoHtml, ligarCadastroRapido } from './frota-rapida.js';
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
// O trajeto da escola escolhida até o destino escolhido. Vai para a
// solicitação como retrato no envio (spec 2026-09-13-sate-rota, D4). O
// contador tem a mesma função do de saldo: trocar de escola duas vezes
// dispara duas consultas, e só a última pode pintar.
let trajeto = null;
let pedidoTrajeto = 0;

export function abrirFormulario(contexto) {
  ctx = contexto;
  const { perfil, atividades, unidades, aprovador } = ctx;
  const minData = aprovador ? hojeISO() : addDias(hojeISO(), antecedenciaMinDias());

  const opts = (lista, valor, rotulo) => lista
    .map(x => `<option value="${esc(valor(x))}">${esc(rotulo(x))}</option>`).join('');

  abrirModal(`
    ${modalHead('Nova solicitação', 'Transporte para atividade extraclasse')}
    <div class="modal-body">
      <form id="sol-form" class="esc-form">

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
            <label>Horário de embarque <input id="f-emb" type="time" required /></label>
            <label>Horário de retorno <input id="f-ret" type="time" required /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Quem vai</legend>
          <div class="campos duas">
            <label class="col-2">Escola
              <select id="f-esc" required>${opcoesEscola(unidades, perfil, aprovador)}</select></label>
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

        <div id="f-trajeto" class="sol-trajeto" aria-live="polite"></div>
        <div id="f-saldo" class="sol-saldo" aria-live="polite"></div>
        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-submit" class="btn-primary" ${ctx.somenteLeitura ? 'disabled' : ''}>${ctx.somenteLeitura ? 'Envio desativado nesta visualização' : 'Enviar solicitação'}</button>
        </div>
      </form>
    </div>`, { tamanho: 'largo' });

  ligar();
}

// Quem aprova escolhe qualquer escola. A escola, só as dela - antes a
// lista trazia a rede inteira e o banco recusava o pedido feito para
// outra unidade, com um erro que a pessoa não entendia. Se é uma só, já
// vem escolhida.
function opcoesEscola(unidades, perfil, aprovador) {
  const minhas = perfil?.unidades || [];
  const lista = [...(unidades || [])]
    .filter(u => aprovador || minhas.includes(u.id))
    .sort((a, b) => (a.apelido || a.nome).localeCompare(b.apelido || b.nome, 'pt'));
  const unica = lista.length === 1;
  return (unica ? '' : '<option value="">Selecione…</option>')
    + lista.map(u => `<option value="${esc(u.id || u.numero)}" ${unica ? 'selected' : ''}>${esc(u.apelido || u.nome)}</option>`).join('');
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

  // O trajeto depende só de ORIGEM e DESTINO - não de data, período ou
  // estudantes. Recalcula quando um dos dois muda, e não a cada tecla.
  for (const id of ['f-esc', 'f-ativ', 'f-local', 'f-dest-nome']) {
    document.getElementById(id).addEventListener('change', pintarTrajeto);
  }
  form.querySelectorAll('input[name="modo"]').forEach(r => r.addEventListener('change', pintarTrajeto));
  trajeto = null;

  for (const id of ['f-data', 'f-per', 'f-alunos', 'f-cadeira', 'f-emb', 'f-ret', 'f-ativ']) {
    document.getElementById(id).addEventListener('change', revisar);
  }
  document.getElementById('f-alunos').addEventListener('input', revisar);
  form.addEventListener('submit', enviar);
  revisar();
}

// ── Trajeto ──────────────────────────────────────────────────
// O destino do pedido, com coordenada quando existe: o local da atividade
// do catálogo, ou o local escolhido. Destino digitado à mão não tem
// coordenada e não é localizado sozinho (spec D7).
function destinoEscolhido() {
  const locais = ctx.locais || [];
  if (modo === 'catalogo') {
    const a = (ctx.atividades || []).find(x => x.id === document.getElementById('f-ativ').value);
    return a?.local_id ? locais.find(l => l.id === a.local_id) || null : null;
  }
  return locais.find(l => l.id === document.getElementById('f-local').value) || null;
}

async function pintarTrajeto() {
  const box = document.getElementById('f-trajeto');
  if (!box) return;
  const escId = document.getElementById('f-esc').value;
  const escola = (ctx.unidades || []).find(u => (u.id || u.numero) === escId);
  const temDestino = modo === 'catalogo' ? !!document.getElementById('f-ativ').value
    : !!(document.getElementById('f-local').value || val('f-dest-nome'));
  if (!escola || !temDestino) { box.innerHTML = ''; trajeto = null; revisar(); return; }

  const meu = ++pedidoTrajeto;
  box.innerHTML = `<span class="sol-trajeto-txt">Calculando o tempo de viagem…</span>`;
  // A escola que pede é a única parada: o formulário cria uma viagem com
  // uma participação, e a Gerência acrescenta as outras depois.
  const r = await calcularTrajeto({
    participacoes: [{ unidade_id: escola.id || escola.numero, unidade: escola, status: 'ativa', ordem: 1 }],
    destino: destinoEscolhido(),
    velocidadeKmh: velocidadeOnibusKmh(), margemMin: margemParadaMin(),
  });
  if (meu !== pedidoTrajeto || !document.getElementById('f-trajeto')) return;
  trajeto = r;
  box.innerHTML = `<span class="sol-trajeto-txt ${r.status === 'ok' ? '' : 'fora'}">${esc(explicarTrajeto(r))}</span>`
    + (r.status === 'ok' ? `<span class="sol-trajeto-fonte">Distância: © OpenStreetMap</span>` : '');
  // O trajeto (trajeto_min) entra no cálculo do intervalo ocupado (D5) -
  // recalcula o saldo para refletir o horário real, não a janela típica.
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
  if (!data || !periodo || !alunos) { box.innerHTML = ''; btn.disabled = !!ctx.somenteLeitura; return; }

  const meu = ++pedidoSaldo;
  let linha;
  try { linha = await lerOcupacao(data); }
  catch (_) { box.innerHTML = ''; btn.disabled = !!ctx.somenteLeitura; return; }
  if (meu !== pedidoSaldo) return;   // resposta velha: descarta

  const emb = val('f-emb') || null, ret = val('f-ret') || null;
  // Com os dois horários, a conta é do INTERVALO do pedido (spec D5/D8).
  // Sem eles, o número da página Disponibilidade para o período.
  const iv = emb && ret ? intervaloDaViagem({
    periodo, embarque: emb, retorno: ret, trajetoMin: trajeto?.min, intervaloMin: linha.intervaloMin,
  }) : null;
  const livres = iv ? livresPara(linha, iv.ini, iv.fim, 'onibus') : livresNoPeriodo(linha, 0, periodo, 'onibus');
  const livresVan = iv ? livresPara(linha, iv.ini, iv.fim, 'vans') : livresNoPeriodo(linha, 0, periodo, 'vans');
  const totalDia = totalDoDia(linha, 0, 'onibus');
  const r = avaliar({ data, periodo, alunos, livres, livresVan, totalDia, emb, ret, linha, iv });

  const quando = iv ? `para embarque às ${esc(emb)}` : `no período`;
  const linhas = [
    totalDia ? `<div class="sol-saldo-num"><b>${Math.max(0, livres)}</b> ônibus livres ${quando} em ${esc(fmtData(data))}`
      + ` · este pedido usa <b>${r.onibus}</b></div>` : '',
    linha.aproximado ? '<div class="sol-aviso">Contagem sem horário: o banco ainda não tem a atualização desta versão.</div>' : '',
    ...r.erros.map(e => `<div class="sol-erro">${esc(e.texto)}</div>`),
    ...r.avisos.map(a => `<div class="sol-aviso">${esc(a.texto)}</div>`),
  ];
  // Quem aprova, num dia sem frota: o cadastro rápido ali mesmo (spec D4).
  if (ctx.aprovador && r.erros.some(e => e.codigo === 'sem_frota_dia')) linhas.push(await cadastroRapidoHtml(data));
  box.innerHTML = linhas.join('');
  ligarCadastroRapido(data, pintarSaldo);
  btn.disabled = r.erros.length > 0 || !!ctx.somenteLeitura;
}

function avaliar({ data, periodo, alunos, livres, livresVan, totalDia, emb, ret, linha, iv }) {
  const dias = Math.round((new Date(data + 'T00:00:00') - new Date(hojeISO() + 'T00:00:00')) / 86400000);
  const atividade = modo === 'catalogo'
    ? (ctx.atividades || []).find(x => x.id === document.getElementById('f-ativ').value) : null;
  const usaOnibus = atividade ? atividade.usa_onibus !== false : true;
  const precisa = usaOnibus ? Math.ceil(alunos / capacidadeOnibus()) : 0;
  return avaliarPedido({
    periodo, qtdAlunos: alunos, usaOnibus,
    qtdCadeirantes: parseInt(val('f-cadeira'), 10) || 0,
    livres, livresVan, totalDia,
    proximo: iv && precisa > livres ? proximoHorario(linha, { ini: iv.ini, fim: iv.fim, precisa, periodo }) : null,
    diasDeAntecedencia: dias,
    horarioEmbarque: emb, horarioRetorno: ret,
    capacidadeOnibus: capacidadeOnibus(), capacidadeVan: capacidadeVan(),
    antecedenciaMin: antecedenciaMinDias(),
    aprovador: !!ctx.aprovador,
  });
}

// ── Envio ────────────────────────────────────────────────────
async function enviar(e) {
  e.preventDefault();
  if (ctx.somenteLeitura) return;   // vendo como a escola: nada é gravado
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

  const unidadeId = isUuid(escId) ? escId : null;

  // O cabeçalho é a VIAGEM. `qtd_alunos` e `qtd_cadeirante` NÃO entram
  // aqui: são cache da soma das participações, mantido por gatilho no
  // banco (migration 037). Escrevê-los daqui seria disputar com ele.
  const viagem = {
    atividade_id: atividade ? atividade.id : null,
    atividade_livre: atividadeLivre,
    unidade_id: unidadeId,          // quem ABRIU o pedido, não quem é dono
    data, periodo,
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
    // O retrato do trajeto, se já foi calculado. Não calculado não barra
    // o envio (spec D6): a solicitação vai sem ele e quem aprova recalcula.
    // Antes da migration 039 essas chaves não casam com coluna nenhuma e o
    // banco as ignora ao montar a linha.
    ...(trajeto ? retratoTrajeto(trajeto) : {}),
  };

  // A escola que pede é a primeira participação. Uma viagem com várias
  // escolas é a Gerência acrescentando as outras depois - mesma estrutura.
  const participacao = {
    unidade_id: unidadeId,
    qtd_alunos: qtd,
    qtd_cadeirante: cadeira,
    horario: val('f-emb') || null,
  };

  const escola = (ctx.unidades || []).find(u => (u.id || u.numero) === escId)?.nome || '';
  const btn = document.getElementById('f-submit');
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    await criarSolicitacao(viagem, participacao);
    fecharModal();
    ctx.recarregar?.();
    toast({ titulo: 'Solicitação enviada', texto: escola, tipo: 'sucesso' });
  } catch (err) {
    // O banco recalcula os veículos e trava por data (migration 042): o
    // horário pode ter deixado de caber entre a última pintura do saldo e
    // o clique em Enviar - outra escola pode ter acabado de pegar a vaga.
    if (err.code === 'P0001' && String(err.message || '').startsWith('Sem onibus livres')) {
      falha(msg, 'Não há ônibus livres para este horário. Escolha outro horário ou outra data.');
      pintarSaldo();
    } else if (err.code === '23502') {
      falha(msg, 'Informe o horário de embarque e o de retorno.');
    } else {
      reportarErro(err, { msg, titulo: 'Não foi possível enviar' });
    }
    btn.disabled = false; btn.textContent = 'Enviar solicitação';
  }
}
