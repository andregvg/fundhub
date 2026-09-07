// ============================================================
// FundHub - horarios/views/jornada.js
// A semana inteira de UM servidor em UMA escola, numa gaveta só.
// Antes era um formulário de um bloco por vez, e montar a jornada de
// um gestor do zero custava cinco aberturas e dez cliques.
//
// Os campos de hora nascem VAZIOS. Antes vinham com 07:00/13:00
// chumbados, o que induzia a pessoa a aceitar um horário que não era
// o dela - pior que campo vazio, porque parece uma resposta.
//
// Sobreposição impede o salvamento; carga acima de 8h e mais de 6h
// contínuas ficam marcados e deixam salvar. Ver .claude/rules/dados.md.
// ============================================================
import { DIAS, criarBloco, atualizarBloco, excluirBloco,
  validarDia, totalDoDia, duracao, temVarianteNoBanco } from '../horarios.model.js';
import { rotulaEscala, variantesDe, varDe } from '../escalas.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';
import { drawerHead, abrirDrawer, fecharDrawer } from '../../../shared/ui/drawer.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

const hhmm = (t) => String(t ?? '').slice(0, 5);
// estado.porEscala = { [escala]: { [variante]: { [dia_semana]: linhas[] } } }
// A semana inteira de TODAS as escalas e variantes, carregada de uma vez.
// estado.escala/estado.variante são só QUAL ABA está visível: trocar de
// aba nunca descarta o que foi digitado nas outras - ver salvar().
let estado = null;   // { servidor, unidadeId, escala, variante, porEscala, recarregar, escalasEmUso, catalogoEscalas }

