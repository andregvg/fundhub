// ============================================================
// FundHub - escolas/views/localizar.js
// Painel "Localização das escolas", na engrenagem do módulo: localizar
// em lote as escolas sem latitude e longitude, com progresso ao vivo.
//
// A tarefa é do model (`localizacao.model.js`) e sobrevive a esta tela:
// fechar a janela não para nada, e reabrir mostra o progresso de onde
// está. Aqui só se desenha e se assina.
//
// A barra é atualizada NO LUGAR - largura, contagem e escola atual - e
// não redesenhada a cada escola: um innerHTML novo recriaria o elemento e
// a transição de largura nunca aconteceria, a barra andaria aos saltos.
// ============================================================
import {
  resumoLocalizacao, localizarEscolas, cancelarLocalizacao,
  tarefaLocalizacao, acompanharLocalizacao,
} from '../localizacao.model.js';
import { linkMaps } from '../../locais/locais.model.js';
import { podeEscrever } from '../../../core/permissoes.js';
import { esc } from '../../../shared/dom.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';

// Assinatura da tela ABERTA. Uma só: repintar o painel troca a anterior.
let pararDeOuvir = null;

// "A pessoa está vendo o painel?" Nem `isConnected` nem caixa de layout
// respondem: fechar o modal só o esconde por opacidade, e o conteúdo fica
// no documento, com tamanho, até o próximo modal abrir. O que responde é
// o contrato de acessibilidade - `fecharModal` marca `aria-hidden="true"`,
// e é exatamente a afirmação "isto não está na tela". Na página
// agregadora de Configurações não há modal, e o painel conta como visto.
const visivel = (el) => el.isConnected && !el.closest('[aria-hidden="true"]');

export async function pintarLocalizacao(box) {
  if (!box) return;
  pararDeOuvir?.();
  pararDeOuvir = null;

  const t = tarefaLocalizacao();
  if (t?.ativa) { desenharProgresso(box, t); ouvir(box); return; }

  box.innerHTML = loading();
  let resumo;
  try { resumo = await resumoLocalizacao(); }
  catch (err) { box.innerHTML = erroBox(err); return; }
  desenharResumo(box, resumo, t);
}

// ── Parado: quantas faltam, e o resultado da última rodada ───
function desenharResumo(box, r, ultima) {
  const pode = podeEscrever('escolas');
  const n = r.aLocalizar.length;
  const pct = r.total ? Math.round((r.localizadas / r.total) * 100) : 0;
  const minutos = Math.max(1, Math.round((n * 1.3) / 60));

  box.innerHTML = `
    <div class="geo-lote">
      <div class="progresso" role="progressbar" aria-valuemin="0" aria-valuemax="${r.total}"
           aria-valuenow="${r.localizadas}" aria-label="Escolas localizadas">
        <div class="progresso-cab">
          <span><b>${r.localizadas}</b> de ${r.total} escolas localizadas</span>
          <span class="progresso-pct">${pct}%</span>
        </div>
        <div class="progresso-trilho"><div class="progresso-barra" style="--p: ${pct}%"></div></div>
      </div>

      ${r.semEndereco.length ? `
        <p class="form-hint">${r.semEndereco.length} escola(s) sem endereço cadastrado não entram na busca:
          ${esc(r.semEndereco.slice(0, 5).map(u => u.apelido || u.nome).join(', '))}${r.semEndereco.length > 5 ? '…' : ''}.</p>` : ''}

      ${ultima ? resultadoHtml(ultima) : ''}

      ${n ? `
        <div class="geo-lote-acao">
          <button type="button" class="btn-primary" id="geo-iniciar" ${pode ? '' : 'disabled'}>
            ${ico('visita', { tam: 14 })} Localizar ${n} escola${n > 1 ? 's' : ''}</button>
          <span class="form-hint">Leva cerca de ${minutos} min. Dá para fechar esta janela: a busca continua.</span>
        </div>`
      : `<p class="geo-lote-ok">${ico('ok', { tam: 14 })} Todas as escolas com endereço já estão localizadas.</p>`}
    </div>`;

  box.querySelector('#geo-iniciar')?.addEventListener('click', () => iniciar(box));
}

function iniciar(box) {
  // Aviso de conclusão para quem FECHOU a janela: sem ele, a tarefa
  // terminaria em silêncio numa tela que ninguém está olhando.
  const pararAviso = acompanharLocalizacao((t) => {
    if (t.ativa) return;
    pararAviso();
    if (visivel(box)) return;
    toast({
      titulo: t.interrompida ? 'Localização interrompida' : 'Localização das escolas concluída',
      texto: `${t.localizadas.length + t.revisar.length} localizada(s), ${t.naoEncontradas.length} não encontrada(s).`,
      tipo: t.interrompida ? 'atencao' : 'sucesso',
    });
  });

  ouvir(box);
  localizarEscolas().catch(err => {
    pararAviso();
    toast({ titulo: 'Não foi possível localizar', texto: err?.message || String(err), tipo: 'erro' });
    if (visivel(box)) pintarLocalizacao(box);
  });
}

