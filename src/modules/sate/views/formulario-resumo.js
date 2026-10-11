// ============================================================
// FundHub - sate/views/formulario-resumo.js
// O RESUMO DO PEDIDO no modal de solicitação: o que a pessoa confere antes
// de enviar (spec 2026-10-10-sate-solicitacao-reformulada-design.md § D8).
//
// Um quadro só, logo acima do botão: quantos estudantes e veículos,
// quantos ônibus estão livres para aquele horário, o tempo de viagem - e,
// dentro dele, os erros (que impedem o envio) e os avisos (que não).
//
// Separado de formulario.js por ter estado e contrato próprios: a consulta
// de vagas com atraso, o descarte da resposta velha e o cadastro rápido de
// frota. O formulário só diz O QUE foi digitado (`ler`) e pede a revisão.
// ============================================================
import {
  lerOcupacao, intervaloDaViagem, livresPara, totalDoDia, proximoHorario, livresNoPeriodo, trajetoParaVaga,
} from '../disponibilidade.model.js';
import { periodoDe, avaliarPedido } from '../regras.model.js';
import { explicarTrajeto } from '../rota.model.js';
import {
  capacidadeOnibus, capacidadeVan, antecedenciaMinDias, trajetoProvisorioMin,
} from '../sate.config.js';
import { cadastroRapidoHtml, ligarCadastroRapido } from './frota-rapida.js';
import { esc } from '../../../shared/dom.js';
import { hojeISO } from '../../../shared/format.js';
import { ico } from '../../../shared/ui/icones.js';

let ctx = null;
let ler = () => ({});
// Cada consulta de saldo recebe um número. Digitar "40" dispara duas
// mudanças, e sem isto a resposta da primeira pode chegar depois da
// segunda e pintar o saldo do número errado.
let pedidoSaldo = 0;
let deb = null;

export const resumoHtml = () => `
  <div id="f-resumo" class="sol-resumo" aria-live="polite">
    <ul class="sol-resumo-fatos" id="f-resumo-fatos">${fatosHtml({})}</ul>
    <div id="f-resumo-msgs"></div>
  </div>`;

// Sempre visível: zeros enquanto nada foi digitado. Os números em negrito.
// O ônibus é contado só pelos estudantes (a regra do pedido); vans pelos
// cadeirantes. Com várias paradas a viagem é um ônibus só.
function fatosHtml({ alunos = 0, adultos = 0, cadeirantes = 0, emb = null, trajeto = null }) {
  const lugares = capacidadeOnibus();
  const onibus = alunos ? Math.ceil(alunos / lugares) : 0;
  const vans = cadeirantes ? Math.ceil(cadeirantes / capacidadeVan()) : 0;
  const chegada = trajeto?.status === 'ok' && emb && trajeto.min != null ? somarMinutos(emb, trajeto.min) : null;
  return [
    `<li>${ico('equipe', { tam: 14 })} <b>${alunos}</b> estudantes · <b>${adultos}</b> adultos acompanhantes</li>`,
    `<li>${ico('onibus', { tam: 14 })} <b>${onibus}</b> ônibus (${lugares} lugares cada)`
      + `${vans ? ` · <b>${vans}</b> van(s) adaptada(s)` : ''}</li>`,
    chegada ? `<li>${ico('horario', { tam: 14 })} Chegada prevista ao local: <b>${esc(chegada)}</b>`
      + `</li>`
      : (trajeto ? `<li>${ico('horario', { tam: 14 })} <span class="fora">${esc(explicarTrajeto(trajeto))}</span></li>` : ''),
  ].filter(Boolean).join('');
}