// Uma linha é { id?, inicio, fim, obs, conduz?, excluir? }. `id` ausente = nova.
export function abrirJornada({ servidor, unidadeId, blocos, recarregar, escalasEmUso = ['normal'], catalogoEscalas = [], escalaInicial = 'normal' }) {
  // Além das escalas em uso na rede hoje, inclui qualquer escala que já
  // esteja gravada nos blocos deste servidor - uma escala que caiu em
  // desuso (virada de ano, catálogo mudou) não pode ficar inalcançável
  // pela tela só porque a rede não a usa mais no calendário atual (achado
  // da revisão da Task 4, rodada 1).
  const chaves = [...new Set([...escalasEmUso, ...blocos.map(b => b.escala || 'normal')])];
  const meus = blocos.filter(b => b.servidor_id === servidor.id);
  const porEscala = {};
  for (const chaveEsc of chaves) {
    porEscala[chaveEsc] = {};
    // As variantes desta escala em QUALQUER dia, dentro da lista `blocos`
    // que a gaveta recebeu: a unidade inteira quando ela é aberta pela aba
    // "Por escola" (aí uma variante criada por outro gestor aparece aqui,
    // e a configuração não fica pela metade) e só os blocos deste servidor
    // quando ela é aberta pela aba "Por servidor".
    const vs = [...new Set(DIAS.flatMap(d => variantesDe(blocos, chaveEsc, d.n)))].sort((a, b) => a - b);
    for (const v of vs) {
      porEscala[chaveEsc][v] = {};
      for (const d of DIAS) {
        porEscala[chaveEsc][v][d.n] = meus
          .filter(b => b.dia_semana === d.n && (b.escala || 'normal') === chaveEsc && varDe(b) === v)
          .map(b => ({ id: b.id, inicio: hhmm(b.inicio), fim: hhmm(b.fim), obs: b.obs || '', conduz: Boolean(b.conduz) }));
      }
    }
  }
  // { [escala]: dia_semana } - uma escala com dia fixo mostra só aquele dia.
  const diasFixos = Object.fromEntries((catalogoEscalas || []).map(e => [e.chave, e.dia_semana ?? null]));

  estado = {
    servidor, unidadeId,
    escala: chaves.includes(escalaInicial) ? escalaInicial : 'normal',
    variante: 1,
    porEscala, recarregar, escalasEmUso: chaves, catalogoEscalas, diasFixos,
  };

  const abas = chaves.length > 1 ? `
    <div class="tabbar hj-escalas" role="tablist">
      ${chaves.map(e => `<button type="button" class="tab ${e === estado.escala ? 'on' : ''}"
        role="tab" aria-selected="${e === estado.escala}" data-escala="${esc(e)}">${esc(rotulaEscala(e, catalogoEscalas))}</button>`).join('')}
    </div>
    <p class="form-hint" id="hj-dica"></p>` : '';

  abrirDrawer(`
    ${drawerHead('Jornada da semana', esc(servidor.nome))}
    <div class="drawer-body">
      <form id="hj-form" class="esc-form">
        ${abas}
        <div id="hj-variantes"></div>
        <div id="hj-dias"></div>
        <div class="form-foot">
          <span id="hj-msg" class="auth-msg"></span>
          <button type="submit" id="hj-save" class="btn-primary">Salvar jornada</button>
        </div>
      </form>
    </div>`);

  pintarDica();
  pintarVariantes();
  pintar();
  // Ligados uma vez só, aqui - o `<form>` é recriado a cada abertura da
  // gaveta, então não acumula. Ligar dentro de `pintar()` (que o próprio
  // handler chama de novo) dobrava o listener a cada campo confirmado:
  // 1, 2, 4, 8... por volta do 14º a gaveta travava em repintes síncronos
  // empilhados (achado da rodada de correção 1).
  document.getElementById('hj-dias').addEventListener('change', aoMudarCampo);
  document.getElementById('hj-form').addEventListener('submit', salvar);
  // Abas ligadas uma vez, sobre o container estável do form - trocar de
  // aba só troca qual `estado.escala`/`#hj-dica` está ativo, nunca religa
  // este listener (mesmo raciocínio do resto do arquivo).
  document.querySelector('.hj-escalas')?.addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (!b) return;
    estado.escala = b.dataset.escala;
    // A variante ativa pode não existir na escala nova.
    if (!estado.porEscala[estado.escala][estado.variante]) estado.variante = 1;
    document.querySelectorAll('.hj-escalas .tab').forEach(t => {
      const on = t.dataset.escala === estado.escala;
      t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on));
    });
    pintarDica();
    pintarVariantes();
    pintar();
  });

  // Mesmo padrão das abas de escala: ligado uma vez, sobre o container
  // estável do form. Trocar de variante só troca `estado.variante`.
  document.getElementById('hj-variantes').addEventListener('click', async (e) => {
    if (e.target.closest('#hj-var-excluir')) { await excluirVariante(); return; }
    const nova = e.target.closest('#hj-var-nova');
    if (nova) {
      // O próximo número sai de TODAS as chaves, não só das visíveis: uma
      // variante marcada para exclusão ainda existe no banco até salvar,
      // e reaproveitar o número dela misturaria as duas.
      const vs = Object.keys(estado.porEscala[estado.escala]).map(Number);
      const proxima = Math.max(...vs) + 1;
      estado.porEscala[estado.escala][proxima] = Object.fromEntries(DIAS.map(d => [d.n, []]));
      estado.variante = proxima;
      pintarVariantes(); pintar();
      return;
    }
    const b = e.target.closest('[data-variante]'); if (!b) return;
    estado.variante = Number(b.dataset.variante);
    pintarVariantes(); pintar();
  });

  document.getElementById('hj-variantes').addEventListener('change', (e) => {
    if (e.target.id !== 'hj-conduz') return;
    // Marca as linhas DESTE servidor nesta escala e variante. É o que a
    // grade lê para rotular a sub-linha com o nome de quem conduz.
    const marcado = e.target.checked;
    for (const d of DIAS) {
      for (const l of estado.porEscala[estado.escala][estado.variante][d.n]) l.conduz = marcado;
    }
  });
}

// Só faz sentido "copiar para todos os dias" quando a escala tem 5
// dias. Uma escala com dia da semana fixo tem um dia só.
function podeCopiar() {
  return !estado.diasFixos?.[estado.escala];
}

// Blocos gravados em outros dias de uma escala que passou a ter dia
// fixo. Não são apagados em silêncio (D5) - a tela avisa e oferece
// remover.
function orfaos() {
  const fixo = estado.diasFixos?.[estado.escala];
  if (!fixo) return [];
  const dias = estado.porEscala[estado.escala][estado.variante];
  return DIAS.filter(d => d.n !== fixo)
    .flatMap(d => dias[d.n].filter(l => !l.excluir && l.id).map(l => ({ dia: d, linha: l })));
}

function orfaosHtml() {
  const o = orfaos();
  if (!o.length) return '';
  return `<div class="hj-orfaos">
    <p class="hj-prob n-aviso">${ico('atencao', { tam: 14 })}
      ${o.length} bloco(s) desta escala em dias diferentes de
      ${esc(DIAS.find(d => d.n === estado.diasFixos[estado.escala]).nome.toLowerCase())} -
      não valem mais e não aparecem abaixo.</p>
    <button type="button" class="mini-btn no" id="hj-limpar-orfaos">${ico('excluir', { tam: 14 })} Remover esses blocos</button>
  </div>`;
}

