// ============================================================
// FundHub — sate/views/nova.js  (aba Nova solicitação)
// Dois modos: atividade do CATÁLOGO (gerida pela SME) ou atividade
// LIVRE (organizada pela escola, com destino informado à mão).
// Validações: data no passado, antecedência mínima (só p/ escola),
// mínimo de participantes da atividade e bloqueios do calendário.
// ============================================================
import {
  criarSolicitacao, onibusPara, CAP_ONIBUS, ANTECEDENCIA_MIN,
} from '../sate.model.js';
import { getDiaCalendario } from '../../calendario/calendario.model.js';
import { esc, val, falha } from '../../../shared/dom.js';
import { hojeISO, addDias, fmtData, isUuid } from '../../../shared/format.js';

let modo = 'catalogo';   // 'catalogo' | 'livre'
let ctx = null;

export function render(contexto) {
  ctx = contexto;
  const { perfil, atividades, unidades } = ctx;
  const minData = perfil?.isAdmin ? hojeISO() : addDias(hojeISO(), ANTECEDENCIA_MIN);

  const optsAtiv = atividades.map(a => `<option value="${a.id}">${esc(a.nome)}</option>`).join('');
  const optsEsc = [...unidades].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    .map(u => `<option value="${u.id || u.numero}">${esc(u.apelido || u.nome)}</option>`).join('');
  const optsLocais = (ctx.locais || []).filter(l => l.ativo)
    .map(l => `<option value="${l.id}">${esc(l.nome)}</option>`).join('');

  ctx.box().innerHTML = `
    <form id="nova-form" class="sate-form">
      <div class="modo-toggle">
        <label class="inline"><input type="radio" name="modo" value="catalogo" ${modo === 'catalogo' ? 'checked' : ''}/> Atividade do catálogo</label>
        <label class="inline"><input type="radio" name="modo" value="livre" ${modo === 'livre' ? 'checked' : ''}/> Outra atividade (organizada pela escola)</label>
      </div>
      <div class="form-grid">
        <label class="m-catalogo col-2">Atividade
          <select id="f-ativ"><option value="">Selecione…</option>${optsAtiv}</select></label>
        <label class="m-livre col-2">Nome da atividade / evento
          <input id="f-ativ-livre" type="text" placeholder="Ex.: Visita ao Teatro Pedro II" /></label>
        <label class="m-livre col-2">Destino
          <select id="f-local">
            <option value="">— outro destino (digitar abaixo) —</option>
            ${optsLocais}
          </select></label>
        <label class="m-livre">Destino (local)
          <input id="f-dest-nome" type="text" placeholder="Ex.: Teatro Pedro II" /></label>
        <label class="m-livre">Endereço do destino
          <input id="f-dest-end" type="text" placeholder="Rua, nº - bairro" /></label>

        <label class="col-2">Escola
          <select id="f-esc" required><option value="">Selecione…</option>${optsEsc}</select></label>
        <label>Data
          <input id="f-data" type="date" min="${minData}" required /></label>
        <label>Período
          <select id="f-per" required>
            <option value="">Selecione…</option>
            <option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option>
          </select></label>
        <label>Turma(s)
          <input id="f-turmas" type="text" placeholder="Ex.: 5º A, 5º B" /></label>
        <label>Nº de alunos
          <input id="f-alunos" type="number" inputmode="numeric" min="1" required /></label>
        <label>Nº de cadeirantes (transporte adaptado)
          <input id="f-cadeira" type="number" inputmode="numeric" min="0" value="0" /></label>
        <label>Horário de embarque
          <input id="f-emb" type="time" /></label>
        <label>Horário de retorno
          <input id="f-ret" type="time" /></label>
        <label class="col-2">Contato do professor(a)
          <input id="f-contato" type="text" placeholder="Nome e telefone" /></label>
        <label class="col-2">Observação
          <textarea id="f-obs" rows="2"></textarea></label>
      </div>
      <div class="form-foot">
        <span id="f-hint" class="form-hint"></span>
        <button type="submit" id="f-submit">Enviar solicitação</button>
      </div>
      <p id="f-msg" class="auth-msg"></p>
    </form>`;

  const form = document.getElementById('nova-form');
  const aplicarModo = () => form.classList.toggle('is-livre', modo === 'livre');
  form.querySelectorAll('input[name="modo"]').forEach(r =>
    r.addEventListener('change', () => { modo = r.value; aplicarModo(); dica(); }));
  aplicarModo();

  // Ao escolher um local do catálogo, os campos de texto do destino somem
  // (o local já traz nome/endereço). "Outro destino" reabre os campos.
  const localSel = document.getElementById('f-local');
  const toggleDestinoLivre = () => {
    const usaCatalogo = !!localSel.value;
    ['f-dest-nome', 'f-dest-end'].forEach(id => {
      document.getElementById(id).closest('label').style.display = usaCatalogo ? 'none' : '';
    });
  };
  localSel.addEventListener('change', toggleDestinoLivre);
  toggleDestinoLivre();

  document.getElementById('f-ativ').addEventListener('change', dica);
  document.getElementById('f-alunos').addEventListener('input', dica);
  form.addEventListener('submit', enviar);
}

