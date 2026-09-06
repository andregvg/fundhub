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

// ── E.164: o formato de gravação ──────────────────────────────
// O banco guardava o número FORMATADO, e o preço era a ambiguidade de
// '3333-3333': sem saber se os dois primeiros dígitos são DDD ou prefixo,
// não há como formatar sem chutar. Com o código do país explícito, o que
// está gravado sempre diz o que é.
import { paraE164, deE164, exibirTelefone, formatarTelefone } from '../src/shared/ui/phones.js';

test('paraE164 sobe a escada de tamanhos: local, com DDD, com pais', () => {
  assert.equal(paraE164('33333333'), '+551633333333', '8 digitos: falta DDD e pais');
  assert.equal(paraE164('999999999'), '+5516999999999', '9 digitos: idem');
  assert.equal(paraE164('(16) 3333-3333'), '+551633333333', '10 digitos: falta so o pais');
  assert.equal(paraE164('(16) 99999-9999'), '+5516999999999', '11 digitos: idem');
  assert.equal(paraE164('+55 16 99999-9999'), '+5516999999999', '13 digitos: so falta o +');
  assert.equal(paraE164('5516999999999'), '+5516999999999');
});

test('paraE164 nao inventa numero que nao da para afirmar', () => {
  assert.equal(paraE164(''), '');
  assert.equal(paraE164(null), '');
  assert.equal(paraE164('1234'), '', 'curto demais para saber o que e');
  assert.equal(paraE164('12345678901234567'), '', 'longo demais');
});

test('paraE164 e idempotente - gravar de novo nao empilha prefixo', () => {
  const uma = paraE164('(16) 99999-9999');
  assert.equal(paraE164(uma), uma);
});

test('deE164 devolve os digitos nacionais para a mascara brasileira', () => {
  assert.equal(deE164('+5516999999999'), '16999999999');
  assert.equal(deE164('+551633333333'), '1633333333');
});

test('numero de fora do Brasil volta inteiro, nao fatiado num formato que nao e o dele', () => {
  assert.equal(deE164('+34900000000'), '+34900000000');
  assert.equal(exibirTelefone('+34900000000'), '+34900000000');
});

test('legado ainda nao migrado atravessa sem quebrar a tela', () => {
  assert.equal(deE164('(16) 3333-3333'), '(16) 3333-3333');
  assert.equal(exibirTelefone('(16) 3333-3333'), '(16) 3333-3333');
});

// A janela entre o deploy e a migration 029: parte da base foi cadastrada
// SEM DDD, e formatar direto leria os dois primeiros digitos como DDD.
test('legado sem DDD ganha o DDD padrao na exibicao, nao le o prefixo como DDD', () => {
  assert.equal(exibirTelefone('3333-3333'), '(16) 3333-3333');
  assert.equal(exibirTelefone('99999-9999'), '(16) 99999-9999');
});

test('exibirTelefone: o que a pessoa le, a partir do que esta gravado', () => {
  assert.equal(exibirTelefone('+5516999999999'), '(16) 99999-9999');
  assert.equal(exibirTelefone('+551633333333'), '(16) 3333-3333');
  assert.equal(exibirTelefone(''), '');
});

test('ida e volta: o que se digita, se grava e se le e o mesmo numero', () => {
  for (const digitado of ['(16) 99999-9999', '(16) 3333-3333', '99999-9999', '3333-3333']) {
    const gravado = paraE164(digitado);
    assert.ok(gravado.startsWith('+55'), `${digitado} -> ${gravado}`);
    assert.equal(exibirTelefone(gravado), formatarTelefone(deE164(gravado)));
    assert.equal(paraE164(exibirTelefone(gravado)), gravado);
  }
});
