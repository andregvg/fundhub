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
import { acrescentar } from '../participacoes.model.js';
import { periodoDe, onibusPara, vansPara } from '../regras.model.js';
import { calcularTrajeto, retratoTrajeto } from '../rota.model.js';
import { capacidadeOnibus, capacidadeVan, antecedenciaMinDias, velocidadeOnibusKmh, margemParadaMin } from '../sate.config.js';
import { getDiaCalendario, diaImpedeExtraclasse, motivoDoDia } from '../../calendario/calendario.model.js';
import { destinoHtml, ligarDestino, lerDestino, validarDestino } from './formulario-destino.js';
import { quandoHtml, ligarQuando } from './formulario-quando.js';
import { responsavelHtml, ligarResponsavel, carregarEquipe } from './formulario-responsavel.js';
import { resumoHtml, ligarResumo, revisar, repintarResumo } from './formulario-resumo.js';
import { paradasHtml, ligarParadas, aoMudarPrincipal, lerParadas, validarParadas, destruirParadas } from './formulario-paradas.js';
import { esc, val, falha, falhaNoCampo } from '../../../shared/dom.js';
import { hojeISO, addDias, isUuid } from '../../../shared/format.js';
import { paraE164, formatarTelefone } from '../../../shared/ui/phones.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { modalHead, abrirModal, fecharModal } from '../../../shared/ui/modal.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

let ctx = null;
// O trajeto da escola escolhida até o destino escolhido. Vai para a
// solicitação como retrato no envio (spec 2026-09-13-sate-rota, D4). O
// contador evita que uma resposta velha (troca de escola duas vezes)
// pinte por cima da mais nova.
let trajeto = null;
let pedidoTrajeto = 0;
// Com que escolas e destino o `trajeto` foi (ou está sendo) calculado. Quem
// sabe é o próprio cálculo: assim nenhum caminho que mexe nas paradas
// precisa lembrar de atualizar uma cópia (a principal que troca com uma
// parada, por exemplo).
let assinaturaTrajeto = '';
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
    ${modalHead(ico('onibus', { tam: 20 }) + 'Nova solicitação')}
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
            ${aprovador ? paradasHtml() : ''}
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

        ${resumoHtml()}
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
  pedidoTrajeto++;   // resposta de trajeto ainda em voo da abertura anterior não pinta neste modal
  destruirParadas();
  ligarResumo({ ctx, ler: lerParaResumo });

  // A escola escolhida decide o trajeto e quem pode ser o responsável; sai
  // das outras paradas, se estava lá.
  const aoMudarEscola = () => {
    if (ctx.aprovador) {
      const tirada = aoMudarPrincipal();
      if (tirada) toast({ titulo: 'Parada retirada', texto: `${tirada} passou a ser a escola principal.`, tipo: 'info' });
    }
    pintarTrajeto();
    carregarEquipe(escolaId());
  };

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
  assinaturaTrajeto = '';
  if (ctx.aprovador) {
    // Digitar estudantes/horário numa parada não muda a rota: pintarTrajeto
    // reconhece que o conjunto é o mesmo e não consulta de novo.
    ligarParadas({
      unidades: ctx.unidades, principal: escolaId,
      aoMudar: () => { pintarTrajeto(); revisar(); },
    });
  }

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

// Tudo o que o resumo precisa saber do que foi digitado - a soma dos
// estudantes e dos cadeirantes inclui as outras paradas (spec D6).
function lerParaResumo() {
  const extras = ctx.aprovador ? lerParadas() : [];
  // O ônibus sai para a PRIMEIRA parada: o embarque é o mais cedo entre o da
  // escola principal e os das outras paradas que têm horário (o critério do
  // banco e da ficha). "HH:MM" compara como texto.
  const emb = [val('f-emb'), ...extras.map(p => p.horario)].filter(Boolean).sort()[0] || null;
  return {
    data: val('f-data'), emb, ret: val('f-ret') || null,
    alunos: (parseInt(val('f-alunos'), 10) || 0) + extras.reduce((n, p) => n + p.qtdAlunos, 0),
    cadeirantes: (parseInt(val('f-cadeira'), 10) || 0) + extras.reduce((n, p) => n + p.qtdCadeirante, 0),
    trajeto, localId: lerDestino().localId,
  };
}

