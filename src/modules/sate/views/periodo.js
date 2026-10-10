// ============================================================
// FundHub - sate/views/periodo.js
// O período da viagem (manhã, tarde, noite, dia todo) como badge: ícone e
// cor próprios, para ler de relance. Usado na lista, na ficha e no
// formulário - por isso mora à parte. As cores são tokens (--per-*).
// ============================================================
import { PERIODOS } from '../regras.model.js';
import { esc } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';

export const ICONE_PERIODO = { manha: 'manha', tarde: 'tarde', noite: 'noturno', integral: 'horario' };

export const periodoBadge = (p) => (p
  ? `<span class="per per-${esc(p)}">${ico(ICONE_PERIODO[p] || 'horario', { tam: 12 })}${esc(PERIODOS[p] || p)}</span>`
  : '');
