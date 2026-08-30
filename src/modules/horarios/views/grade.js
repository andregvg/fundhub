// ============================================================
// FundHub - horarios/views/grade.js
// O desenho da grade: eixo, faixas, cobertura, hachura de
// divergência e a seleção por clique. Não sabe de onde vêm os dados
// nem como salvá-los - recebe linhas prontas e devolve HTML.
//
// Faixa existe porque dois blocos sobrepostos na mesma trilha se
// cobrem, e a grade passa a mentir sobre quem está presente.
// ============================================================
import { validarDia, totalDoDia, paraHora, duracao } from '../horarios.model.js';
// empilhar/contarFaixas/posicaoNaBarra/marcasDaBarra vieram da Task 3;
// lacunasCobertura, da divisão da Task 6 - as quatro moram em
// grade.model.js, não em horarios.model.js. Ver progress.md, Ruling 13.
import { empilhar, contarFaixas, lacunasCobertura,
  posicaoNaBarra, marcasDaBarra } from '../grade.model.js';
import { esc, vazio } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';

const hhmm = (t) => String(t ?? '').slice(0, 5);

let sel = null;
export const selecionado = () => sel;

// Posição de um intervalo (em minutos) na barra, em % - reusa a
// mesma janela de posicaoNaBarra passando um pseudo-bloco.
const posDoIntervalo = (ini, fim) =>
  posicaoNaBarra({ inicio: paraHora(ini), fim: paraHora(fim) });

// `podeEditar` só libera o lápis por enquanto. Arrastar para reordenar
// e o checkbox de cobertura são Task 9 - renderizar `draggable`/
// `.arrastavel` ou o checkbox habilitado antes de existir handler
// seria affordance sem comportamento (o checkbox é o pior caso: a
// pessoa desmarca, a UI confirma, nada é gravado). Ver rodada de
// correção 1 da Task 7.
export function legendaHtml(linhas, { podeEditar }) {
  return `<div class="hg-legenda" id="hg-legenda">
    ${linhas.map(l => `
      <div class="hg-chip serie-${l.serie + 1}" data-servidor="${esc(l.servidor.id)}">
        <span class="hg-cor" aria-hidden="true"></span>
        <span class="hg-nome">${esc(l.servidor.nome)}</span>
        <span class="hg-cargo">${esc(l.cargo)}</span>
        ${podeEditar ? `<button type="button" class="mini-btn" data-editar="${esc(l.servidor.id)}"
             aria-label="Editar jornada de ${esc(l.servidor.nome)}">${ico('editar', { tam: 14 })}</button>` : ''}
        <label class="switch radio hg-cob" title="Conta na cobertura da escola">
          <input type="checkbox" data-cobertura="${esc(l.servidor.id)}"
                 ${l.contaCobertura ? 'checked' : ''} disabled />
          <span class="switch-trilho" aria-hidden="true"></span>
          <span class="switch-txt">cobertura</span>
        </label>
      </div>`).join('')}
  </div>`;
}

