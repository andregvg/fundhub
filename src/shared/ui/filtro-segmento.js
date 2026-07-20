// ============================================================
// FundHub — shared/ui/filtro-segmento.js
// Filtro por segmento de ensino, compartilhado pelos módulos.
//
// O ponto central: ele começa PRÉ-PREENCHIDO com os segmentos de
// atuação do perfil. Quem cuida da Educação Infantil abre o
// Calendário e já vê CEI + EMEI + Conveniadas, sem clicar em nada.
//
// Isso NÃO é uma restrição de acesso — a pessoa pode desmarcar e ver
// a rede inteira. Quem restringe é o RLS (ver migration 021); aqui é
// só conveniência. Confundir os dois papéis seria um erro caro: um
// filtro que "protege" dá falsa sensação de segurança.
//
// Uso na view:
//   const seg = criarFiltroSegmento(el, { perfil, onChange: pintar });
//   ... seg.selecionados()          // ['EMEF','EJA']
//   ... seg.combina(unidade)        // true/false
// ============================================================
import { SEGMENTOS, ATALHOS, expandir, atalhoDe, unidadeNoSegmento } from '../../core/segmentos.js';
import { esc } from '../dom.js';

// `el` é o container (normalmente um <div> dentro da toolbar).
export function criarFiltroSegmento(el, { perfil, onChange = () => {}, chaveMemoria } = {}) {
  // Prioridade: o que a pessoa escolheu nesta sessão > o segmento de
  // atuação do perfil > nada (rede inteira).
  const lembrado = chaveMemoria ? sessionStorage.getItem(chaveMemoria) : null;
  let selecao = lembrado !== null
    ? expandir(JSON.parse(lembrado))
    : expandir(perfil?.segmentos);

  function guardar() {
    if (chaveMemoria) sessionStorage.setItem(chaveMemoria, JSON.stringify(selecao));
  }

  function pintar() {
    const ativo = atalhoDe(selecao);
    el.innerHTML = `
      <div class="fseg" role="group" aria-label="Filtrar por segmento">
        ${ATALHOS.map(a => `
          <button type="button" class="chip atalho ${ativo === a.id ? 'on' : ''}"
                  data-atalho="${a.id}">${esc(a.rotulo)}</button>`).join('')}
        <span class="fseg-sep" aria-hidden="true"></span>
        ${SEGMENTOS.map(s => `
          <button type="button" class="chip ${selecao.includes(s.codigo) ? 'on' : ''}"
                  data-seg="${s.codigo}">${s.ico} ${esc(s.rotulo)}</button>`).join('')}
        ${selecao.length ? `<button type="button" class="chip limpar" data-limpar="1">✕ limpar</button>` : ''}
      </div>`;
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;

    if (b.dataset.limpar) {
      selecao = [];
    } else if (b.dataset.atalho) {
      const atalho = ATALHOS.find(a => a.id === b.dataset.atalho);
      // Clicar no atalho já ativo desmarca — é o jeito rápido de
      // voltar a "todos" sem procurar o ✕.
      selecao = atalhoDe(selecao) === atalho.id ? [] : [...atalho.segmentos];
    } else if (b.dataset.seg) {
      const c = b.dataset.seg;
      selecao = selecao.includes(c) ? selecao.filter(x => x !== c) : expandir([...selecao, c]);
    } else {
      return;
    }
    guardar();
    pintar();
    onChange(selecao);
  });

  pintar();

  return {
    selecionados: () => [...selecao],
    // Casa com uma unidade (objeto de escolas.model).
    combina: (u) => unidadeNoSegmento(u, selecao),
    // Casa com um registro que aponta para uma unidade por id.
    combinaPorUnidade: (unidadeId, indice) =>
      !selecao.length || unidadeNoSegmento(indice?.[unidadeId], selecao),
    definir(novos) { selecao = expandir(novos); guardar(); pintar(); onChange(selecao); },
  };
}

// Índice unidadeId → unidade, para os módulos cujos registros só
// guardam o id (afastamentos, ocorrências, visitas…).
export function indexarUnidades(unidades = []) {
  const idx = {};
  for (const u of unidades) if (u?.id) idx[u.id] = u;
  return idx;
}
