import test from 'node:test';
import assert from 'node:assert/strict';
import { ico, TEM_ICONE, NOMES } from '../src/shared/ui/icones.js';

test('devolve um svg com o tamanho pedido', () => {
  const svg = ico('escola', { tam: 20 });
  assert.match(svg, /^<svg /);
  assert.match(svg, /width="20"/);
  assert.match(svg, /height="20"/);
  assert.match(svg, /viewBox="0 0 24 24"/);
});

test('herda a cor do texto e nunca fixa cor', () => {
  const svg = ico('escola');
  assert.match(svg, /stroke="currentColor"/);
  assert.match(svg, /fill="none"/);
  assert.doesNotMatch(svg, /#[0-9a-fA-F]{3,6}/);
  assert.doesNotMatch(svg, /rgb\(|hsl\(/);
});

test('e sempre decorativo para o leitor de tela', () => {
  assert.match(ico('escola'), /aria-hidden="true"/);
});

test('tamanho padrao e 16', () => {
  assert.match(ico('escola'), /width="16"/);
});

test('tem o traçado de configuração (engrenagem)', () => {
  assert.ok(TEM_ICONE('config'));
  assert.match(ico('config'), /^<svg /);
});

test('aceita classe extra sem perder a classe base', () => {
  const svg = ico('escola', { classe: 'nav-ico' });
  assert.match(svg, /class="ico nav-ico"/);
});

test('nome desconhecido devolve string vazia, sem lancar', () => {
  assert.equal(ico('nao-existe'), '');
  assert.equal(TEM_ICONE('nao-existe'), false);
  assert.equal(TEM_ICONE('escola'), true);
});

test('nome herdado de Object.prototype nao vaza pro svg', () => {
  for (const n of ['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__']) {
    assert.equal(ico(n), '', `ico('${n}') deveria ser string vazia`);
    assert.equal(TEM_ICONE(n), false, `TEM_ICONE('${n}') deveria ser false`);
  }
});

test('todos os icones do conjunto produzem svg', () => {
  const nomes = ['escola', 'sede', 'servidor', 'equipe', 'horario', 'calendario',
    'afastamento', 'transporte', 'dashboard', 'modulos', 'ata', 'ocorrencia',
    'projeto', 'visita', 'acesso', 'auditoria', 'docs', 'sino', 'editar',
    'excluir', 'buscar', 'adicionar', 'fechar', 'ok', 'atencao', 'erro',
    'restrito', 'menu', 'perdido', 'vazio', 'fixo', 'celular', 'whatsapp',
    'email', 'documento', 'arquivo', 'identidade', 'imprimir', 'tema',
    'noturno', 'subir', 'meta', 'parceria', 'obra', 'infantil',
    'acessibilidade', 'destaque', 'atualizar', 'sair', 'chevron', 'info', 'arrastar',
    'config'];
  for (const n of nomes) {
    assert.ok(ico(n).startsWith('<svg '), `icone ausente: ${n}`);
  }
  // Verifica se ha tracados orfaos nao consumidos pela lista.
  const extras = NOMES.filter(n => !nomes.includes(n));
  assert.deepEqual(extras, [], `tracado sem consumidor no conjunto: ${extras.join(', ')}`);
});