// Estimativa de ônibus enquanto o usuário digita.
function dica() {
  const hint = document.getElementById('f-hint');
  const n = parseInt(document.getElementById('f-alunos').value, 10);
  if (!(n > 0)) { hint.textContent = ''; return; }
  let usaOnibus = true;
  if (modo === 'catalogo') {
    const a = ctx.atividades.find(x => x.id === document.getElementById('f-ativ').value);
    usaOnibus = a ? a.usa_onibus : true;
  }
  hint.textContent = usaOnibus
    ? `≈ ${onibusPara(n)} ônibus (${CAP_ONIBUS} lugares)`
    : 'Sem ônibus';
}

async function enviar(e) {
  e.preventDefault();
  const msg = document.getElementById('f-msg'); msg.className = 'auth-msg';
  const { perfil, atividades } = ctx;

  const escId = document.getElementById('f-esc').value;
  const data = document.getElementById('f-data').value;
  const periodo = document.getElementById('f-per').value;
  const qtd = parseInt(document.getElementById('f-alunos').value, 10);
  const cadeira = parseInt(document.getElementById('f-cadeira').value, 10) || 0;

  let atividade = null, atividadeLivre = null, usaOnibus = true;
  // Destino: id do catálogo de locais (quando escolhido) + snapshot de
  // nome/endereço para a Programação de Viagens não depender de join.
  let localId = null, destinoNome = null, destinoEnd = null;
  if (modo === 'catalogo') {
    atividade = atividades.find(x => x.id === document.getElementById('f-ativ').value);
    if (!atividade) return falha(msg, 'Selecione uma atividade do catálogo (ou use “Outra atividade”).');
    usaOnibus = atividade.usa_onibus;
    localId = atividade.local_id || null;   // a atividade já carrega o destino
  } else {
    atividadeLivre = val('f-ativ-livre');
    if (!atividadeLivre) return falha(msg, 'Informe o nome da atividade organizada pela escola.');
    const local = (ctx.locais || []).find(l => l.id === document.getElementById('f-local').value);
    if (local) {
      localId = local.id; destinoNome = local.nome; destinoEnd = local.endereco || null;
    } else {
      destinoNome = val('f-dest-nome') || null; destinoEnd = val('f-dest-end') || null;
    }
  }

  if (!escId || !data || !periodo || !qtd) {
    return falha(msg, 'Preencha escola, data, período e nº de alunos.');
  }
  if (data < hojeISO()) return falha(msg, 'A data não pode ser no passado.');
  if (!perfil?.isAdmin && data < addDias(hojeISO(), ANTECEDENCIA_MIN)) {
    return falha(msg, `A escola deve solicitar com no mínimo ${ANTECEDENCIA_MIN} dias de antecedência.`);
  }
  if (atividade?.min_participantes && qtd < atividade.min_participantes) {
    return falha(msg, `Esta atividade exige no mínimo ${atividade.min_participantes} participantes.`);
  }

  // Bloqueios do calendário escolar (o admin pode passar por cima).
  if (!perfil?.isAdmin) {
    try {
      const dia = await getDiaCalendario(data);
      if (dia?.bloqueia_extraclasse) {
        return falha(msg, `Data bloqueada para extraclasse${dia.evento ? ` (${dia.evento})` : ''}.`);
      }
      if (dia && dia.letivo === false) {
        return falha(msg, `${fmtData(data)} não é dia letivo${dia.evento ? ` (${dia.evento})` : ''}.`);
      }
    } catch (_) { /* sem calendário carregado, segue */ }
  }

  const payload = {
    atividade_id: atividade ? atividade.id : null,
    atividade_livre: atividadeLivre,
    unidade_id: isUuid(escId) ? escId : null,
    data, periodo,
    qtd_alunos: qtd,
    qtd_cadeirante: cadeira,
    qtd_onibus: usaOnibus ? onibusPara(qtd) : 0,
    turmas: val('f-turmas') || null,
    local_id: localId,
    destino_nome: destinoNome,
    destino_endereco: destinoEnd,
    horario_embarque: val('f-emb') || null,
    horario_retorno: val('f-ret') || null,
    contato_professor: val('f-contato') || null,
    observacao: val('f-obs') || null,
  };

  const btn = document.getElementById('f-submit'); btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    await criarSolicitacao(payload);
    ctx.irPara('solicitacoes');
  } catch (err) {
    falha(msg, 'Não foi possível enviar: ' + (err.message || err));
    btn.disabled = false; btn.textContent = 'Enviar solicitação';
  }
}
