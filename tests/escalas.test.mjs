import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverEscala, escolherBlocos, diaDaSemana, jornadaEm, rotulaEscala }
  from '../src/modules/horarios/escalas.model.js';
import { gerarPropostaTDC } from '../src/modules/calendario/calendario.model.js';

// ── resolverEscala ──
test('sem nada, o dia e normal', () => {
  assert.equal(resolverEscala({ rede: null, override: undefined }), 'normal');
});

test('a rede define quando a escola nao remarcou', () => {
  assert.equal(resolverEscala({ rede: 'tdc-presencial', override: undefined }), 'tdc-presencial');
});

test('a escola remarcando vence a rede', () => {
  assert.equal(resolverEscala({ rede: 'tdc-presencial', override: { escala: 'tdc-virtual' } }), 'tdc-virtual');
});

test('a escola CANCELANDO vence a rede: linha com escala nula e normal', () => {
  // Distinguir "sem linha" (segue a rede) de "linha com null" (a escola
  // decidiu que aqui nao tem TDC) e o motivo de escala_unidade existir.
  assert.equal(resolverEscala({ rede: 'tdc-presencial', override: { escala: null } }), 'normal');
});

test('a escola pode marcar TDC num dia em que a rede nao tem', () => {
  assert.equal(resolverEscala({ rede: null, override: { escala: 'tdc-presencial' } }), 'tdc-presencial');
});

// ── escolherBlocos ──
const B = (escala, inicio) => ({ escala, inicio, fim: '12:00', dia_semana: 3 });

test('blocos da escala pedida sao usados quando existem', () => {
  const blocos = [B('normal', '07:00'), B('tdc-presencial', '08:00')];
  assert.deepEqual(escolherBlocos(blocos, 'tdc-presencial').map(b => b.inicio), ['08:00']);
});

test('sem bloco na escala, cai no normal - o fallback que poupa 140 gestores', () => {
  const blocos = [B('normal', '07:00')];
  assert.deepEqual(escolherBlocos(blocos, 'tdc-virtual').map(b => b.inicio), ['07:00']);
});

test('escala normal nunca cai em outra coisa', () => {
  const blocos = [B('tdc-presencial', '08:00')];
  assert.deepEqual(escolherBlocos(blocos, 'normal'), []);
});

test('lista vazia devolve lista vazia', () => {
  assert.deepEqual(escolherBlocos([], 'tdc-presencial'), []);
  assert.deepEqual(escolherBlocos(undefined, 'normal'), []);
});

// ── diaDaSemana ──
test('le o dia da semana sem passar pelo fuso', () => {
  // 2026-08-26 e uma quarta-feira.
  assert.equal(diaDaSemana('2026-08-26'), 3);
  assert.equal(diaDaSemana('2026-08-24'), 1);   // segunda
  assert.equal(diaDaSemana('2026-08-30'), 0);   // domingo
});

test('a data civil nao volta um dia - o bug classico do toISOString', () => {
  // Se a implementacao usasse new Date('2026-01-01') sem T00:00:00,
  // no fuso do Brasil isso viraria 31/12 e o dia da semana mudaria.
  assert.equal(diaDaSemana('2026-01-01'), 4);   // quinta
});

// ── jornadaEm ──
test('jornadaEm filtra por dia da semana e por escala, com fallback', () => {
  const blocos = [
    { escala: 'normal', dia_semana: 3, inicio: '07:00', fim: '13:00' },
    { escala: 'normal', dia_semana: 1, inicio: '08:00', fim: '14:00' },
    { escala: 'tdc-presencial', dia_semana: 3, inicio: '09:00', fim: '15:00' },
  ];
  // Quarta em TDC presencial: usa o bloco de tdc-presencial.
  assert.deepEqual(jornadaEm(blocos, { escala: 'tdc-presencial', dataISO: '2026-08-26' })
    .map(b => b.inicio), ['09:00']);
  // Quarta em TDC virtual: nao ha bloco tdc-virtual, cai no normal daquela quarta.
  assert.deepEqual(jornadaEm(blocos, { escala: 'tdc-virtual', dataISO: '2026-08-26' })
    .map(b => b.inicio), ['07:00']);
  // Segunda: nao e afetada pela escala.
  assert.deepEqual(jornadaEm(blocos, { escala: 'normal', dataISO: '2026-08-24' })
    .map(b => b.inicio), ['08:00']);
});

