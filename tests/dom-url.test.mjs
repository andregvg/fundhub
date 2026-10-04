// urlSegura: o que pode virar href quando o valor é uma URL livre digitada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlSegura } from '../src/shared/dom.js';

test('aceita http e https, em qualquer caixa', () => {
  assert.equal(urlSegura('http://exemplo.com'), true);
  assert.equal(urlSegura('https://exemplo.com/pagina?x=1'), true);
  assert.equal(urlSegura('HTTPS://exemplo.com'), true);
});

test('recusa esquema perigoso, relativo ao protocolo ou sem esquema', () => {
  assert.equal(urlSegura('javascript:alert(1)'), false);
  assert.equal(urlSegura('data:text/html,<b>x</b>'), false);
  assert.equal(urlSegura('//exemplo.com'), false);
  assert.equal(urlSegura('exemplo.com'), false);
});

test('recusa vazio, nulo e espaço antes do esquema', () => {
  assert.equal(urlSegura(''), false);
  assert.equal(urlSegura(null), false);
  assert.equal(urlSegura(undefined), false);
  assert.equal(urlSegura(' https://exemplo.com'), false);
  assert.equal(urlSegura(' javascript:alert(1)'), false);
});
