// ============================================================
// FundHub - sate/views/conferir-local.js
// "Conferir local" (spec 2026-09-27, D6): o destino que a escola digitou
// vira um local do cadastro - um existente ("É este") ou um novo,
// conferido no mapa ("Cadastrar novo"). Nos dois casos o pedido só troca
// de destino; o trajeto é recalculado.
// ============================================================
import { vincularLocal } from '../sate.model.js';
import { locaisParecidos, enderecoCompleto } from '../../locais/locais.model.js';
import { atualizarTrajeto, retratoTrajeto } from '../rota.model.js';
import { velocidadeOnibusKmh, margemParadaMin } from '../sate.config.js';
import { abrirLocal } from './locais.js';
import { esc } from '../../../shared/dom.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

export function abrirConferirLocal(s, ctx, reabrir) {
  const digitado = { nome: s.destino_nome, endereco: s.destino_endereco, numero: s.destino_numero, bairro: s.destino_bairro };
  const parecidos = locaisParecidos(digitado, ctx.locais || []);

  abrirModal(`
    ${modalHead('Conferir local', 'O destino que a escola digitou')}
    <div class="modal-body" id="conf-corpo">
      <div class="conf-digitado">
        <b>${esc(digitado.nome)}</b>
        <div class="di-meta">${esc(enderecoCompleto(digitado)) || 'sem endereço'}</div>
      </div>
      <h3 class="conf-titulo">${parecidos.length ? 'Já cadastrado? Escolha o mesmo lugar:' : 'Nenhum local parecido no cadastro.'}</h3>
      ${parecidos.map(l => `
        <div class="solic">
          <div class="solic-main"><b>${esc(l.nome)}</b><div class="di-meta">${esc(enderecoCompleto(l))}</div></div>
          <div class="solic-acoes"><button type="button" class="mini-btn ok" data-local="${esc(l.id)}">É este</button></div>
        </div>`).join('')}
      <div class="form-foot">
        <span id="conf-msg" class="auth-msg"></span>
        <button type="button" class="btn-primary" id="conf-novo">Nenhum destes: cadastrar novo</button>
      </div>
    </div>`, { tamanho: 'medio', voltar: reabrir });

  const corpo = document.getElementById('conf-corpo');
  corpo.querySelectorAll('[data-local]').forEach(b => b.addEventListener('click', () =>
    vincular(s, ctx, (ctx.locais || []).find(l => l.id === b.dataset.local), reabrir)));
  document.getElementById('conf-novo').addEventListener('click', () =>
    abrirLocal(null, { preenchido: digitado, aoSalvar: (novo) => vincular(s, ctx, novo, reabrir) }, ctx));
}

async function vincular(s, ctx, local, reabrir) {
  if (!local) return;
  try {
    Object.assign(s, await vincularLocal(s.id, local));
    const r = await atualizarTrajeto(s, { velocidadeKmh: velocidadeOnibusKmh(), margemMin: margemParadaMin() }).catch(() => null);
    if (r) Object.assign(s, retratoTrajeto(r));
    ctx.recarregar?.();
    toast({ titulo: 'Local conferido', texto: local.nome, tipo: 'sucesso' });
    await reabrir();
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível vincular o local' });
  }
}