export function gradeHtml(dias, { linhas, blocosDe, mostrarCobertura }) {
  const serieDe = new Map(linhas.map(l => [l.servidor.id, l.serie]));
  const nomeDe = new Map(linhas.map(l => [l.servidor.id, l.servidor.nome]));
  const contam = new Set(linhas.filter(l => l.contaCobertura).map(l => l.servidor.id));

  return `<div class="hg-grade">${dias.map(d => {
    const doDia = linhas.flatMap(l => blocosDe(l.servidor.id, d.n));
    const faixas = contarFaixas(doDia);

    const barras = empilhar(doDia).map(({ bloco, faixa }) => {
      const p = posicaoNaBarra(bloco);
      const serie = (serieDe.get(bloco.servidor_id) ?? 0) + 1;
      const nome = nomeDe.get(bloco.servidor_id) || '';
      return `<button type="button" class="hg-bloco serie-${serie}"
        style="left:${p.esquerda}%;width:${p.largura}%;top:${faixa * 26}px"
        data-bloco="${esc(bloco.id)}" data-servidor="${esc(bloco.servidor_id)}"
        title="${esc(nome)} · ${esc(hhmm(bloco.inicio))} às ${esc(hhmm(bloco.fim))}${bloco.obs ? ' · ' + esc(bloco.obs) : ''}">
        <span>${esc(hhmm(bloco.inicio))}–${esc(hhmm(bloco.fim))}</span>
      </button>`;
    }).join('');

    // Hachura por servidor: cada um é validado sozinho, porque a
    // regra de 8h e a de 6h contínuas são da PESSOA, não do dia.
    const marcas = linhas.flatMap(l => {
      const meus = blocosDe(l.servidor.id, d.n);
      return validarDia(meus).map(p => {
        const pos = posDoIntervalo(p.ini, p.fim);
        return `<span class="hg-falha n-${p.nivel}"
          style="left:${pos.esquerda}%;width:${pos.largura}%"
          title="${esc(l.servidor.nome)}: ${esc(p.texto)}"></span>`;
      });
    }).join('');

    const lacunas = mostrarCobertura
      ? lacunasCobertura(doDia.filter(b => contam.has(b.servidor_id)))
      : [];
    const tira = mostrarCobertura
      ? `<div class="hg-cobertura">${lacunas.map(l => {
          const pos = posDoIntervalo(l.ini, l.fim);
          return `<span class="hg-lacuna" style="left:${pos.esquerda}%;width:${pos.largura}%"
            title="Sem ninguém entre ${esc(paraHora(l.ini))} e ${esc(paraHora(l.fim))}"></span>`;
        }).join('')}</div>`
      : '';

    return `<div class="hg-linha" data-dia="${d.n}">
      <div class="hg-dia">${esc(d.curto)}</div>
      <div class="hg-track" style="height:${faixas * 26 + 4}px">
        ${eixo()}${barras}${marcas}
      </div>
      ${tira}
      <div class="hg-info">${
        doDia.length ? `<b>${duracao(totalDoDia(doDia))}</b>` : vazio('sem jornada')
      }</div>
    </div>`;
  }).join('')}</div>`;
}

function eixo() {
  return marcasDaBarra().map(m =>
    `<span class="hg-marca" style="left:${m.pos}%"><i></i><em>${esc(m.hora.slice(0, 2))}</em></span>`).join('');
}

// Clicar numa barra destaca o servidor dela e esmaece o resto. É o
// que permite a cor ficar dessaturada em repouso: ela só precisa
// distinguir quando alguém está procurando alguém.
export function ligarSelecao(root) {
  root.addEventListener('click', (e) => {
    // O lápis e o checkbox moram dentro do .hg-chip - sem esta guarda,
    // clicar neles também selecionaria o servidor de carona.
    if (e.target.closest('[data-editar],[data-cobertura]')) return;
    const barra = e.target.closest('.hg-bloco');
    const chip = e.target.closest('.hg-chip');
    const alvo = barra?.dataset.servidor || chip?.dataset.servidor || null;
    if (!alvo && !e.target.closest('.hg-grade, .hg-legenda')) { aplicar(root, null); return; }
    if (!alvo) return;
    aplicar(root, sel === alvo ? null : alvo);
  });
}

function aplicar(root, id) {
  sel = id;
  reaplicarSelecao(root);
}

// `corpo.innerHTML` é reconstruído a cada `carregar()`, mas `sel`
// (module-level) sobrevive - sem reaplicar depois de repintar, a
// classe `tem-selecao` fica na raiz sem nenhum `.sel` correspondente
// nos filhos recém-criados, e a grade inteira fica esmaecida sem
// ninguém destacado. Chamar depois de repintar; nunca limpar aqui -
// preserva quem a pessoa estava procurando através da recarga.
export function reaplicarSelecao(root) {
  let achou = false;
  root.querySelectorAll('[data-servidor]').forEach(el => {
    const casa = el.dataset.servidor === sel;
    if (casa) achou = true;
    el.classList.toggle('sel', casa);
  });
  root.classList.toggle('tem-selecao', achou);
}
