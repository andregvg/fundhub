// ============================================================
// FundHub - shared/ui/campo-cep.js
// Campo de CEP: máscara enquanto se digita e consulta ao completar os
// oito dígitos (spec 2026-10-10-sate-endereco-e-cep, D5).
//
// É componente, e não função solta, porque tem comportamento (R12):
// descarta a resposta atrasada - a pessoa corrigiu o CEP antes de a
// primeira consulta voltar - e mantém o texto de estado em `dica`.
//
// `buscar` é INJETADO por quem usa: o kernel não importa modules/ (R1), e
// este arquivo não precisa saber de onde a resposta vem. O que fazer com
// ela (`aoAchar`) é de cada formulário.
//
//   ligarCep(input, { buscar, dica, aoAchar })
//     buscar(cep8)        → Promise<objeto | null>   (null = não existe)
//     dica                → elemento que recebe o texto de estado (aria-live)
//     aoAchar(r, dizer)   → dizer(texto, erro = false) escreve na dica
// ============================================================
import { mascaraCep, cepDe } from '../format.js';

export function ligarCep(input, { buscar, dica = null, aoAchar }) {
  let pedido = 0;
  // O CEP que já veio preenchido não é consultado de novo ao abrir.
  let ultimo = cepDe(input.value);

  const dizer = (texto, erro = false) => {
    if (!dica) return;
    dica.textContent = texto;
    dica.classList.toggle('err', !!erro);
  };

  input.addEventListener('input', async () => {
    input.value = mascaraCep(input.value);
    const cep = cepDe(input.value);
    if (!cep) { ultimo = null; pedido++; dizer(''); return; }
    if (cep === ultimo) return;
    ultimo = cep;
    const meu = ++pedido;
    dizer('Procurando…');
    try {
      const r = await buscar(cep);
      if (meu !== pedido || !input.isConnected) return;   // resposta velha, ou o modal fechou
      if (!r) return dizer('CEP não encontrado. Confira os números ou preencha o endereço à mão.', true);
      dizer('');
      aoAchar(r, dizer);
    } catch (_) {
      if (meu === pedido) dizer('O serviço de CEP não respondeu. Preencha o endereço à mão.', true);
    }
  });
}
