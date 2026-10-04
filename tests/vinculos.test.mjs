// Regras do vínculo que outras telas leem: quem é supervisão (não é equipe
// da escola) - spec 2026-10-03, D13.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eSupervisao, ordemNaEquipe, vinculosDeEquipe, soSupervisiona, vinculoDeSupervisao, rotuloDoVinculo } from '../src/modules/servidores/equipe.model.js';
import { rotulaVinculo, cargoExibidoDe } from '../src/modules/servidores/servidores.model.js';
import { temFuncao, funcaoValida, _gravarComFuncao, rotulaCargo, papelParaGravar } from '../src/modules/servidores/vinculos.model.js';

test('supervisão é reconhecida pelo rótulo canônico e pelo legado', () => {
  assert.equal(eSupervisao('Supervisor(a)'), true);
  assert.equal(eSupervisao('supervisor'), true);        // papel anterior à migration 023
  assert.equal(eSupervisao('Gestor(a)'), false);
  assert.equal(eSupervisao('Coordenador(a)'), false);
  assert.equal(eSupervisao(''), false);
  assert.equal(eSupervisao(null), false);
});

test('a função entra no rótulo do cargo, só para gestor', () => {
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)', funcao: 1 }), 'Gestor(a) 1');
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)', funcao: 2 }), 'Gestor(a) 2');
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)', funcao: null }), 'Gestor(a)');
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)' }), 'Gestor(a)');
  assert.equal(rotulaVinculo({ papel: 'Coordenador(a)', funcao: 1 }), 'Coordenador(a)');
  assert.equal(rotulaVinculo(null), '');
});

test('cargoExibidoDe junta os vínculos abertos, com a função', () => {
  const s = { vinculos: [
    { papel: 'Gestor(a)', funcao: 2, fim: null },
    { papel: 'Gestor(a)', funcao: 1, fim: '2026-01-31' },   // encerrado: fora
  ] };
  assert.equal(cargoExibidoDe(s), 'Gestor(a) 2');
});

test('só o cargo de gestor tem função', () => {
  assert.equal(temFuncao('Gestor(a)'), true);
  assert.equal(temFuncao('gestor'), true);            // legado
  assert.equal(temFuncao('Coordenador(a)'), false);
  assert.equal(temFuncao(''), false);
});

test('o cargo digitado à mão é reconhecido sem distinção de caixa nem de espaços', () => {
  assert.equal(temFuncao('gestor(a)'), true);
  assert.equal(temFuncao('  Gestor(a)  '), true);
  assert.equal(temFuncao('GESTOR(A)'), true);
  assert.equal(temFuncao('Gestor  (a)'), false);      // espaço no meio não é o mesmo cargo
  assert.equal(temFuncao('Vice-gestor(a)'), false);
});

test('ordem da equipe: Gestor 1, Gestor 2, gestor sem função, coordenação, demais', () => {
  const ordem = [
    { papel: 'Secretário(a)' },
    { papel: 'Coordenador(a)' },
    { papel: 'Gestor(a)' },
    { papel: 'Gestor(a)', funcao: 2 },
    { papel: 'Gestor(a)', funcao: 1 },
  ].map(ordemNaEquipe);
  assert.deepEqual(ordem, [4, 3, 2, 1, 0]);
});

test('vinculosDeEquipe deixa de fora o encerrado e a supervisão', () => {
  const s = { vinculos: [
    { unidade_id: 'a', papel: 'Supervisor(a)', fim: null },
    { unidade_id: 'b', papel: 'Coordenador(a)', fim: null },
    { unidade_id: 'c', papel: 'Gestor(a)', fim: '2026-01-31' },
  ] };
  assert.deepEqual(vinculosDeEquipe(s).map(v => v.unidade_id), ['b']);
});

test('ordem da equipe reconhece o papel legado de gestor', () => {
  assert.equal(ordemNaEquipe({ papel: 'gestor', funcao: 1 }), 0);
});

