// ============================================================
// FundHub - sate/views/formulario.js
// O modal de nova solicitação. Substitui a aba "Nova solicitação"
// (spec 2026-09-08-sate-solicitacoes-design.md § D2, D3, D6) e depois
// simplificado (spec 2026-09-27-sate-solicitacao-simplificada, D2/D4/D8):
// sem catálogo de atividades, destino sempre por LOCAL (do cadastro ou
// digitado à mão), período CALCULADO pelos horários e um bloco próprio
// de responsável e acessibilidade.
// Revisto na spec 2026-10-02 (D13): escola por busca para quem aprova, local novo pela própria busca do campo Local.
//
// Os campos se agrupam por PERGUNTA - de onde, para onde, quando, quem
// vai - e não por tipo de campo. No modal largo os blocos deixam o
// formulário legível de relance; em tela estreita eles são as âncoras
// que dizem onde a pessoa está numa coluna longa.
// ============================================================
import { criarSolicitacao } from '../sate.model.js';
import {
  lerOcupacao, intervaloDaViagem, livresPara, totalDoDia, proximoHorario, livresNoPeriodo, trajetoParaVaga,
} from '../disponibilidade.model.js';
import { periodoDe, onibusPara, vansPara, avaliarPedido } from '../regras.model.js';
import { calcularTrajeto, retratoTrajeto, explicarTrajeto } from '../rota.model.js';
import {
  capacidadeOnibus, capacidadeVan, antecedenciaMinDias,
  velocidadeOnibusKmh, margemParadaMin, trajetoProvisorioMin,
} from '../sate.config.js';
import { getDiaCalendario, diaImpedeExtraclasse, motivoDoDia } from '../../calendario/calendario.model.js';
import { cadastroRapidoHtml, ligarCadastroRapido } from './frota-rapida.js';
import { destinoHtml, ligarDestino, lerDestino, validarDestino } from './formulario-destino.js';
import { quandoHtml, ligarQuando } from './formulario-quando.js';
import { responsavelHtml, ligarResponsavel, carregarEquipe } from './formulario-responsavel.js';
import { esc, val, falha, falhaNoCampo } from '../../../shared/dom.js';
import { hojeISO, addDias, fmtData, isUuid } from '../../../shared/format.js';
import { paraE164, formatarTelefone } from '../../../shared/ui/phones.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { modalHead, abrirModal, fecharModal } from '../../../shared/ui/modal.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

let ctx = null;
// Cada consulta de saldo recebe um número. Digitar "40" dispara duas
// mudanças, e sem isto a resposta da primeira pode chegar depois da
// segunda e pintar o saldo do número errado.
let pedidoSaldo = 0;
// O trajeto da escola escolhida até o destino escolhido. Vai para a
// solicitação como retrato no envio (spec 2026-09-13-sate-rota, D4). O
// contador evita que uma resposta velha (troca de escola duas vezes)
// pinte por cima da mais nova.
let trajeto = null;
let pedidoTrajeto = 0;
let deb = null;
// Escola por busca para quem aprova (são 144); null para a escola, que
// escolhe numa lista curta (spec 2026-10-02, D13). Destruído a cada
// abertura pelo mesmo motivo de `bs` em formulario-destino.js.
let buscaEscola = null;
const escolaId = () => (buscaEscola ? buscaEscola.valorAtual() : (document.getElementById('f-esc')?.value || ''));