// ── Trajeto ──────────────────────────────────────────────────
// Destino digitado à mão não tem coordenada e não é localizado sozinho
// (spec D7) - só o local do cadastro entra no cálculo do trajeto. O texto
// do tempo de viagem é pintado pelo resumo; aqui só se calcula.
async function pintarTrajeto() {
  const escId = escolaId();
  const escola = (ctx.unidades || []).find(u => (u.id || u.numero) === escId);
  const d = lerDestino();
  const temDestino = !!(d.localId || d.nome);
  if (!escola || !temDestino) { ++pedidoTrajeto; assinaturaTrajeto = ''; trajeto = null; revisar(); return; }

  // Principal, extras na ordem e destino: o que decide a rota. Se é o mesmo
  // com que já se calculou (ou se calcula), não há o que refazer.
  const extras = ctx.aprovador ? lerParadas() : [];
  const assinatura = [escId, ...extras.map(p => p.unidadeId), d.localId || d.nome].join('|');
  if (assinatura === assinaturaTrajeto) return;
  assinaturaTrajeto = assinatura;

  const meu = ++pedidoTrajeto;
  trajeto = null;   // enquanto calcula, o resumo não mostra o tempo velho
  // A escola que pede é a primeira parada; quem aprova pode ter acrescentado
  // outras no próprio formulário (spec D6), na ordem em que aparecem.
  let r;
  try {
    r = await calcularTrajeto({
      participacoes: [
        { unidade_id: escola.id || escola.numero, unidade: escola, status: 'ativa', ordem: 1 },
        ...extras.map((p, i) => ({ unidade_id: p.unidadeId, unidade: p.unidade, status: 'ativa', ordem: i + 2 })),
      ],
      destino: d.local,
      velocidadeKmh: velocidadeOnibusKmh(), margemMin: margemParadaMin(),
    });
  } catch (_) {
    if (meu === pedidoTrajeto) { assinaturaTrajeto = ''; revisar(); }   // falhou: o resumo repinta sem o trajeto; a próxima mudança tenta de novo
    return;
  }
  if (meu !== pedidoTrajeto || !document.getElementById('f-resumo')) return;
  trajeto = r;
  // O trajeto (trajeto_min) entra no cálculo do intervalo ocupado (D5) -
  // recalcula o saldo para refletir o horário real, não a janela típica.
  revisar();
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
  const extras = aprovador ? lerParadas() : [];
  const erroParada = aprovador ? validarParadas() : null;
  if (erroParada) return erro(erroParada.campo, erroParada.texto);
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
  // Os veículos saem do TOTAL da viagem, com as outras paradas (spec D6).
  const totalAlunos = qtd + extras.reduce((n, p) => n + p.qtdAlunos, 0);
  const totalCadeira = cadeira + extras.reduce((n, p) => n + p.qtdCadeirante, 0);
  const viagem = {
    qtd_cadeirante: cadeira,
    unidade_id: unidadeId,          // quem ABRIU o pedido, não quem é dono
    data, periodo,                  // o banco recalcula (044); vai para o caso de a 044 não ter rodado
    qtd_onibus: onibusPara(totalAlunos, capacidadeOnibus()),
    qtd_vans: vansPara(totalCadeira, capacidadeVan()),
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
    const criada = await criarSolicitacao(viagem, participacao);
    // As outras paradas entram em seguida (spec D6). Se alguma falhar, a
    // viagem EXISTE: avisa qual não entrou, para acrescentar pela solicitação.
    const naoEntraram = [];
    for (const p of extras) {
      try {
        await acrescentar(criada.id, { unidadeId: p.unidadeId, qtdAlunos: p.qtdAlunos, qtdCadeirante: p.qtdCadeirante, horario: p.horario });
      } catch (err) {
        console.warn('[sate] parada não acrescentada:', err?.message || err);
        naoEntraram.push(p.unidade?.nome || 'uma escola');
      }
    }
    fecharModal();
    ctx.recarregar?.();
    if (naoEntraram.length) {
      toast({ titulo: 'Solicitação enviada, mas falta acrescentar', tipo: 'atencao',
        texto: `${naoEntraram.join(', ')} não entrou na viagem. Abra a solicitação e use "Acrescentar parada".` });
    } else {
      toast({ titulo: 'Solicitação enviada', texto: escola, tipo: 'sucesso' });
    }
  } catch (err) {
    // O banco recalcula os veículos e trava por data (migration 042): o
    // horário pode ter deixado de caber entre a última pintura do saldo e
    // o clique em Enviar - outra escola pode ter acabado de pegar a vaga.
    if (err.code === 'P0001' && String(err.message || '').startsWith('Sem onibus livres')) {
      erro('#f-emb', 'Não há ônibus livres para este horário. Escolha outro horário ou outra data.');
      repintarResumo();
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