function ouvir(box) {
  pararDeOuvir?.();
  pararDeOuvir = acompanharLocalizacao((t) => {
    if (!visivel(box)) { pararDeOuvir?.(); pararDeOuvir = null; return; }
    if (t.ativa) {
      if (!box.querySelector('.progresso.ativo')) desenharProgresso(box, t);
      else atualizarProgresso(box, t);
    } else {
      pintarLocalizacao(box);   // terminou: resumo novo, lido do banco
    }
  });
}

// ── Rodando: a barra viva ────────────────────────────────────
function desenharProgresso(box, t) {
  box.innerHTML = `
    <div class="geo-lote">
      <div class="progresso ativo" role="progressbar" aria-valuemin="0" aria-valuemax="${t.total}"
           aria-valuenow="${t.feitas}" aria-label="Localizando escolas">
        <div class="progresso-cab">
          <span data-conta></span>
          <span class="progresso-pct" data-pct></span>
        </div>
        <div class="progresso-trilho"><div class="progresso-barra" style="--p: 0%"></div></div>
        <div class="progresso-rodape">
          <span class="progresso-atual" data-atual></span>
          <span data-resta></span>
        </div>
      </div>
      <div class="geo-lote-numeros" data-numeros></div>
      <div class="geo-lote-acao">
        <button type="button" class="btn-secundario" id="geo-parar">Parar</button>
        <span class="form-hint">O que já foi encontrado fica salvo. Dá para fechar esta janela.</span>
      </div>
    </div>`;
  box.querySelector('#geo-parar').addEventListener('click', (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = 'Parando…';
    cancelarLocalizacao();
  });
  // A largura inicial precisa ser APLICADA em 0 antes de mudar, senão a
  // primeira transição não acontece. Ler o layout força isso na hora.
  // `requestAnimationFrame` faria o mesmo, mas não roda em aba de fundo -
  // e a barra ficaria parada em 0% justamente para quem saiu e voltou.
  void box.querySelector('.progresso-barra')?.offsetWidth;
  atualizarProgresso(box, t);
}

function atualizarProgresso(box, t) {
  const pct = t.total ? Math.round((t.feitas / t.total) * 100) : 100;
  const q = (sel) => box.querySelector(sel);
  q('.progresso')?.setAttribute('aria-valuenow', String(t.feitas));
  q('.progresso-barra')?.style.setProperty('--p', `${pct}%`);
  const set = (sel, txt) => { const el = q(sel); if (el) el.textContent = txt; };
  set('[data-conta]', `${t.feitas} de ${t.total} escolas`);
  set('[data-pct]', `${pct}%`);
  set('[data-atual]', t.cancelada ? 'Parando depois desta escola…' : (t.atual ? `Procurando ${t.atual}` : ''));
  set('[data-resta]', t.restanteSeg ? `cerca de ${tempo(t.restanteSeg)}` : '');
  const nums = q('[data-numeros]');
  if (nums) nums.innerHTML = numerosHtml(t);
}

const tempo = (s) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`);

function numerosHtml(t) {
  const n = (valor, rotulo, classe) =>
    `<span class="geo-num ${classe}"><b>${valor}</b> ${rotulo}</span>`;
  return n(t.localizadas.length, 'localizadas', 'ok')
    + n(t.revisar.length, 'para conferir', 'conferir')
    + n(t.naoEncontradas.length, 'não encontradas', 'fora');
}

// ── Resultado da última rodada ───────────────────────────────
function resultadoHtml(t) {
  const conferir = t.revisar.length ? `
    <details class="geo-lista">
      <summary>Conferir no mapa (${t.revisar.length})</summary>
      <p class="form-hint">Localizadas pela rua, sem o número exato. Servem para o tempo de viagem; confira se o ponto está na quadra certa.</p>
      <ul>${t.revisar.map(e => `<li>${esc(e.nome)}
        <a href="${esc(linkMaps(e.lat, e.lng))}" target="_blank" rel="noopener">${ico('externo', { tam: 11 })} ver no mapa</a></li>`).join('')}</ul>
    </details>` : '';

  const nao = t.naoEncontradas.length ? `
    <details class="geo-lista">
      <summary>Não encontradas (${t.naoEncontradas.length})</summary>
      <p class="form-hint">Corrija o endereço no cadastro da escola e rode de novo, ou informe as coordenadas copiadas do Google Maps.</p>
      <ul>${t.naoEncontradas.map(e => `<li>${esc(e.nome)}<span class="di-meta">${esc(e.endereco || '')}</span></li>`).join('')}</ul>
    </details>` : '';

  return `
    ${t.interrompida ? `<p class="geo-aviso">${esc(t.interrompida)}</p>` : ''}
    ${t.cancelada && !t.interrompida ? `<p class="form-hint">Busca interrompida em ${t.feitas} de ${t.total}.</p>` : ''}
    <div class="geo-lote-numeros">${numerosHtml(t)}</div>
    ${conferir}${nao}`;
}