// "HH:MM" + minutos → "HH:MM" (aritmética de relógio, não de data; vira o dia).
function somarMinutos(hhmm, min) {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const t = (h * 60 + m + Math.round(min)) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// Os números do resumo acompanham o que é digitado, na hora; o que depende
// do banco (vagas) vem depois, por pintarSaldo.
function pintarFatos() {
  const el = document.getElementById('f-resumo-fatos');
  if (el) el.innerHTML = fatosHtml(ler());
}

// `ler()` devolve { data, emb, ret, alunos, cadeirantes, trajeto, localId }.
// Cada abertura do modal começa limpa: sem consulta velha nem atraso pendente.
export function ligarResumo({ ctx: contexto, ler: lerForm }) {
  ctx = contexto;
  ler = lerForm;
  pedidoSaldo++;   // invalida a consulta ainda no ar da abertura anterior
  clearTimeout(deb);
  deb = null;
}

// O cadastro rápido de frota chama isto ao terminar: repinta já, com a frota nova.
export const repintarResumo = () => pintarSaldo();

// ── Saldo ao vivo ────────────────────────────────────────────
// Consulta o banco no máximo a cada 400 ms, e só quando data, período e
// nº de estudantes já foram informados - sem eles não há saldo a mostrar.
export function revisar() {
  pintarFatos();
  clearTimeout(deb);
  deb = setTimeout(pintarSaldo, 400);
}

async function pintarSaldo() {
  const msgs = document.getElementById('f-resumo-msgs');
  const btn = document.getElementById('f-submit');
  if (!msgs) return;   // o modal fechou enquanto o debounce corria

  const dados = ler();
  const { data, emb, ret, alunos, adultos = 0, paradas = 0, cadeirantes, trajeto, localId } = dados;
  pintarFatos();
  const periodo = periodoDe(emb, ret);
  // Várias paradas = um ônibus só: o total de passageiros cabe nele.
  const lugares = capacidadeOnibus();
  const lotado = paradas && alunos + adultos > lugares
    ? [{ codigo: 'lotacao_paradas', texto: `Com várias escolas no mesmo ônibus, estudantes e adultos somam ${alunos + adultos} e o ônibus tem ${lugares} lugares.` }]
    : [];
  const vazio = () => {
    msgs.innerHTML = lotado.map(e => `<div class="sol-erro">${esc(e.texto)}</div>`).join('');
    btn.disabled = lotado.length > 0 || !!ctx.somenteLeitura;
  };
  if (!data || !periodo || !alunos) { vazio(); return; }

  const meu = ++pedidoSaldo;
  let linha;
  try { linha = await lerOcupacao(data); } catch (_) { vazio(); return; }
  if (meu !== pedidoSaldo) return;   // resposta velha: descarta

  const trajetoMin = trajetoParaVaga({ trajeto_min: trajeto?.min ?? null, local_id: localId }, trajetoProvisorioMin());
  // Com os dois horários, a conta é do INTERVALO do pedido (spec D5/D8).
  const iv = emb && ret ? intervaloDaViagem({
    periodo, embarque: emb, retorno: ret, trajetoMin, intervaloMin: linha.intervaloMin,
  }) : null;
  const livres = iv ? livresPara(linha, iv.ini, iv.fim, 'onibus') : livresNoPeriodo(linha, 0, periodo, 'onibus');
  const livresVan = iv ? livresPara(linha, iv.ini, iv.fim, 'vans') : livresNoPeriodo(linha, 0, periodo, 'vans');
  const totalDia = totalDoDia(linha, 0, 'onibus');
  const r = avaliar({ data, periodo, alunos, cadeirantes, livres, livresVan, totalDia, emb, ret, linha, iv });
  r.erros.push(...lotado);

  const linhas = [
    linha.aproximado ? '<div class="sol-aviso">Contagem sem horário: o banco ainda não tem a atualização desta versão.</div>' : '',
    ...r.erros.map(e => `<div class="sol-erro">${esc(e.texto)}</div>`),
    ...r.avisos.map(a => `<div class="sol-aviso">${esc(a.texto)}</div>`),
  ];
  // Quem aprova, num dia sem frota: o cadastro rápido ali mesmo (spec D4).
  if (ctx.aprovador && r.erros.some(e => e.codigo === 'sem_frota_dia')) linhas.push(await cadastroRapidoHtml(data, periodo));
  // cadastroRapidoHtml() consultou o banco (getRotulos): outra pintura
  // pode ter começado e terminado nesse meio-tempo, ou o modal fechou.
  if (meu !== pedidoSaldo || !document.getElementById('f-resumo-msgs')) return;
  msgs.innerHTML = linhas.join('');
  ligarCadastroRapido(data, repintarResumo);
  btn.disabled = r.erros.length > 0 || !!ctx.somenteLeitura;
}

function avaliar({ data, periodo, alunos, cadeirantes, livres, livresVan, totalDia, emb, ret, linha, iv }) {
  const dias = Math.round((new Date(data + 'T00:00:00') - new Date(hojeISO() + 'T00:00:00')) / 86400000);
  const precisa = Math.ceil(alunos / capacidadeOnibus());
  return avaliarPedido({
    periodo, qtdAlunos: alunos, usaOnibus: true,
    qtdCadeirantes: cadeirantes,
    livres, livresVan, totalDia,
    proximo: iv && precisa > livres ? proximoHorario(linha, { ini: iv.ini, fim: iv.fim, precisa, periodo }) : null,
    diasDeAntecedencia: dias,
    horarioEmbarque: emb, horarioRetorno: ret,
    capacidadeOnibus: capacidadeOnibus(), capacidadeVan: capacidadeVan(),
    antecedenciaMin: antecedenciaMinDias(),
    aprovador: !!ctx.aprovador,
  });
}