test('fim de semana nao tem jornada', () => {
  const blocos = [{ escala: 'normal', dia_semana: 3, inicio: '07:00', fim: '13:00' }];
  assert.deepEqual(jornadaEm(blocos, { escala: 'normal', dataISO: '2026-08-30' }), []);
});

// ── rótulos ──
test('as escalas tem rotulo legivel, pelo catalogo padrao', () => {
  assert.equal(rotulaEscala('normal'), 'Normal');
  assert.equal(rotulaEscala('tdc-presencial'), 'TDC Presencial');
  assert.equal(rotulaEscala('tdc-virtual'), 'TDC Virtual');
  assert.equal(rotulaEscala('inventada'), 'inventada');
});

test('rotulaEscala e pura: aceita um catalogo carregado do banco', () => {
  // O admin renomeou "TDC Presencial" para outro nome este ano - a
  // funcao nao pode depender do array fixo para refletir isso.
  const catalogo = [{ chave: 'tdc-presencial', rotulo: 'Reuniao Geral' }];
  assert.equal(rotulaEscala('tdc-presencial', catalogo), 'Reuniao Geral');
  assert.equal(rotulaEscala('normal', catalogo), 'normal');   // fora do catalogo passado
});

// ── gerarPropostaTDC ──
test('propoe as 1as e 3as quartas de cada mes', () => {
  const p = gerarPropostaTDC(2026, { naoLetivos: new Set() });
  const agosto = p.filter(x => x.data.startsWith('2026-08'));
  // Agosto/2026: quartas em 05, 12, 19, 26. 1a = 05, 3a = 19.
  assert.deepEqual(agosto.map(x => x.data), ['2026-08-05', '2026-08-19']);
});

test('alterna as duas escalas padrao ao longo do ano, sem reiniciar a cada mes', () => {
  const p = gerarPropostaTDC(2026, { naoLetivos: new Set() });
  assert.deepEqual(p.slice(0, 4).map(x => x.escala),
    ['tdc-presencial', 'tdc-virtual', 'tdc-presencial', 'tdc-virtual']);
});

test('a primeira do ano e sempre a primeira chave', () => {
  assert.equal(gerarPropostaTDC(2026, { naoLetivos: new Set() })[0].escala, 'tdc-presencial');
});

test('aceita um catalogo de chaves diferente, vindo do banco', () => {
  // Um ano com tres variantes de TDC em vez de duas - o gerador nao
  // pode ter 'tdc-presencial'/'tdc-virtual' chumbados.
  const p = gerarPropostaTDC(2026, { naoLetivos: new Set(), chaves: ['x', 'y', 'z'] });
  assert.deepEqual(p.slice(0, 4).map(x => x.escala), ['x', 'y', 'z', 'x']);
});

test('dia nao letivo e pulado, e a alternancia segue na sequencia que sobrou', () => {
  // Pulando a 1a quarta de agosto, a 3a (19/08) assume a vez dela.
  const cheio = gerarPropostaTDC(2026, { naoLetivos: new Set() });
  const vazado = gerarPropostaTDC(2026, { naoLetivos: new Set(['2026-08-05']) });
  assert.equal(vazado.some(x => x.data === '2026-08-05'), false);
  assert.equal(vazado.length, cheio.length - 1);
  const i = cheio.findIndex(x => x.data === '2026-08-05');
  assert.equal(vazado[i].data, '2026-08-19');
  assert.equal(vazado[i].escala, cheio[i].escala);
});

test('so devolve datas do ano pedido, e sempre em ordem', () => {
  const p = gerarPropostaTDC(2026, { naoLetivos: new Set() });
  assert.ok(p.every(x => x.data.startsWith('2026-')));
  const ordenado = [...p].sort((a, b) => a.data.localeCompare(b.data));
  assert.deepEqual(p, ordenado);
});

test('devolve 24 datas num ano sem nenhum nao letivo', () => {
  assert.equal(gerarPropostaTDC(2026, { naoLetivos: new Set() }).length, 24);
});
