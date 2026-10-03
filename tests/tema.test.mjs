// Tema (spec 2026-10-03, D10): a escolha gravada vence; sem ela, o sistema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverTema } from '../src/core/tema.js';

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