export function abrirFormulario(contexto) {
  ctx = contexto;
  trajeto = null;
  const { perfil, unidades, aprovador } = ctx;
  const minData = aprovador ? hojeISO() : addDias(hojeISO(), antecedenciaMinDias());

  abrirModal(`
    ${modalHead(ico('onibus', { tam: 20 }) + 'Nova solicitação de ônibus')}
    <div class="modal-body">
      <form id="sol-form" class="esc-form">

        <fieldset class="form-grupo">
          <legend>Origem</legend>
          <div class="campos duas">
            ${aprovador
              ? '<div id="f-esc-busca" class="col-2"></div>'
              : `<label class="col-2">Escola <select id="f-esc" required>${opcoesEscola(unidades, perfil)}</select></label>`}
            <label>Turma(s) <input id="f-turmas" type="text" placeholder="Ex.: 5º A, 5º B" /></label>
            <label>Nº de estudantes <input id="f-alunos" type="number" inputmode="numeric" min="1" placeholder="0" required /></label>
          </div>
        </fieldset>

        ${destinoHtml()}

        ${quandoHtml(minData)}

        ${responsavelHtml()}

        <fieldset class="form-grupo">
          <legend>Acessibilidade</legend>
          <div class="campos duas">
            <label>Nº de cadeirantes <input id="f-cadeira" type="number" inputmode="numeric" min="0" value="0" /></label>
            <label>Nº de estudantes surdos <input id="f-surdo" type="number" inputmode="numeric" min="0" value="0" /></label>
            <label class="inline col-2"><input type="checkbox" id="f-nec" /> Outra necessidade específica (descreva nas observações)</label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Observações da escola</legend>
          <div class="campos">
            <textarea id="f-obs" rows="2" aria-label="Observações da escola" placeholder="Informações adicionais relevantes…"></textarea>
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

// A escola escolhe só entre as dela - antes a lista trazia a rede inteira e
// o banco recusava o pedido feito para outra unidade, com um erro que a
// pessoa não entendia. Se é uma só, já vem escolhida. Nome completo, como
// no cartão da escola (spec 2026-10-02, D13).
function opcoesEscola(unidades, perfil) {
  const minhas = perfil?.unidades || [];
  const lista = [...(unidades || [])]
    .filter(u => minhas.includes(u.id))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
  const unica = lista.length === 1;
  return (unica ? '' : '<option value="">Selecione…</option>')
    + lista.map(u => `<option value="${esc(u.id || u.numero)}" ${unica ? 'selected' : ''}>${esc(u.nome)}</option>`).join('');
}

function ligar() {
  const form = document.getElementById('sol-form');

  // A escola escolhida decide o trajeto e quem pode ser o responsável.
  const aoMudarEscola = () => { pintarTrajeto(); carregarEquipe(escolaId()); };

  ligarDestino(ctx.locais, () => { pintarTrajeto(); revisar(); });
  buscaEscola?.destruir();
  buscaEscola = null;
  if (ctx.aprovador) {
    const escolas = [...(ctx.unidades || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
    buscaEscola = criarBuscaSelecao(document.getElementById('f-esc-busca'), {
      rotulo: 'Escola',
      opcoes: escolas.map(u => ({ id: u.id || u.numero, rotulo: u.nome, detalhe: u.segmento || '', busca: u.apelido || '' })),
      placeholder: 'Digite para buscar a escola…',
      obrigatorio: true,
      onChange: aoMudarEscola,
    });
  } else {
    document.getElementById('f-esc').addEventListener('change', aoMudarEscola);
  }
  trajeto = null;

  for (const id of ['f-alunos', 'f-cadeira']) {
    document.getElementById(id).addEventListener('change', revisar);
  }
  document.getElementById('f-alunos').addEventListener('input', revisar);

  form.addEventListener('submit', enviar);
  ligarQuando(revisar, { aprovador: !!ctx.aprovador });
  ligarResponsavel();
  carregarEquipe(escolaId());   // escola única já vem escolhida
  revisar();
}

// ── Trajeto ──────────────────────────────────────────────────
// Destino digitado à mão não tem coordenada e não é localizado sozinho
// (spec D7) - só o local do cadastro entra no cálculo do trajeto.
async function pintarTrajeto() {
  const box = document.getElementById('f-trajeto');
  if (!box) return;
  const escId = escolaId();
  const escola = (ctx.unidades || []).find(u => (u.id || u.numero) === escId);
  const d = lerDestino();
  const temDestino = !!(d.localId || d.nome);
  if (!escola || !temDestino) { box.innerHTML = ''; trajeto = null; revisar(); return; }

  const meu = ++pedidoTrajeto;
  box.innerHTML = `<span class="sol-trajeto-txt">Calculando o tempo de viagem…</span>`;
  // A escola que pede é a única parada: o formulário cria uma viagem com
  // uma participação, e a Gerência acrescenta as outras depois.
  const r = await calcularTrajeto({
    participacoes: [{ unidade_id: escola.id || escola.numero, unidade: escola, status: 'ativa', ordem: 1 }],
    destino: d.local,
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
// Consulta o banco no máximo a cada 400 ms, e só quando data, período e
// nº de estudantes já foram informados - sem eles não há saldo a mostrar.
function revisar() {
  clearTimeout(deb);
  deb = setTimeout(pintarSaldo, 400);
}

async function pintarSaldo() {
  const box = document.getElementById('f-saldo');
  const btn = document.getElementById('f-submit');
  if (!box) return;   // o modal fechou enquanto o debounce corria

  const data = val('f-data');
  const periodo = periodoDe(val('f-emb'), val('f-ret'));
  const alunos = parseInt(val('f-alunos'), 10) || 0;
  if (!data || !periodo || !alunos) { box.innerHTML = ''; btn.disabled = !!ctx.somenteLeitura; return; }

  const meu = ++pedidoSaldo;
  let linha;
  try { linha = await lerOcupacao(data); }
  catch (_) { box.innerHTML = ''; btn.disabled = !!ctx.somenteLeitura; return; }
  if (meu !== pedidoSaldo) return;   // resposta velha: descarta

  const emb = val('f-emb') || null, ret = val('f-ret') || null;
  const trajetoMin = trajetoParaVaga({ trajeto_min: trajeto?.min ?? null, local_id: lerDestino().localId }, trajetoProvisorioMin());
  // Com os dois horários, a conta é do INTERVALO do pedido (spec D5/D8).
  // Sem eles, o número da página Disponibilidade para o período.
  const iv = emb && ret ? intervaloDaViagem({
    periodo, embarque: emb, retorno: ret, trajetoMin, intervaloMin: linha.intervaloMin,
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
  if (ctx.aprovador && r.erros.some(e => e.codigo === 'sem_frota_dia')) linhas.push(await cadastroRapidoHtml(data, periodo));
  // cadastroRapidoHtml() consultou o banco (getRotulos): outra pintura
  // pode ter começado e terminado nesse meio-tempo, ou o modal fechou.
  if (meu !== pedidoSaldo || !document.getElementById('f-saldo')) return;
  box.innerHTML = linhas.join('');
  ligarCadastroRapido(data, pintarSaldo);
  btn.disabled = r.erros.length > 0 || !!ctx.somenteLeitura;
}

function avaliar({ data, periodo, alunos, livres, livresVan, totalDia, emb, ret, linha, iv }) {
  const dias = Math.round((new Date(data + 'T00:00:00') - new Date(hojeISO() + 'T00:00:00')) / 86400000);
  const precisa = Math.ceil(alunos / capacidadeOnibus());
  return avaliarPedido({
    periodo, qtdAlunos: alunos, usaOnibus: true,
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
  const { aprovador } = ctx;
  // Todo erro aponta o CAMPO: marca, foco e rolagem até ele. A mensagem
  // sozinha no rodapé deixava a pessoa procurando num formulário longo.
  const form = e.currentTarget;
  form.querySelectorAll('[aria-invalid]').forEach(c => c.removeAttribute('aria-invalid'));
  const erro = (campo, txt) => falhaNoCampo(msg, campo, txt);

  const escId = escolaId();
  const data = val('f-data');
  const emb = val('f-emb'), ret = val('f-ret');
  const periodo = periodoDe(emb, ret);
  const qtd = parseInt(val('f-alunos'), 10);
  const cadeira = parseInt(val('f-cadeira'), 10) || 0;
  const surdo = parseInt(val('f-surdo'), 10) || 0;
  const d = lerDestino();

  if (!escId) return erro(aprovador ? '#f-esc-busca input' : '#f-esc', 'Escolha a escola.');
  if (!qtd) return erro('#f-alunos', 'Informe o nº de estudantes.');
  const erroDestino = validarDestino(d);
  if (erroDestino) return erro(erroDestino.campo, erroDestino.texto);
  if (!data) return erro('#f-dia', 'Informe a data da viagem.');
  if (!emb) return erro('#f-emb', 'Informe o horário de embarque.');
  if (!ret) return erro('#f-ret', 'Informe o horário de saída do evento.');
  if (periodo !== 'noite' && ret <= emb) return erro('#f-ret', 'A saída do evento precisa ser depois do embarque.');
  if (data < hojeISO()) return erro('#f-dia', 'A data não pode ser no passado.');
  if (!val('f-prof')) return erro('#f-prof', 'Informe o servidor(a) responsável.');
  if (!val('f-tel')) return erro('#f-tel', 'Informe o telefone do responsável.');

  // Bloqueios do calendário escolar. Quem aprova passa por cima.
  if (!aprovador) {
    try {
      const dia = await getDiaCalendario(data);
      if (diaImpedeExtraclasse(dia)) return erro('#f-dia', motivoDoDia(dia));
    } catch (_) { /* sem calendário carregado, segue */ }
  }

  const unidadeId = isUuid(escId) ? escId : null;

  // O cabeçalho é a VIAGEM. `qtd_alunos` NÃO entra aqui: é cache da soma
  // das participações, mantido por gatilho no banco (migration 037).
  // `qtd_cadeirante` também é cache, mas PRECISA ir: a coluna do cabeçalho
  // é NOT NULL (migration 005) e criar_viagem() monta a linha por
  // jsonb_populate_record, que põe NULO no que não veio - o DEFAULT não
  // vale, e o banco recusava com "campo obrigatório em branco". O valor é o
  // mesmo da participação, então o gatilho recalcula para o mesmo número.
  const viagem = {
    qtd_cadeirante: cadeira,
    unidade_id: unidadeId,          // quem ABRIU o pedido, não quem é dono
    data, periodo,                  // o banco recalcula (044); vai para o caso de a 044 não ter rodado
    qtd_onibus: onibusPara(qtd, capacidadeOnibus()),
    qtd_vans: vansPara(cadeira, capacidadeVan()),
    turmas: val('f-turmas') || null,
    local_id: d.localId,
    destino_nome: d.nome || null,
    destino_endereco: d.endereco || null,
    destino_numero: d.numero || null,
    destino_bairro: d.bairro || null,
    ...(d.cep ? { destino_cep: d.cep } : {}),
    horario_embarque: emb,
    horario_retorno: ret,
    professor_nome: val('f-prof'),
    professor_telefone: paraE164(val('f-tel')) || val('f-tel'),
    // Fallback que sobrevive sem a 044: antes dela, jsonb_populate_record
    // descarta professor_nome/professor_telefone em silêncio (colunas
    // novas), e contato_professor (coluna antiga) é o único que fica.
    contato_professor: `${val('f-prof')} · ${formatarTelefone(val('f-tel'))}`,
    observacao: val('f-obs') || null,
    // O retrato do trajeto, se já foi calculado. Não calculado não barra
    // o envio (spec D6): a solicitação vai sem ele e quem aprova recalcula.
    ...(trajeto ? retratoTrajeto(trajeto) : {}),
  };

  // A escola que pede é a primeira participação. Uma viagem com várias
  // escolas é a Gerência acrescentando as outras depois - mesma estrutura.
  const participacao = {
    unidade_id: unidadeId,
    qtd_alunos: qtd,
    qtd_cadeirante: cadeira,
    qtd_surdo: surdo,
    necessidade_especifica: document.getElementById('f-nec').checked,
    horario: emb,
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
      erro('#f-emb', 'Não há ônibus livres para este horário. Escolha outro horário ou outra data.');
      pintarSaldo();
    } else if (err.code === '23502' && String(err.message || '').startsWith('Informe o horario')) {
      erro(emb ? '#f-ret' : '#f-emb', 'Informe o horário de embarque e o de saída do evento.');
    } else if (err.code === '23502' && String(err.message || '').startsWith('Informe o professor')) {
      erro(val('f-prof') ? '#f-tel' : '#f-prof', 'Informe o servidor(a) responsável e o telefone.');
    } else if (err.code === '23502' && String(err.message || '').startsWith('Informe nome, endereco')) {
      erro('#f-local input', 'Informe nome, endereço, número e bairro do local.');
    } else if (err.code === '23503' && String(err.message || '').startsWith('Local nao encontrado')) {
      erro('#f-local input', 'O local escolhido não foi encontrado. Atualize a página e tente de novo.');
    } else if (err.code === '23514' && periodo === 'integral') {
      // CHECK de período sem a migration 044: o banco ainda não aceita 'integral'.
      falha(msg, 'O banco ainda não aceita pedidos de manhã e tarde. Avise a Gerência.');
    } else {
      reportarErro(err, { msg, titulo: 'Não foi possível enviar' });
    }
    btn.disabled = false; btn.textContent = 'Enviar solicitação';
  }
}
