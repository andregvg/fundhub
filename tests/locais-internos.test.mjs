import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eLocalInterno, ordenarLocais } from '../src/modules/escolas/escolas.model.js';

test('eLocalInterno: escola é falso, sede e interno são verdadeiros', () => {
  assert.equal(eLocalInterno({ tipo: 'escola' }), false);
  assert.equal(eLocalInterno({ tipo: 'sede' }), true);
  assert.equal(eLocalInterno({ tipo: 'interno' }), true);
  assert.equal(eLocalInterno(null), true); // sem tipo, trata como não-escola
});

test('ordenarLocais: sede, depois internos alfabéticos, depois escolas alfabéticas', () => {
  const r = ordenarLocais([
    { nome: 'Escola B', tipo: 'escola' },
    { nome: 'Subsecretaria Z', tipo: 'interno' },
    { nome: 'SME - Sede', tipo: 'sede' },
    { nome: 'Escola A', tipo: 'escola' },
    { nome: 'Gerência A', tipo: 'interno' },
  ]).map(x => x.nome);
  assert.deepEqual(r, ['SME - Sede', 'Gerência A', 'Subsecretaria Z', 'Escola A', 'Escola B']);
});
