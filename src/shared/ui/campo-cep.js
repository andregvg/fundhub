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
//   ligarCep(input, { buscar, dica, aoAchar, aoMudar }) → { reiniciar }
//     buscar(cep8)        → Promise<objeto | null>   (null = não existe)
//     dica                → elemento que recebe o texto de estado (aria-live);
//                           o texto que ele tem ao ligar é a "dica inicial",
//                           restaurada quando o CEP fica incompleto ou vazio
//     aoAchar(r, dizer)   → dizer(texto, erro = false) escreve na dica
//     aoMudar()           → opcional; roda a CADA digitação, antes de qualquer
//                           consulta: "o CEP mudou, o que dependia do anterior
//                           não vale mais" (ex.: esconder o botão do pino)
//     reiniciar()         → para quando o CÓDIGO troca o valor do campo:
//                           descarta consulta pendente, refaz a memória do
//                           último CEP a partir do valor atual e restaura a
//                           dica inicial
// ============================================================
import { mascaraCep, cepDe } from '../format.js';

export function ligarCep(input, { buscar, dica = null, aoAchar, aoMudar = null }) {
  let pedido = 0;
  const dicaInicial = dica?.textContent || '';
  // O CEP que já veio preenchido não é consultado de novo ao abrir.
  let ultimo = cepDe(input.value);

  const dizer = (texto, erro = false) => {
    if (!dica) return;
    dica.textContent = texto;
    dica.classList.toggle('err', !!erro);
  };

  input.addEventListener('input', async () => {
    aoMudar?.();
    input.value = mascaraCep(input.value);
    const cep = cepDe(input.value);
    if (!cep) { ultimo = null; pedido++; dizer(dicaInicial); return; }
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

  return {
    reiniciar() { pedido++; ultimo = cepDe(input.value); dizer(dicaInicial); },
  };
}
