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