// Os dias que a aba atual mostra: uma escala com dia da semana fixo
// mostra só aquele dia (não faz sentido preencher a segunda de uma
// escala que só acontece às quartas); as demais mostram seg–sex.
function diasVisiveis() {
  const fixo = estado.diasFixos?.[estado.escala];
  return fixo ? DIAS.filter(d => d.n === fixo) : DIAS;
}

function pintarDica() {
  const dica = document.getElementById('hj-dica');
  if (!dica) return;
  if (estado.escala === 'normal') { dica.textContent = ''; return; }
  const fixo = estado.diasFixos?.[estado.escala];
  dica.textContent = fixo
    ? `Deixe em branco para seguir a jornada Normal desta ${DIAS.find(d => d.n === fixo).nome.toLowerCase()}.`
    : 'Deixe um dia em branco aqui para ele seguir a jornada Normal nesta escala. Só preencha os dias que mudam.';
}

// As variantes que a barra de abas MOSTRA: a 1 sempre (é o degrau final
// do fallback de D4 e não pode ser excluída), a ativa sempre (uma
// variante recém-criada ainda está vazia e precisa aparecer para ser
// preenchida) e as demais enquanto tiverem alguma linha viva. Uma
// variante excluída continua no estado, com as linhas marcadas, até o
// "Salvar jornada" apagá-las no banco: ela sai da barra de abas, nunca
// da lista de gravação.
function variantesVisiveis() {
  const dias = estado.porEscala[estado.escala];
  return Object.keys(dias).map(Number).sort((a, b) => a - b)
    .filter(v => v === 1 || v === estado.variante
      || DIAS.some(d => dias[v][d.n].some(l => !l.excluir)));
}

// O estado do interruptor "conduzo o TDC nesta variante" como a pessoa
// o vê agora. Lido do DOM porque uma variante sem nenhuma linha ainda
// não tem onde guardar essa marca - é o que faz um bloco acrescentado
// DEPOIS de marcar a caixa nascer com `conduz` certo.
const conduzMarcado = () => Boolean(document.getElementById('hj-conduz')?.checked);

// A segunda barra de abas: as variantes da escala ativa. As abas só
// aparecem com mais de uma; o "+" aparece mesmo numa escola sem
// revezamento, senão ela nunca teria como criar a segunda configuração
// (um botão a mais é melhor que a capacidade perdida). Fica fora do
// role="tablist", porque só aba é filha de tablist. A caixa "conduzo o
// TDC" só aparece fora da normal, e a lixeira só fora da variante 1.
//
// Enquanto a migration 030 não roda, o banco não tem onde guardar nem a
// variante nem o "conduzo": o "+", a lixeira e a caixa somem e a dica
// explica. Esconder o "+" é o que de fato evita o estrago - sem isso a
// pessoa monta uma segunda configuração inteira, lê "Jornada salva" e
// tudo cai empilhado na primeira.
function pintarVariantes() {
  const box = document.getElementById('hj-variantes');
  if (!box) return;
  const disponivel = temVarianteNoBanco();
  const vs = variantesVisiveis();
  const abas = vs.length > 1 ? `
    <div class="tabbar hj-variantes-bar" role="tablist">
      ${vs.map(v => `<button type="button" class="tab ${v === estado.variante ? 'on' : ''}"
        role="tab" aria-selected="${v === estado.variante}" data-variante="${v}">Variante ${v}</button>`).join('')}
    </div>` : '';
  const acoes = disponivel ? `
      <button type="button" class="mini-btn" id="hj-var-nova"
        aria-label="Criar uma variante">${ico('adicionar', { tam: 13 })}</button>
      ${estado.variante !== 1 ? `<button type="button" class="mini-btn no" id="hj-var-excluir"
        aria-label="Excluir a variante ${estado.variante}">${ico('excluir', { tam: 13 })}</button>` : ''}` : '';
  const conduzAqui = DIAS.some(d =>
    estado.porEscala[estado.escala][estado.variante][d.n].some(l => !l.excluir && l.conduz));
  const conduz = (estado.escala === 'normal' || !disponivel) ? '' : `
    <label class="switch hj-conduz">
      <input type="checkbox" id="hj-conduz" ${conduzAqui ? 'checked' : ''} />
      <span class="switch-trilho" aria-hidden="true"></span>
      <span class="switch-txt">conduzo o TDC nesta variante</span>
    </label>`;
  const semRecurso = disponivel ? '' : `
    <p class="form-hint">Ainda não dá para registrar mais de uma configuração do
      mesmo dia, nem quem conduz o TDC: este sistema ainda não foi atualizado.
      Cada dia continua com uma configuração só.</p>`;
  const topo = (abas || acoes) ? `<div class="hj-variantes-topo">${abas}${acoes}</div>` : '';
  box.innerHTML = `${topo}${conduz}${semRecurso}`;
}

