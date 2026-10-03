// Tema (spec 2026-10-03, D10): a escolha gravada vence; sem ela, o sistema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverTema, decidirSincronismo } from '../src/core/tema.js';

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
