import test from 'node:test';
import assert from 'node:assert/strict';
import { valorDoCampo, algumMudou } from '../src/shared/ui/modal.js';

const campo = (props) => ({ type: 'text', value: '', checked: false, ...props });

test('valorDoCampo: checked para caixa e radio, value para o resto', () => {
  assert.equal(valorDoCampo(campo({ type: 'checkbox', checked: true })), true);
  assert.equal(valorDoCampo(campo({ type: 'radio', checked: false })), false);
  assert.equal(valorDoCampo(campo({ value: 'abc' })), 'abc');
  assert.equal(valorDoCampo(campo({ type: 'select-one', value: '2' })), '2');
});

test('algumMudou: só o que difere da base do primeiro toque', () => {
  const a = campo({ value: 'x' }), b = campo({ type: 'checkbox', checked: false });
  const bases = new Map([[a, 'x'], [b, false]]);
  assert.equal(algumMudou(bases), false);
  a.value = 'xy';
  assert.equal(algumMudou(bases), true);
  a.value = 'x';                       // digitou e apagou: limpo de novo
  assert.equal(algumMudou(bases), false);
  b.checked = true;
  assert.equal(algumMudou(bases), true);
});

test('algumMudou: campo que saiu do DOM não conta; mapa vazio é limpo', () => {
  const a = campo({ value: 'novo', isConnected: false });
  assert.equal(algumMudou(new Map([[a, 'velho']])), false);
  assert.equal(algumMudou(new Map()), false);
});