// Excluir a variante ativa: as linhas DESTE servidor nesta escala e
// variante saem, e nada mais (D7 - a gaveta nunca escreve sobre dado de
// outra pessoa; `estado.porEscala` só foi montado com os blocos dele).
// A variante some da grade quando o último servidor deixa de ter bloco
// nela - por isso aqui não se apaga nada de ninguém.
//
// Mesmo padrão do `.hj-del` de um bloco: linha já gravada é MARCADA
// (o banco só muda no "Salvar jornada"), linha nunca gravada some.
// A variante 1 não tem lixeira: é o degrau final do fallback de D4.
async function excluirVariante() {
  const v = estado.variante;
  if (v === 1) return;
  const dias = estado.porEscala[estado.escala][v];
  const vivas = DIAS.some(d => dias[d.n].some(l => !l.excluir));
  // Variante vazia não pede confirmação: não há o que perder.
  if (vivas && !(await confirmar(`Excluir a variante ${v}?`, {
    detalhe: `Os horários de ${estado.servidor.nome} nesta variante serão removidos ao salvar. O horário das outras pessoas não muda.`,
    textoOk: 'Excluir', perigo: true,
  }))) return;

  for (const d of DIAS) {
    dias[d.n] = dias[d.n].filter(l => l.id);
    for (const l of dias[d.n]) l.excluir = true;
  }
  estado.variante = 1;
  pintarVariantes();
  pintar();
}

// Atualiza só o total/avisos do dia para acompanhar o que se digita - NUNCA
// mexe em `.hj-linhas` (onde ficam os <input>). Recriar o campo que acabou
// de disparar o 'change' é o que causava a perda de foco: um input[type=time]
// dispara 'change' assim que hora+minuto formam um valor válido, ainda com o
// campo focado - inclusive no PRIMEIRO dígito do minuto, quando esse dígito
// já fecha um horário válido sozinho (sem esperar um segundo dígito). Não dá
// pra "restaurar o foco" depois de recriar o nó (o `.focus()` bate no campo,
// mas reinicia o cursor no segmento da hora) - a saída é nunca recriar esse
// nó por causa de um 'change' (achado da 2ª rodada de correção, 05/09/2026).
function atualizarDia(dia) {
  const fieldset = document.querySelector(`.hj-dia[data-dia="${dia}"]`);
  if (!fieldset) return;
  const d = DIAS.find(x => x.n === dia);
  const linhas = estado.porEscala[estado.escala][estado.variante][dia].filter(l => !l.excluir);
  const comHorario = linhas.filter(l => l.inicio && l.fim);
  const total = totalDoDia(comHorario);
  fieldset.querySelector('legend').innerHTML =
    `${esc(d.nome)} ${total ? `<span class="hj-total">${esc(duracao(total))}</span>` : ''}`;
  fieldset.querySelector('.hj-avisos').innerHTML = avisosHtml(validarDia(comHorario));
}

function avisosHtml(problemas) {
  return problemas.map(p => `<p class="hj-prob n-${p.nivel}">
    ${ico(p.nivel === 'erro' ? 'erro' : 'atencao', { tam: 14 })} ${esc(p.texto)}</p>`).join('');
}

function aoMudarCampo(e) {
  const linha = e.target.closest('.hj-linha'); if (!linha) return;
  const dia = Number(linha.dataset.dia);
  const alvo = estado.porEscala[estado.escala][estado.variante][dia].filter(l => !l.excluir)[Number(linha.dataset.i)];
  alvo.inicio = linha.querySelector('.hj-ini').value;
  alvo.fim = linha.querySelector('.hj-fim').value;
  alvo.obs = linha.querySelector('.hj-obs').value;
  atualizarDia(dia);
}