test('funcaoValida aceita 1 e 2, inclusive como texto de um select', () => {
  assert.equal(funcaoValida(1), 1);
  assert.equal(funcaoValida('1'), 1);
  assert.equal(funcaoValida('2'), 2);
  for (const ruim of ['', null, undefined, 0, 3, 'x']) assert.equal(funcaoValida(ruim), null);
});

// gravar de mentira: devolve os resultados em ordem e guarda o que recebeu
const gravador = (...resultados) => {
  const chamadas = [];
  const gravar = async (row) => { chamadas.push(row); return resultados[chamadas.length - 1]; };
  return { gravar, chamadas };
};

test('gravarComFuncao: sucesso de primeira não refaz', async () => {
  const { gravar, chamadas } = gravador({ data: { id: 'a' }, error: null });
  const r = await _gravarComFuncao({ papel: 'x', funcao: null }, gravar);
  assert.equal(r.data.id, 'a');
  assert.equal(chamadas.length, 1);
});

test('gravarComFuncao: sem a coluna e sem função, refaz sem a chave', async () => {
  const { gravar, chamadas } = gravador({ error: { code: 'PGRST204' } }, { data: { id: 'b' }, error: null });
  const r = await _gravarComFuncao({ papel: 'x', funcao: null }, gravar);
  assert.equal(r.data.id, 'b');
  assert.equal(chamadas.length, 2);
  assert.equal('funcao' in chamadas[1], false);
  assert.equal(chamadas[1].papel, 'x');
});

test('gravarComFuncao: sem a coluna e com função, avisa em vez de gravar calado', async () => {
  const { gravar, chamadas } = gravador({ error: { code: 'PGRST204' } });
  await assert.rejects(_gravarComFuncao({ papel: 'Gestor(a)', funcao: 1 }, gravar),
    (e) => e.amigavel === true && e.code === 'PGRST204');
  assert.equal(chamadas.length, 1);
});

test('gravarComFuncao: outro erro volta como veio, sem refazer', async () => {
  const { gravar, chamadas } = gravador({ error: { code: '23505' } });
  const r = await _gravarComFuncao({ papel: 'x', funcao: null }, gravar);
  assert.equal(r.error.code, '23505');
  assert.equal(chamadas.length, 1);
});

test('gravarComFuncao: patch sem a chave funcao não tem o que refazer', async () => {
  const { gravar, chamadas } = gravador({ error: { code: 'PGRST204' } });
  const r = await _gravarComFuncao({ papel: 'Gestor(a)' }, gravar);
  assert.equal(r.error.code, 'PGRST204');
  assert.equal(chamadas.length, 1);
});

// ── Horários sem supervisão (D14) ───────────────────────────
const unidade = (id) => ({ unidade_id: id, unidade: { id } });

test('vinculosDeEquipe deixa a supervisão de fora e mantém o resto', () => {
  const s = { vinculos: [
    { papel: 'Supervisor(a)', fim: null, ...unidade('esc-a') },
    { papel: 'Coordenador(a)', fim: null, ...unidade('esc-b') },
    { papel: 'Gestor(a)', fim: '2026-01-31', ...unidade('esc-c') },   // encerrado
  ] };
  assert.deepEqual(vinculosDeEquipe(s).map(v => v.unidade_id), ['esc-b']);
  assert.deepEqual(vinculosDeEquipe({ vinculos: [{ papel: 'supervisor', fim: null, ...unidade('esc-a') }] }), []);
});

test('soSupervisiona: a escola só supervisionada não é local de jornada', () => {
  const s = { vinculos: [
    { papel: 'Supervisor(a)', fim: null, ...unidade('esc-a') },
    { papel: 'Coordenador(a)', fim: null, ...unidade('esc-b') },
    { papel: 'Supervisor(a)', fim: null, ...unidade('esc-b') },      // coordena E supervisiona a mesma
    { papel: 'Supervisor(a)', fim: '2026-01-31', ...unidade('esc-d') },   // encerrado
  ] };
  assert.equal(soSupervisiona(s, 'esc-a'), true);
  assert.equal(soSupervisiona(s, 'esc-b'), false);    // é equipe lá
  assert.equal(soSupervisiona(s, 'esc-c'), false);    // sem vínculo nenhum
  assert.equal(soSupervisiona(s, 'esc-d'), false);    // supervisão já encerrada
});

