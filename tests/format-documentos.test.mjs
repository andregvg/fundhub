// Documentos: guardar canônico, exibir formatado.
// A máscara é affordance de interface; o formato de armazenamento é o
// dado. Estes testes fixam os dois lados e, principalmente, o que
// acontece com um valor que NÃO cabe no padrão paulista.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mascaraCPF, mascaraRG, cpfCru, rgCru, fmtCPF, fmtRG, noPadraoCPF, noPadraoRG,
} from '../src/shared/format.js';

test('cpfCru tira a pontuação e para nos 11 dígitos', () => {
  assert.equal(cpfCru('111.111.111-11'), '11111111111');
  assert.equal(cpfCru('11111111111'), '11111111111');
  assert.equal(cpfCru(''), '');
  assert.equal(cpfCru(null), '');
  assert.equal(cpfCru('111.111.111-11999'), '11111111111');
});

test('CPF: cru vira formatado e formatado volta a cru', () => {
  assert.equal(fmtCPF('11111111111'), '111.111.111-11');
  assert.equal(cpfCru(fmtCPF('11111111111')), '11111111111');
});

test('a máscara de CPF é idempotente - aplicar duas vezes não muda nada', () => {
  const uma = mascaraCPF('11111111111');
  assert.equal(mascaraCPF(uma), uma);
});

test('CPF incompleto é mascarado progressivamente, sem reclamar', () => {
  assert.equal(mascaraCPF('111'), '111');
  assert.equal(mascaraCPF('1111'), '111.1');
  assert.equal(mascaraCPF('1111111'), '111.111.1');
});

test('rgCru mantém o X do dígito verificador paulista, em caixa alta', () => {
  assert.equal(rgCru('11.111.111-x'), '11111111X');
  assert.equal(rgCru('11.111.111-1'), '111111111');
  assert.equal(rgCru(''), '');
});

test('RG: cru vira formatado e formatado volta a cru', () => {
  assert.equal(fmtRG('11111111X'), '11.111.111-X');
  assert.equal(rgCru(fmtRG('11111111X')), '11111111X');
});

// O caso que motivou fmt*: não existe padrão nacional de RG, e a máscara
// paulista corta em 9. Formatar cegamente esconderia um dígito na tela -
// e, pior, o valor cortado voltaria ao banco no próximo salvamento.
test('RG fora do padrão paulista aparece INTEIRO, sem truncar', () => {
  assert.equal(fmtRG('1234567890'), '1234567890');
  assert.equal(mascaraRG('1234567890'), '1234567890');
  assert.equal(rgCru('1234567890').length, 10);
});

test('CPF fora do padrão aparece cru, sem formatação parcial enganosa', () => {
  assert.equal(fmtCPF('123'), '123');
});

test('noPadrao* testa o CRU, que é o que vai ao banco', () => {
  assert.equal(noPadraoCPF('11111111111'), true);
  assert.equal(noPadraoCPF('111.111.111-11'), true, 'o valor do campo ainda vem mascarado');
  assert.equal(noPadraoCPF('123'), false);

  assert.equal(noPadraoRG('11111111X'), true);
  assert.equal(noPadraoRG('11.111.111-X'), true);
  assert.equal(noPadraoRG('1234567890'), false, 'RG de outro estado: aviso, não erro');
});

test('campo em branco passa - vazio não é errado (R15)', () => {
  for (const v of ['', null, undefined, '   ']) {
    assert.equal(noPadraoCPF(v), true);
    assert.equal(noPadraoRG(v), true);
  }
});
