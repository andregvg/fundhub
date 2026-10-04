import test from 'node:test';
import assert from 'node:assert/strict';
import { valorDoCampo, algumMudou, registrarBase } from '../src/shared/ui/modal.js';

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

// Gesto da pessoa que o código atende escrevendo no campo (clique no mapa,
// data pelo calendário): a base é tirada ANTES da escrita, como o toque faria.
test('registrarBase: guarda o valor de antes e a escrita seguinte conta como mudança', () => {
  const lat = campo({ value: '-21.17' });
  const bases = new Map();
  registrarBase(bases, lat);
  lat.value = '-21.18';                          // o código escreve em resposta ao clique
  assert.equal(algumMudou(bases), true);
});

test('registrarBase: não sobrescreve a base já tirada', () => {
  const lat = campo({ value: 'a' });
  const bases = new Map();
  registrarBase(bases, lat);
  lat.value = 'b';
  registrarBase(bases, lat);                     // segundo gesto: a base continua "a"
  assert.equal(bases.get(lat), 'a');
  lat.value = 'a';
  assert.equal(algumMudou(bases), false);
});

test('registrarBase: num grupo de rádio, registra o grupo inteiro', () => {
  const a = campo({ type: 'radio', name: 'g', checked: true });
  const b = campo({ type: 'radio', name: 'g', checked: false });
  const outro = campo({ type: 'radio', name: 'h', checked: true });
  const form = { elements: [a, b, outro] };
  a.form = b.form = outro.form = form;
  const bases = new Map();
  registrarBase(bases, b);
  assert.equal(bases.get(a), true);
  assert.equal(bases.get(b), false);
  assert.equal(bases.has(outro), false);
});
