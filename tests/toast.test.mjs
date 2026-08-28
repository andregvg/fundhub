import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTipo, duracaoPadrao } from '../src/shared/ui/toast.js';

test('os quatro tipos semanticos passam intactos', () => {
  for (const t of ['sucesso', 'atencao', 'erro', 'info']) {
    assert.equal(normalizarTipo(t), t);
  }
});

test('o vocabulario antigo das notificacoes continua valendo', () => {
  assert.equal(normalizarTipo('ok'), 'sucesso');
  assert.equal(normalizarTipo('no'), 'erro');
  assert.equal(normalizarTipo('del'), 'erro');
  assert.equal(normalizarTipo('upd'), 'atencao');
  assert.equal(normalizarTipo('novo'), 'info');
});

test('tipo desconhecido ou ausente vira info', () => {
  assert.equal(normalizarTipo('qualquer'), 'info');
  assert.equal(normalizarTipo(undefined), 'info');
  assert.equal(normalizarTipo(null), 'info');
});

test('erro dura mais que os outros, porque erro precisa ser lido', () => {
  assert.equal(duracaoPadrao('erro'), 8000);
  assert.equal(duracaoPadrao('atencao'), 6000);
  assert.equal(duracaoPadrao('sucesso'), 5000);
  assert.equal(duracaoPadrao('info'), 5000);
});

test('duracao de tipo desconhecido cai no padrao', () => {
  assert.equal(duracaoPadrao('qualquer'), 5000);
});
