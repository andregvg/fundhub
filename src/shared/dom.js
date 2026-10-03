// ============================================================
// FundHub - shared/dom.js
// Utilitários de DOM/HTML usados por todos os módulos.
// Regra de ouro: TODO valor vindo do banco passa por esc() antes de
// entrar em um template literal. Isso é o que impede XSS armazenado.
// ============================================================

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escapa texto para interpolação segura em HTML.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ENTIDADES[c]);

// Campo sem valor. Nunca um traço solto: ele não informa nada, e não
// distingue "ninguém cadastrou" de "carregou vazio por erro". Cada
// chamada escolhe a mensagem, e é aí que está o valor do helper.
// Devolve HTML pronto: não passar por esc() de novo, e não usar dentro
// de atributo (title=, value=), só em conteúdo de elemento.
export const vazio = (msg) => `<span class="vazio">${esc(msg)}</span>`;

// Normaliza para busca: minúsculas, sem acentos.
export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Distância de edição (Levenshtein com inversão de vizinhas): quantas
// letras trocar, pôr, tirar ou inverter para ir de `a` a `b`. Base da
// busca tolerante a erro de digitação (spec 2026-10-02, D7).
export function distancia(a, b) {
  a = String(a ?? ''); b = String(b ?? '');
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// Quanto a palavra digitada `p` difere da palavra `q`, ou null se não se
// parecem. Começo de palavra vale como igual: quem digitou "muse" ainda
// não terminou "museu". Abaixo de 4 letras, só igual ou começo - "de" e
// "da" a uma letra de tudo trariam a lista inteira. Tolera 1 letra, e 2
// a partir de 7 (palavra longa erra mais).
export function semelhanca(p, q) {
  p = norm(p).trim(); q = norm(q).trim();
  if (!p || !q) return null;
  if (q.startsWith(p)) return 0;
  if (p.length < 4) return null;
  const d = Math.min(distancia(p, q), distancia(p, q.slice(0, p.length)));
  return d <= (p.length >= 7 ? 2 : 1) ? d : null;
}

// "Feira do Livro" → "feira_do_livro" (chaves técnicas).
export const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

// Valor de um input pelo id, já aparado.
export const val = (id) => (qs('#' + id)?.value ?? '').trim();
export const checked = (id) => Boolean(qs('#' + id)?.checked);

// Mensagem de erro/sucesso nos rodapés de formulário.
export function falha(el, txt) { el.classList.add('err'); el.textContent = txt; }
export function ok(el, txt) { el.classList.add('ok'); el.textContent = txt; }
