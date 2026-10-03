// Regras do vínculo que outras telas leem: quem é supervisão (não é equipe
// da escola) - spec 2026-10-03, D13.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eSupervisao } from '../src/modules/servidores/equipe.model.js';

test('supervisão é reconhecida pelo rótulo canônico e pelo legado', () => {
  assert.equal(eSupervisao('Supervisor(a)'), true);
  assert.equal(eSupervisao('supervisor'), true);        // papel anterior à migration 023
  assert.equal(eSupervisao('Gestor(a)'), false);
  assert.equal(eSupervisao('Coordenador(a)'), false);
  assert.equal(eSupervisao(''), false);
  assert.equal(eSupervisao(null), false);
});
