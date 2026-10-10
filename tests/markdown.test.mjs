import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownParaHtml } from '../src/modules/ajuda/markdown.js';

test('escapa HTML antes de formatar - <script> vira texto', () => {
  const html = markdownParaHtml('um <script>alert(1)</script> perdido');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('títulos # a ###', () => {
  const h = markdownParaHtml('# Um\n## Dois\n### Três');
  assert.match(h, /<h1>Um<\/h1>/);
  assert.match(h, /<h2>Dois<\/h2>/);
  assert.match(h, /<h3>Três<\/h3>/);
});

test('ênfase: forte, itálico e código inline', () => {
  const h = markdownParaHtml('isto é **forte**, isto *fraco* e isto `cod`');
  assert.match(h, /<strong>forte<\/strong>/);
  assert.match(h, /<em>fraco<\/em>/);
  assert.match(h, /<code>cod<\/code>/);
});

test('lista não ordenada e ordenada', () => {
  assert.match(markdownParaHtml('- a\n- b'), /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(markdownParaHtml('1. a\n2. b'), /<ol><li>a<\/li><li>b<\/li><\/ol>/);
});

test('tabela GFM', () => {
  const h = markdownParaHtml('| A | B |\n|---|---|\n| 1 | 2 |');
  assert.match(h, /<table>/);
  assert.match(h, /<th>A<\/th>/);
  assert.match(h, /<td>1<\/td>/);
});

test('citação vira bloco destacado', () => {
  assert.match(markdownParaHtml('> atenção aqui'), /<blockquote>[\s\S]*atenção aqui[\s\S]*<\/blockquote>/);
});

test('bloco de código cercado por três crases', () => {
  const h = markdownParaHtml('```\nlinha1\nlinha2\n```');
  assert.match(h, /<pre><code>linha1\nlinha2\n<\/code><\/pre>/);
  assert.doesNotMatch(markdownParaHtml('```\n**x**\n```'), /<strong>/);
});

test('link [texto](url) - só http(s) e hash', () => {
  assert.match(markdownParaHtml('[abrir](https://exemplo.com)'), /<a href="https:\/\/exemplo\.com"[^>]*>abrir<\/a>/);
  assert.match(markdownParaHtml('[ir](#/servidores)'), /<a href="#\/servidores">ir<\/a>/);
  assert.doesNotMatch(markdownParaHtml('[x](javascript:alert(1))'), /href="javascript/);
});

test('régua ---', () => {
  assert.match(markdownParaHtml('a\n\n---\n\nb'), /<hr\s*\/?>/);
});

test('parágrafo simples', () => {
  assert.match(markdownParaHtml('uma frase solta'), /<p>uma frase solta<\/p>/);
});

test('cerca vivo vira um bloco a preencher pela tela', () => {
  const h = markdownParaHtml('antes\n\n```vivo\npermissoes-padrao\n```\n\ndepois');
  assert.match(h, /<div class="md-vivo" data-vivo="permissoes-padrao"><\/div>/);
  assert.ok(!h.includes('<pre>'));
});

test('cerca vivo com id inválido continua sendo código', () => {
  const h = markdownParaHtml('```vivo\n<script>x</script>\n```');
  assert.ok(!h.includes('md-vivo'));
  assert.ok(h.includes('&lt;script&gt;'));
});

// ── Item de lista que continua na linha de baixo ─────────────
test('item numerado com continuação recuada não encerra a lista', () => {
  assert.equal(
    markdownParaHtml('1. Primeiro item que\n   continua na linha de baixo.\n2. Segundo item.\n3. Terceiro.'),
    '<ol><li>Primeiro item que continua na linha de baixo.</li><li>Segundo item.</li><li>Terceiro.</li></ol>');
});

test('item com marcador - também junta a continuação', () => {
  assert.equal(
    markdownParaHtml('- Primeiro item que\n  continua aqui.\n- Segundo.'),
    '<ul><li>Primeiro item que continua aqui.</li><li>Segundo.</li></ul>');
});

test('duas linhas de continuação seguidas entram no mesmo item', () => {
  assert.equal(
    markdownParaHtml('1. Um item\n   que segue\n   e ainda segue.\n2. Outro.'),
    '<ol><li>Um item que segue e ainda segue.</li><li>Outro.</li></ol>');
});

test('a continuação é formatada e escapada como o resto do item', () => {
  const h = markdownParaHtml('1. Clique em\n   **Salvar** e <b>x</b>.');
  assert.equal(h, '<ol><li>Clique em <strong>Salvar</strong> e &lt;b&gt;x&lt;/b&gt;.</li></ol>');
});

test('linha em branco encerra o item: o que vem depois é parágrafo', () => {
  assert.match(
    markdownParaHtml('1. Item.\n\n   texto solto depois.'),
    /^<ol><li>Item\.<\/li><\/ol><p>\s*texto solto depois\.<\/p>$/);
});

test('linha recuada que inicia outro bloco não é continuação', () => {
  // Novo item.
  assert.equal(markdownParaHtml('- a\n  - b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(markdownParaHtml('1. a\n   2. b'), '<ol><li>a</li><li>b</li></ol>');
  // Título, citação, cerca, tabela e régua: o item fica como estava.
  for (const bloco of ['  # Título', '  > citação', '  ```', '  | a | b |', '  ---']) {
    const h = markdownParaHtml(`- item\n${bloco}`);
    assert.ok(h.startsWith('<ul><li>item</li></ul>'), `${JSON.stringify(bloco)} → ${h}`);
  }
});

test('linha NÃO recuada depois de um item continua encerrando a lista', () => {
  assert.equal(
    markdownParaHtml('1. Item.\ntexto colado'),
    '<ol><li>Item.</li></ol><p>texto colado</p>');
});
