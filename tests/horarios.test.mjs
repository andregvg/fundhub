import test from 'node:test';
import assert from 'node:assert/strict';
import { validarDia, paraMin } from '../src/modules/horarios/horarios.model.js';

const b = (inicio, fim) => ({ inicio, fim });
const acha = (probs, codigo) => probs.find(p => p.codigo === codigo);

test('dia vazio nao tem problema', () => {
  assert.deepEqual(validarDia([]), []);
});

test('jornada normal de 8h partida em dois blocos nao acusa nada', () => {
  assert.deepEqual(validarDia([b('07:00', '11:00'), b('12:00', '16:00')]), []);
});

test('sobreposicao e ERRO e marca a intersecao', () => {
  const p = acha(validarDia([b('07:00', '12:00'), b('11:00', '15:00')]), 'sobreposicao');
  assert.equal(p.nivel, 'erro');
  assert.equal(p.ini, paraMin('11:00'));
  assert.equal(p.fim, paraMin('12:00'));
});

test('sobreposicao total marca o bloco contido inteiro', () => {
  const p = acha(validarDia([b('07:00', '15:00'), b('09:00', '10:00')]), 'sobreposicao');
  assert.equal(p.ini, paraMin('09:00'));
  assert.equal(p.fim, paraMin('10:00'));
});

test('mais de 8h no dia e AVISO, nao erro', () => {
  const p = acha(validarDia([b('07:00', '12:00'), b('13:00', '17:00')]), 'carga-dia');
  assert.equal(p.nivel, 'aviso');
});

test('as 8h marcam os minutos excedentes, contados do fim para tras', () => {
  // 07:00-12:00 (5h) + 13:00-17:00 (4h) = 9h. Excesso: 1h.
  // A ultima hora trabalhada vai das 16:00 as 17:00.
  const p = acha(validarDia([b('07:00', '12:00'), b('13:00', '17:00')]), 'carga-dia');
  assert.equal(p.ini, paraMin('16:00'));
  assert.equal(p.fim, paraMin('17:00'));
});

test('o excesso de carga atravessa o intervalo quando precisa', () => {
  // 07:00-12:00 (5h) + 13:00-17:30 (4h30) = 9h30. Excesso: 1h30.
  // 17:30 menos 1h30 = 16:00 - cabe no ultimo trecho, sem atravessar.
  const p = acha(validarDia([b('07:00', '12:00'), b('13:00', '17:30')]), 'carga-dia');
  assert.equal(p.ini, paraMin('16:00'));
  assert.equal(p.fim, paraMin('17:30'));
});

test('excesso maior que o ultimo trecho continua no trecho anterior', () => {
  // 07:00-12:00 (5h) + 13:00-17:00 (4h) + 18:00-19:00 (1h) = 10h. Excesso: 2h.
  // Ultimo trecho da 1h; falta 1h, que vem do fim do trecho anterior (16:00-17:00).
  const probs = validarDia([b('07:00', '12:00'), b('13:00', '17:00'), b('18:00', '19:00')]);
  const p = acha(probs, 'carga-dia');
  assert.equal(p.ini, paraMin('16:00'));
  assert.equal(p.fim, paraMin('19:00'));
});

test('mais de 6h continuas e AVISO e marca so o que passa das 6h', () => {
  // 07:00-14:00 = 7h continuas. As 6h terminam as 13:00.
  const p = acha(validarDia([b('07:00', '14:00')]), 'continuo');
  assert.equal(p.nivel, 'aviso');
  assert.equal(p.ini, paraMin('13:00'));
  assert.equal(p.fim, paraMin('14:00'));
});

test('blocos encostados contam como um trecho continuo so', () => {
  // 07:00-10:00 + 10:00-14:00 nao tem intervalo: sao 7h continuas.
  const p = acha(validarDia([b('07:00', '10:00'), b('10:00', '14:00')]), 'continuo');
  assert.ok(p, 'blocos colados deveriam acusar trecho continuo');
  assert.equal(p.ini, paraMin('13:00'));
});

test('exatamente 6h continuas nao acusa', () => {
  assert.equal(acha(validarDia([b('07:00', '13:00')]), 'continuo'), undefined);
});

test('exatamente 8h no dia nao acusa', () => {
  assert.equal(acha(validarDia([b('07:00', '11:00'), b('12:00', '16:00')]), 'carga-dia'), undefined);
});

test('todo problema traz intervalo utilizavel', () => {
  const probs = validarDia([b('07:00', '15:00'), b('14:00', '18:00')]);
  assert.ok(probs.length);
  for (const p of probs) {
    assert.equal(typeof p.ini, 'number');
    assert.equal(typeof p.fim, 'number');
    assert.ok(p.fim > p.ini, `intervalo vazio em ${p.codigo}`);
    assert.ok(p.texto.length > 0);
  }
});