// ── Supervisão é regra do VÍNCULO (correção de 03/10/2026) ──
test('vinculoDeSupervisao: cargo de supervisão só conta numa escola', () => {
  const v = (papel, tipo) => ({ papel, unidade: tipo ? { tipo } : undefined });
  assert.equal(vinculoDeSupervisao(v('Supervisor(a)', 'escola')), true);
  assert.equal(vinculoDeSupervisao(v('Supervisor(a)', 'sede')), false);      // trabalha na Secretaria
  assert.equal(vinculoDeSupervisao(v('Supervisor(a)', 'interno')), false);
  assert.equal(vinculoDeSupervisao(v('Supervisor(a)')), true);               // sem unidade/tipo: conta como escola
  assert.equal(vinculoDeSupervisao(v('Coordenador(a)', 'escola')), false);
  assert.equal(vinculoDeSupervisao(v('supervisor', 'escola')), true);        // legado
});

test('o supervisor aparece pelo local de trabalho na Secretaria, não pelas escolas', () => {
  const s = { vinculos: [
    { papel: 'Supervisor(a)', fim: null, unidade_id: 'esc-a', unidade: { id: 'esc-a', tipo: 'escola' } },
    { papel: 'Supervisor(a)', fim: null, unidade_id: 'sede', unidade: { id: 'sede', tipo: 'sede' } },
  ] };
  assert.deepEqual(vinculosDeEquipe(s).map(v => v.unidade_id), ['sede']);
  assert.equal(soSupervisiona(s, 'sede'), false);
  assert.equal(soSupervisiona(s, 'esc-a'), true);
});

test('rotuloDoVinculo normaliza o cargo legado e leva a função do gestor', () => {
  assert.equal(rotuloDoVinculo({ papel: 'gestor', funcao: 1 }), 'Gestor(a) 1');
  assert.equal(rotuloDoVinculo({ papel: 'Coordenador(a)' }), 'Coordenador(a)');
  assert.equal(rotuloDoVinculo(null), '');
});

// O banco exige papel = 'Gestor(a)' EXATO (CHECK e função SQL); a tela e o
// model reconhecem o gestor sem caixa nem espaços. O que se grava é a forma
// exata (rodada final, item 2.2).
test('o cargo de gestor é gravado na forma exata, qualquer que seja a digitação', () => {
  assert.equal(papelParaGravar('gestor(a)'), 'Gestor(a)');
  assert.equal(papelParaGravar(' GESTOR(A) '), 'Gestor(a)');
  assert.equal(papelParaGravar('gestor'), 'Gestor(a)');         // legado
  assert.equal(papelParaGravar('Gestor(a)'), 'Gestor(a)');
});

test('os demais cargos são gravados normalizados, sem mudar a caixa', () => {
  assert.equal(papelParaGravar('  Vice-diretor(a)  '), 'Vice-diretor(a)');
  assert.equal(papelParaGravar('Coordenador(a)   Pedagógico(a)'), 'Coordenador(a) Pedagógico(a)');
});

// Cargo é texto livre: um nome que existe em Object.prototype não é legado.
test('cargo digitado com nome de propriedade herdada volta como veio', () => {
  assert.equal(rotulaCargo('constructor'), 'constructor');
  assert.equal(rotulaCargo('toString'), 'toString');
  assert.equal(rotulaCargo('gestor'), 'Gestor(a)');
  assert.equal(rotulaCargo(null), '');
  assert.equal(temFuncao('toString'), false);
  assert.equal(temFuncao('constructor'), false);
});
