// ============================================================
// FundHub - modules/ajuda/markdown.js
// Leitor de um SUBCONJUNTO fechado de Markdown, para os tutoriais.
// O hub não tem build nem pode ganhar dependência - e o que os
// tutoriais usam cabe aqui.
//
// SEGURANÇA (R5): o texto é escapado ANTES de qualquer conversão.
// Só as tags que este arquivo gera existem no resultado - um `.md`
// com <script> aparece como texto. Escapar primeiro, formatar depois.
//
// Suportado: # a ###, **forte**, *ênfase*, `código`, listas - e 1.
// (um nível), tabelas GFM, > citação, ``` cerca (e ```vivo, bloco
// preenchido pela tela), [texto](url), ---.
// Fora: HTML cru (escapado), imagens, aninhamento profundo, notas.
// ============================================================

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Ênfase e links, aplicados sobre um trecho que NÃO é código.
function enfase(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, texto, url) => {
      // Só http(s) e hash interno; qualquer outra coisa vira texto puro.
      const limpa = url.trim();
      if (/^(https?:\/\/|#\/|#)/.test(limpa)) {
        const externo = limpa.startsWith('http');
        return `<a href="${limpa}"${externo ? ' target="_blank" rel="noopener"' : ''}>${texto}</a>`;
      }
      return texto;
    });
}

// Inline: `código` divide o trecho em pedaços alternados (fora/dentro
// de crase). Só os pedaços de FORA passam por ênfase/link - o de
// dentro vira <code> literal.
function inline(txt) {
  const partes = String(txt).split('`');
  return partes
    .map((p, idx) => (idx % 2 === 1 ? `<code>${p}</code>` : enfase(p)))
    .join('');
}

const ITEM = /^\s*([-*]|\d+\.)\s+(.*)$/;

// Uma linha recuada que NÃO abre outro bloco (item, título, citação, cerca,
// tabela, régua) continua o item de lista anterior. Um nível só.
const continuaItem = (l) => /^\s+\S/.test(l) && !ITEM.test(l)
  && !/^\s*(#{1,3}\s|&gt;|```|---\s*$)/.test(l) && !l.includes('|');

export function markdownParaHtml(texto) {
  const linhas = esc(String(texto || '')).split('\n');
  const out = [];
  let i = 0;

  while (i < linhas.length) {
    const l = linhas[i];

    // Bloco de código cercado. ```vivo com um id é um BLOCO VIVO: a tela o
    // preenche com dado do banco (ajuda.view.js § VIVOS). Id fora de
    // [a-z0-9-] continua código - nada vindo do texto vira atributo sem
    // passar por aqui.
    if (l.trimStart().startsWith('```')) {
      const info = l.trim().slice(3).trim();
      const corpo = [];
      i++;
      while (i < linhas.length && !linhas[i].trimStart().startsWith('```')) {
        corpo.push(linhas[i]); i++;
      }
      i++; // pula o fechamento
      const id = corpo.join('').trim();
      if (info === 'vivo' && /^[a-z0-9-]+$/.test(id)) out.push(`<div class="md-vivo" data-vivo="${id}"></div>`);
      else out.push(`<pre><code>${corpo.join('\n')}\n</code></pre>`);
      continue;
    }

    // Régua.
    if (/^\s*---\s*$/.test(l)) { out.push('<hr />'); i++; continue; }

    // Título.
    const th = l.match(/^(#{1,3})\s+(.*)$/);
    if (th) { const n = th[1].length; out.push(`<h${n}>${inline(th[2].trim())}</h${n}>`); i++; continue; }

    // Citação (uma ou mais linhas iniciadas por >, já escapado para &gt;).
    if (/^\s*&gt;\s?/.test(l)) {
      const corpo = [];
      while (i < linhas.length && /^\s*&gt;\s?/.test(linhas[i])) {
        corpo.push(linhas[i].replace(/^\s*&gt;\s?/, '')); i++;
      }
      out.push(`<blockquote>${inline(corpo.join(' '))}</blockquote>`);
      continue;
    }

    // Tabela GFM: linha com | seguida de uma linha separadora |---|.
    if (l.includes('|') && i + 1 < linhas.length &&
        /^\s*\|?[\s:|-]+\|?\s*$/.test(linhas[i + 1]) && linhas[i + 1].includes('-')) {
      const celulas = (linha) => linha.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const cab = celulas(l);
      i += 2;
      const corpo = [];
      while (i < linhas.length && linhas[i].includes('|') && linhas[i].trim()) {
        corpo.push(celulas(linhas[i])); i++;
      }
      out.push('<table><thead><tr>' + cab.map(c => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        corpo.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>');
      continue;
    }

    // Listas (um nível).
    const li = l.match(ITEM);
    if (li) {
      const tag = /\d/.test(li[1]) ? 'ol' : 'ul';
      out.push(`<${tag}>`);
      while (i < linhas.length) {
        const m = linhas[i].match(ITEM);
        if (!m) break;
        i++;
        // Linhas recuadas logo abaixo CONTINUAM o item (juntas por um espaço,
        // ainda como texto escapado: a formatação vem depois). Linha em
        // branco, ou sem recuo, encerra o item.
        let txt = m[2].trim();
        while (i < linhas.length && continuaItem(linhas[i])) { txt += ` ${linhas[i].trim()}`; i++; }
        out.push(`<li>${inline(txt)}</li>`);
      }
      out.push(`</${tag}>`);
      continue;
    }

    // Linha em branco.
    if (!l.trim()) { i++; continue; }

    // Parágrafo (junta linhas consecutivas de texto).
    const par = [l];
    i++;
    while (i < linhas.length && linhas[i].trim() &&
           !/^\s*(#{1,3}\s|[-*]\s|\d+\.\s|&gt;|```|---\s*$)/.test(linhas[i]) &&
           !linhas[i].includes('|')) {
      par.push(linhas[i]); i++;
    }
    out.push(`<p>${inline(par.join(' '))}</p>`);
  }

  return out.join('');
}
