// Tema (spec 2026-10-03, D10): a escolha gravada vence; sem ela, o sistema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverTema, decidirSincronismo, marcaValeParaUsuario } from '../src/core/tema.js';

test('a escolha gravada vence o sistema', () => {
  assert.equal(resolverTema('claro', true), 'claro');
  assert.equal(resolverTema('escuro', false), 'escuro');
});

test('sem escolha, segue o sistema', () => {
  assert.equal(resolverTema(null, true), 'escuro');
  assert.equal(resolverTema(null, false), 'claro');
});

test('valor estranho gravado é como não ter escolha', () => {
  assert.equal(resolverTema('roxo', false), 'claro');
  assert.equal(resolverTema('', true), 'escuro');
});

// Login: o que fazer com o tema da conta (spec 2026-10-03, D10).
test('sem marca pendente, a conta com tema diferente do local é adotada', () => {
  assert.equal(decidirSincronismo({ daConta: 'escuro', local: 'claro', pendente: false }), 'adotar');
  assert.equal(decidirSincronismo({ daConta: 'escuro', local: null, pendente: false }), 'adotar');
});

test('sem marca pendente, conta igual, ausente ou estranha não muda nada', () => {
  assert.equal(decidirSincronismo({ daConta: 'claro', local: 'claro', pendente: false }), 'nada');
  assert.equal(decidirSincronismo({ daConta: undefined, local: 'escuro', pendente: false }), 'nada');
  assert.equal(decidirSincronismo({ daConta: 'roxo', local: 'claro', pendente: false }), 'nada');
});

test('com marca pendente, a escolha daqui vale e a conta é que se atualiza', () => {
  assert.equal(decidirSincronismo({ daConta: 'claro', local: 'escuro', pendente: true }), 'reenviar');
  assert.equal(decidirSincronismo({ daConta: undefined, local: 'escuro', pendente: true }), 'reenviar');
});

test('com marca pendente mas conta já igual, não há o que reenviar', () => {
  assert.equal(decidirSincronismo({ daConta: 'escuro', local: 'escuro', pendente: true }), 'nada');
});

test('marca pendente sem escolha local não segura nada: adota a conta', () => {
  assert.equal(decidirSincronismo({ daConta: 'escuro', local: null, pendente: true }), 'adotar');
});

// A marca pendente tem dono: { email, tema } (rodada final, item 1.1).
test('marca do próprio usuário, com o tema que está no local, vale', () => {
  const marca = { email: 'a@exemplo.com', tema: 'escuro' };
  assert.equal(marcaValeParaUsuario(marca, 'a@exemplo.com', 'escuro'), true);
  assert.equal(marcaValeParaUsuario(marca, 'A@Exemplo.com', 'escuro'), true);
});

test('marca de OUTRO e-mail não vale para quem entrou', () => {
  const marca = { email: 'a@exemplo.com', tema: 'escuro' };
  assert.equal(marcaValeParaUsuario(marca, 'b@exemplo.com', 'escuro'), false);
});

test('marca "1" antiga, ausente ou malformada não vale', () => {
  assert.equal(marcaValeParaUsuario('1', 'a@exemplo.com', 'escuro'), false);
  assert.equal(marcaValeParaUsuario(null, 'a@exemplo.com', 'escuro'), false);
  assert.equal(marcaValeParaUsuario({ tema: 'escuro' }, 'a@exemplo.com', 'escuro'), false);
  assert.equal(marcaValeParaUsuario({ email: 'a@exemplo.com' }, 'a@exemplo.com', 'escuro'), false);
});

test('marca com tema diferente do local não vale (houve outra troca depois)', () => {
  const marca = { email: 'a@exemplo.com', tema: 'claro' };
  assert.equal(marcaValeParaUsuario(marca, 'a@exemplo.com', 'escuro'), false);
});

test('sem e-mail de quem entrou, nenhuma marca vale', () => {
  const marca = { email: 'a@exemplo.com', tema: 'escuro' };
  assert.equal(marcaValeParaUsuario(marca, null, 'escuro'), false);
  assert.equal(marcaValeParaUsuario(marca, undefined, 'escuro'), false);
});
