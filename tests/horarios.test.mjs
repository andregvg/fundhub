import test from 'node:test';
import assert from 'node:assert/strict';
import { validarDia, paraMin, ordenarParaGrade, SERIES } from '../src/modules/horarios/horarios.model.js';
import { empilhar, contarFaixas } from '../src/modules/horarios/grade.model.js';

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

test('com sobreposicao, a carga conta o tempo TRABALHADO, nao a soma dos blocos', () => {
  // 07:00-15:00 (8h) + 14:00-18:00 (4h) somam 12h de bloco, mas a pessoa
  // trabalhou 11h: das 14:00 as 15:00 ela esta em dois blocos ao mesmo tempo,
  // e isso e uma hora, nao duas. Excesso real: 3h, e nao 4h.
  // A grade desenha dado ja gravado, entao a sobreposicao chega aqui sem
  // ninguem ter barrado nada.
  const p = acha(validarDia([b('07:00', '15:00'), b('14:00', '18:00')]), 'carga-dia');
  assert.match(p.texto, /^11h no dia/, `carga inflada: ${p.texto}`);
  assert.match(p.texto, /- 3h /, `excesso inflado: ${p.texto}`);
  // 3h contadas de tras para frente a partir das 18:00.
  assert.equal(p.ini, paraMin('15:00'));
  assert.equal(p.fim, paraMin('18:00'));
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

// -- empilhar / contarFaixas --
const bl = (inicio, fim, id) => ({ id, inicio, fim });

test('blocos que nao se sobrepoem cabem todos na faixa 0', () => {
  const r = empilhar([bl('07:00', '11:00', 'a'), bl('12:00', '16:00', 'b')]);
  assert.deepEqual(r.map(x => x.faixa), [0, 0]);
  assert.equal(contarFaixas([bl('07:00', '11:00', 'a'), bl('12:00', '16:00', 'b')]), 1);
});

test('blocos sobrepostos vao para faixas diferentes', () => {
  const b2 = [bl('07:00', '12:00', 'a'), bl('11:00', '15:00', 'b')];
  const r = empilhar(b2);
  assert.equal(r.find(x => x.bloco.id === 'a').faixa, 0);
  assert.equal(r.find(x => x.bloco.id === 'b').faixa, 1);
  assert.equal(contarFaixas(b2), 2);
});

test('a faixa e reaproveitada assim que ela vaga', () => {
  // a 07-12 (faixa 0), b 11-15 (faixa 1), c 13-18 cabe na faixa 0 de novo.
  const b2 = [bl('07:00', '12:00', 'a'), bl('11:00', '15:00', 'b'), bl('13:00', '18:00', 'c')];
  const r = empilhar(b2);
  assert.equal(r.find(x => x.bloco.id === 'c').faixa, 0);
  assert.equal(contarFaixas(b2), 2);
});

test('blocos encostados dividem a mesma faixa', () => {
  const b2 = [bl('07:00', '11:00', 'a'), bl('11:00', '15:00', 'b')];
  assert.equal(contarFaixas(b2), 1);
});

test('tres sobrepostos ocupam tres faixas', () => {
  const b2 = [bl('07:00', '18:00', 'a'), bl('08:00', '17:00', 'b'), bl('09:00', '16:00', 'c')];
  assert.equal(contarFaixas(b2), 3);
});

test('lista vazia tem uma faixa, para a linha do dia nao colapsar', () => {
  assert.equal(contarFaixas([]), 1);
  assert.deepEqual(empilhar([]), []);
});

// -- ordenarParaGrade --
const CARGOS = new Set(['Gestor(a)', 'Coordenador(a)']);
const cargoDe = (s) => s.cargo;
const S = (id, nome, cargo) => ({ id, nome, cargo });

test('sem configuracao, so cargos de gestao aparecem, em ordem alfabetica de cargo e nome', () => {
  const r = ordenarParaGrade(
    [S('3', 'Gestor C', 'Coordenador(a)'), S('1', 'Gestor A', 'Gestor(a)'),
     S('2', 'Gestor B', 'Coordenador(a)'), S('4', 'Servidor D', 'Agente Escolar')],
    { exibicao: [], cargosGestao: CARGOS, cargoDe });
  assert.deepEqual(r.filter(x => x.exibir).map(x => x.servidor.id), ['2', '3', '1']);
  assert.equal(r.find(x => x.servidor.id === '4').exibir, false);
});

test('quem tem linha de exibicao aparece mesmo sem cargo de gestao', () => {
  const r = ordenarParaGrade(
    [S('4', 'Servidor D', 'Agente Escolar')],
    { exibicao: [{ servidor_id: '4', ordem: 0, conta_cobertura: true }], cargosGestao: CARGOS, cargoDe });
  assert.equal(r[0].exibir, true);
});

test('a ordem gravada vence a alfabetica', () => {
  const r = ordenarParaGrade(
    [S('1', 'Gestor A', 'Gestor(a)'), S('2', 'Gestor B', 'Coordenador(a)')],
    { exibicao: [{ servidor_id: '2', ordem: 0, conta_cobertura: true },
                 { servidor_id: '1', ordem: 1, conta_cobertura: true }],
      cargosGestao: CARGOS, cargoDe });
  assert.deepEqual(r.map(x => x.servidor.id), ['2', '1']);
});

test('conta_cobertura false e respeitado; sem linha, o padrao e contar', () => {
  const r = ordenarParaGrade(
    [S('1', 'Gestor A', 'Gestor(a)'), S('2', 'Gestor B', 'Coordenador(a)')],
    { exibicao: [{ servidor_id: '1', ordem: 0, conta_cobertura: false }],
      cargosGestao: CARGOS, cargoDe });
  assert.equal(r.find(x => x.servidor.id === '1').contaCobertura, false);
  assert.equal(r.find(x => x.servidor.id === '2').contaCobertura, true);
});

test('a serie e a posicao modulo 6, para a cor repetir sem confundir', () => {
  const servidores = Array.from({ length: 8 }, (_, i) => S(String(i), `Gestor ${i}`, 'Gestor(a)'));
  const exibicao = servidores.map((s, i) => ({ servidor_id: s.id, ordem: i, conta_cobertura: true }));
  const r = ordenarParaGrade(servidores, { exibicao, cargosGestao: CARGOS, cargoDe });
  assert.deepEqual(r.map(x => x.serie), [0, 1, 2, 3, 4, 5, 0, 1]);
});

test('a serie conta so quem e exibido; quem fica oculto nao consome cor', () => {
  // Intercala gestores (exibidos) com servidores de cargo comum (ocultos).
  // A serie de quem aparece precisa seguir 0,1,2,... sem pular nem repetir
  // por causa de quem esta escondido no meio.
  const cargosGestao = new Set(['Gestor(a)', 'Coordenador(a)', 'Supervisor(a)']);
  const servidores = [
    S('1', 'Gestor A', 'Gestor(a)'),
    S('2', 'Servidor Oculto B', 'Agente Escolar'),
    S('3', 'Gestor C', 'Coordenador(a)'),
    S('4', 'Servidor Oculto D', 'Agente Escolar'),
    S('5', 'Gestor E', 'Supervisor(a)'),
    S('6', 'Servidor Oculto F', 'Agente Escolar'),
  ];
  const r = ordenarParaGrade(servidores, { exibicao: [], cargosGestao, cargoDe });

  for (const it of r) {
    if (!it.exibir) assert.equal(it.serie, null);
  }
  const visiveis = r.filter(x => x.exibir);
  assert.deepEqual(visiveis.map(x => x.serie), visiveis.map((_, i) => i % SERIES));
});
