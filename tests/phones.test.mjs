// Bloco I: o editor de telefones usa os ícones do hub, não glifos de
// texto (× / +).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phonesEditorHtml } from '../src/shared/ui/phones.js';

test('o botão de remover telefone usa a lixeira, não um × de texto', () => {
  const html = phonesEditorHtml([{ numero: '(16) 3333-3333', tipo: 'fixo' }]);
  const botao = html.match(/<button[^>]*phone-del[\s\S]*?<\/button>/)[0];
  assert.ok(botao.includes('mini-btn no'), 'usa a classe padrão de excluir');
  assert.ok(/<svg[\s\S]*<\/svg>/.test(botao), 'contém um <svg>');
  assert.ok(!botao.includes('×'), 'nenhum × de texto');
});

test('o botão de adicionar telefone usa o ícone +, não texto', () => {
  const html = phonesEditorHtml([]);
  const botao = html.match(/<button[^>]*phone-add[\s\S]*?<\/button>/)[0];
  assert.ok(/<svg[\s\S]*<\/svg>/.test(botao), 'contém um <svg>');
  assert.ok(!/\+\s*telefone/.test(botao), 'nenhum "+ telefone" de texto');
});
