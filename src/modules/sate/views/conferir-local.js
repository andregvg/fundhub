// ============================================================
// FundHub - sate/views/conferir-local.js
// "Conferir local" (spec 2026-09-27, D6; por LUGAR desde a spec
// 2026-10-10-sate-endereco-e-cep, D8): o destino que as escolas digitaram
// vira um local do cadastro - um existente ("É este") ou um novo,
// conferido no mapa ("Cadastrar novo"). Todos os pedidos que digitaram
// aquele destino mudam juntos; o trajeto de cada um é recalculado.
//
// Abre por dois caminhos: a aba Locais (bloco "A conferir") e a ficha de
// um pedido.
// ============================================================
import { vincularLocal, destinosAConferir } from '../sate.model.js';
import { agruparDestinos, chaveDestino } from '../regras.model.js';
import { locaisParecidos, enderecoCompleto } from '../../locais/locais.model.js';
import { atualizarTrajeto, retratoTrajeto } from '../rota.model.js';
import { velocidadeOnibusKmh, margemParadaMin } from '../sate.config.js';
import { abrirLocal } from './locais.js';
import { esc } from '../../../shared/dom.js';
import { fmtCep } from '../../../shared/format.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

const quantos = (n) => (n === 1 ? '1 pedido' : `${n} pedidos`);

// `lugar`: um grupo de agruparDestinos() - { nome, endereco, numero,
// bairro, cep, pedidos }. `aoConcluir` roda depois de vincular.
export function abrirConferirLocal(lugar, ctx, aoConcluir) {
  const parecidos = locaisParecidos(lugar, ctx.locais || []);
  const linha = [enderecoCompleto(lugar), lugar.cep ? `CEP ${fmtCep(lugar.cep)}` : ''].filter(Boolean).join(' · ');

  abrirModal(`
    ${modalHead('Conferir local', 'O destino que a escola digitou')}
    <div class="modal-body" id="conf-corpo">
      <div class="conf-digitado">
        <b>${esc(lugar.nome)}</b>
        <div class="di-meta">${esc(linha) || 'sem endereço'}</div>
        <div class="di-meta">Usado em ${quantos(lugar.pedidos.length)}.</div>
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
    </div>`, { tamanho: 'medio', voltar: aoConcluir });

  const corpo = document.getElementById('conf-corpo');
  corpo.querySelectorAll('[data-local]').forEach(b => b.addEventListener('click', () =>
    vincular(lugar, ctx, (ctx.locais || []).find(l => l.id === b.dataset.local), aoConcluir)));
  document.getElementById('conf-novo').addEventListener('click', () =>
    abrirLocal(null, {
      preenchido: { nome: lugar.nome, endereco: lugar.endereco, numero: lugar.numero, bairro: lugar.bairro, cep: lugar.cep },
      aoSalvar: (novo) => vincular(lugar, ctx, novo, aoConcluir),
    }, ctx));
}

// A partir da ficha de UM pedido: acha os outros pedidos do mesmo lugar e
// confere todos. O objeto `s` aberto na ficha entra no grupo no lugar da
// cópia vinda do banco - é ele que a ficha redesenha depois.
export async function abrirConferirDoPedido(s, ctx, reabrir) {
  const todos = await destinosAConferir().catch(() => []);
  const mesmo = todos.filter(p => p.id !== s.id && chaveDestino(p) === chaveDestino(s));
  abrirConferirLocal(agruparDestinos([s, ...mesmo])[0], ctx, reabrir);
}

async function vincular(lugar, ctx, local, aoConcluir) {
  if (!local) return;
  // Clique duplo: vincular e recalcular leva um tempo, e uma segunda chamada
  // refaria tudo. Os botões do modal ficam parados até terminar.
  const botoes = [...document.querySelectorAll('#conf-corpo [data-local], #conf-novo')];
  const travar = (v) => botoes.forEach(b => { b.disabled = v; });
  travar(true);
  try {
    const patch = await vincularLocal(lugar.pedidos.map(p => p.id), local);
    // Um por vez: cada trajeto é uma consulta ao serviço de rotas.
    let semTrajeto = 0;
    for (const p of lugar.pedidos) {
      Object.assign(p, patch);
      const r = await atualizarTrajeto(p, { velocidadeKmh: velocidadeOnibusKmh(), margemMin: margemParadaMin() }).catch(() => null);
      if (r) Object.assign(p, retratoTrajeto(r));
      if (!r || r.status === 'erro') semTrajeto++;
    }
    ctx.recarregar?.();
    toast({
      titulo: 'Local conferido',
      texto: `${local.nome} · ${quantos(lugar.pedidos.length)}`
        + (semTrajeto ? ` · ${semTrajeto} trajeto(s) não recalculado(s): use Recalcular na solicitação` : ''),
      tipo: semTrajeto ? 'atencao' : 'sucesso',
    });
    await aoConcluir();
  } catch (err) {
    travar(false);
    reportarErro(err, { titulo: 'Não foi possível vincular o local' });
  }
}