function pintar() {
  const box = document.getElementById('hj-dias');
  box.innerHTML = orfaosHtml() + diasVisiveis().map(d => {
    const linhas = estado.porEscala[estado.escala][estado.variante][d.n].filter(l => !l.excluir);
    const problemas = validarDia(linhas.filter(l => l.inicio && l.fim));
    const total = totalDoDia(linhas.filter(l => l.inicio && l.fim));
    return `<fieldset class="form-grupo hj-dia" data-dia="${d.n}">
      <legend>${esc(d.nome)} ${total ? `<span class="hj-total">${esc(duracao(total))}</span>` : ''}</legend>
      <div class="hj-linhas">
        ${linhas.map((l, i) => `
          <div class="hj-linha" data-dia="${d.n}" data-i="${i}">
            <input type="time" class="hj-ini" value="${esc(l.inicio)}" aria-label="Início" />
            <span class="hj-ate">às</span>
            <input type="time" class="hj-fim" value="${esc(l.fim)}" aria-label="Fim" />
            <input type="text" class="hj-obs" value="${esc(l.obs)}" placeholder="observação (opcional)" aria-label="Observação" />
            <button type="button" class="mini-btn no hj-del" aria-label="Remover bloco">${ico('excluir', { tam: 14 })}</button>
          </div>`).join('')
          || `<p class="form-hint">Sem jornada nesta ${esc(d.nome.toLowerCase())}.</p>`}
      </div>
      <div class="hj-dia-acoes">
        <button type="button" class="mini-btn hj-add" data-dia="${d.n}">${ico('adicionar', { tam: 14 })} bloco</button>
        ${podeCopiar() ? `<button type="button" class="mini-btn hj-copiar" data-dia="${d.n}">${ico('atualizar', { tam: 14 })} copiar para todos os dias</button>` : ''}
      </div>
      <div class="hj-avisos">${avisosHtml(problemas)}</div>
    </fieldset>`;
  }).join('');

  box.querySelectorAll('.hj-add').forEach(b => b.addEventListener('click', () => {
    // Campos vazios de propósito - ver o cabeçalho deste arquivo. O
    // `conduz`, não: ele é da VARIANTE, e uma linha que nasce sem ele
    // depois de a caixa ter sido marcada gravaria `false` com a caixa
    // marcada na tela (a caixa não é redesenhada por `pintar()`).
    estado.porEscala[estado.escala][estado.variante][Number(b.dataset.dia)]
      .push({ inicio: '', fim: '', obs: '', conduz: conduzMarcado() });
    pintar();
  }));
  box.querySelectorAll('.hj-del').forEach(b => b.addEventListener('click', () => {
    const linha = b.closest('.hj-linha');
    const dia = Number(linha.dataset.dia);
    const dias = estado.porEscala[estado.escala][estado.variante];
    const alvo = dias[dia].filter(l => !l.excluir)[Number(linha.dataset.i)];
    if (alvo.id) alvo.excluir = true;               // já existe no banco
    else dias[dia] = dias[dia].filter(l => l !== alvo);
    pintar();
  }));

  box.querySelector('#hj-limpar-orfaos')?.addEventListener('click', () => {
    for (const { linha } of orfaos()) linha.excluir = true;
    pintar();
  });

  box.querySelectorAll('.hj-copiar').forEach(b => b.addEventListener('click', async () => {
    const origem = Number(b.dataset.dia);
    const dias = estado.porEscala[estado.escala][estado.variante];
    const fonte = dias[origem].filter(l => !l.excluir && l.inicio && l.fim);
    if (!fonte.length) return toast({ titulo: 'Nada para copiar', texto: 'Este dia não tem blocos preenchidos.', tipo: 'atencao' });
    const temOutros = DIAS.some(d => d.n !== origem && dias[d.n].some(l => !l.excluir && (l.inicio || l.fim)));
    if (temOutros && !(await confirmar('Copiar para todos os dias?', {
        detalhe: 'Os blocos dos outros dias desta escala serão substituídos pelos deste dia.', textoOk: 'Copiar' }))) return;
    for (const d of DIAS) {
      if (d.n === origem) continue;
      // Blocos já gravados no banco viram exclusão; os novos entram sem
      // id. Cópia, não referência: editar um dia depois não mexe nos outros.
      // `conduz` viaja junto: ele é da variante, não do dia - uma cópia
      // sem ele desmarcaria quem conduz nos outros quatro dias.
      dias[d.n] = dias[d.n].filter(l => l.id).map(l => ({ ...l, excluir: true }))
        .concat(fonte.map(l => ({ inicio: l.inicio, fim: l.fim, obs: l.obs, conduz: Boolean(l.conduz) })));
    }
    pintar();
  }));
}

async function salvar(e) {
  e.preventDefault();
  const msg = document.getElementById('hj-msg');
  msg.className = 'auth-msg'; msg.textContent = '';

  // Validação de campo: inline, junto do formulário. Varre TODAS as
  // escalas, não só a aba visível - o que foi digitado numa aba não
  // vista precisa ser validado antes de salvar do mesmo jeito.
  for (const chaveEsc of Object.keys(estado.porEscala)) {
    for (const chaveVar of Object.keys(estado.porEscala[chaveEsc])) {
      for (const d of DIAS) {
        const linhas = estado.porEscala[chaveEsc][chaveVar][d.n].filter(l => !l.excluir);
        const nomeEsc = rotulaEscala(chaveEsc, estado.catalogoEscalas);
        const temVar = Object.keys(estado.porEscala[chaveEsc]).length > 1;
        const prefixo = estado.escalasEmUso.length > 1 || temVar
          ? `${nomeEsc}${temVar ? ` (variante ${chaveVar})` : ''} - ${d.nome}`
          : d.nome;
        for (const l of linhas) {
          if (!l.inicio || !l.fim) return falha(msg, `${prefixo}: informe início e fim de todos os blocos.`);
          if (l.fim <= l.inicio) return falha(msg, `${prefixo}: o fim precisa ser depois do início.`);
        }
        const erro = validarDia(linhas).find(p => p.nivel === 'erro');
        if (erro) return falha(msg, `${prefixo}: ${erro.texto}`);
      }
    }
  }

  const btn = document.getElementById('hj-save');
  btn.disabled = true; btn.textContent = 'Salvando…';
  // Se o banco ainda não tem as colunas da 030, o model descobre isso na
  // primeira gravação e passa a gravar sem elas. Quem chegou aqui com o
  // "+" ainda visível (a gaveta abriu antes da descoberta) precisa saber
  // que o que ela montou não foi guardado como duas configurações.
  const tinhaVariante = temVarianteNoBanco();
  try {
    // O lote grava sequencialmente - se um item no meio falhar, uma nova
    // tentativa não pode repetir o que já foi gravado. Por isso cada
    // sucesso atualiza o estado EM MEMÓRIA na hora: o excluído sai da
    // lista (senão a retentativa tentaria excluir de novo), e o criado
    // ganha o `id` que o banco devolveu (senão a retentativa criaria
    // duplicado em vez de atualizar).
    //
    // Grava TODAS as escalas de estado.porEscala, não só a aba visível
    // agora - trocar de aba não pode descartar silenciosamente o que a
    // pessoa digitou nas outras abas antes de clicar "Salvar jornada"
    // uma vez só, no fim.
    for (const chaveEsc of Object.keys(estado.porEscala)) {
      for (const chaveVar of Object.keys(estado.porEscala[chaveEsc])) {
        for (const d of DIAS) {
          for (const l of [...estado.porEscala[chaveEsc][chaveVar][d.n]]) {
            const payload = {
              servidor_id: estado.servidor.id,
              unidade_id: estado.unidadeId,
              dia_semana: d.n,
              inicio: l.inicio,
              fim: l.fim,
              obs: l.obs.trim() || null,
              escala: chaveEsc,
              variante: Number(chaveVar),
              conduz: Boolean(l.conduz),
            };
            if (l.excluir && l.id) {
              await excluirBloco(l.id);
              estado.porEscala[chaveEsc][chaveVar][d.n] =
                estado.porEscala[chaveEsc][chaveVar][d.n].filter(x => x !== l);
            } else if (l.id) {
              await atualizarBloco(l.id, payload);
            } else if (!l.excluir) {
              const novo = await criarBloco(payload);
              l.id = novo.id;
            }
          }
        }
      }
    }
    fecharDrawer();
    await estado.recarregar();
    toast({ titulo: 'Jornada salva', texto: estado.servidor.nome, tipo: 'sucesso' });
    if (tinhaVariante && !temVarianteNoBanco()) {
      toast({
        titulo: 'Só uma configuração foi guardada',
        texto: 'Este sistema ainda não foi atualizado para guardar mais de uma configuração do mesmo dia. Os horários entraram todos na primeira. Avise a Gerência antes de refazer.',
        tipo: 'atencao',
      });
    }
  } catch (err) {
    reportarErro(err, { msg, titulo: 'Não foi possível salvar a jornada' });
    btn.disabled = false; btn.textContent = 'Salvar jornada';
  }
}
