// ============================================================
// FundHub - sate/views/frota-extra.js
// O modal "faltam veículos": quem aprova passa do limite da frota, e o
// que falta nasce como frota extra só daquele dia, ligada ao pedido.
// Spec: 2026-09-13-sate-ciclo-de-aprovacao-design.md, D1 e D2.
//
// Dois modos, uma tela:
//   confirmar  - vindo do botão Confirmar do detalhe. Se faltam vans,
//                oferece também deixar o pedido aguardando a van (D2).
//   remanejar  - vindo de um remanejamento para data sem folga. Só cria
//                o lote; a situação do pedido não muda (D4).
//
// Não importa o detalhe (seria ciclo): quem abre passa `reabrir`.
// ============================================================
import { decidirComFrota, getRotulos, criarRotulo } from '../frota.model.js';
import { PERIODOS } from '../sate.model.js';
import { esc, val, falha } from '../../../shared/dom.js';
import { fmtData } from '../../../shared/format.js';
import { modalHead, abrirModal, fecharModal } from '../../../shared/ui/modal.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

const NOVO = '__novo__';
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export async function abrirFrotaExtra({ solicitacao: s, falta, modo = 'confirmar', ctx, reabrir }) {
  const rotulos = await getRotulos().catch(() => []);
  const partes = [
    falta.onibus ? `<b>${falta.onibus} ônibus</b>` : '',
    falta.vans ? `<b>${plural(falta.vans, 'van adaptada', 'vans adaptadas')}</b>` : '',
  ].filter(Boolean).join(' e ');
  const quando = `${fmtData(s.data)} (${PERIODOS[s.periodo] || s.periodo})`;
  const confirmando = modo === 'confirmar';

  abrirModal(`
    ${modalHead('Faltam veículos neste dia', esc(quando))}
    <div class="modal-body">
      <form id="fx-form" class="esc-form">
        <p class="fx-texto">${confirmando ? 'Para confirmar' : 'Na nova data'}, faltam ${partes} na frota de ${esc(quando)}.
          ${confirmando ? 'Confirmando aqui' : 'Criando aqui'}, o sistema cria uma <b>frota extra só para esse dia</b>, ligada a este pedido.</p>
        <div class="form-grid">
          <label class="col-full">Rótulo da frota extra
            <select id="fx-rotulo">
              <option value="">Selecione…</option>
              ${rotulos.map(r => `<option value="${esc(r.id)}">${esc(r.nome)}</option>`).join('')}
              <option value="${NOVO}">+ Novo rótulo…</option>
            </select>
            <small class="form-hint">Diz por que o dia tem veículos a mais (ex.: "Cirem").</small></label>
          <label class="col-full" id="fx-novo-w" hidden>Nome do novo rótulo
            <input id="fx-novo" type="text" maxlength="60" /></label>
        </div>
        <div class="form-foot">
          <span id="fx-msg" class="auth-msg"></span>
          ${confirmando && falta.vans ? '<button type="button" class="btn-secundario" id="fx-aguardar">Aguardar van adaptada</button>' : ''}
          ${confirmando ? '' : '<button type="button" class="btn-secundario" id="fx-depois">Agora não</button>'}
          <button type="submit" class="btn-primary" id="fx-ok">${confirmando ? 'Confirmar com frota extra' : 'Criar frota extra'}</button>
        </div>
      </form>
    </div>`, { tamanho: 'estreito', voltar: reabrir });

  const form = document.getElementById('fx-form');
  const sel = document.getElementById('fx-rotulo');
  sel.addEventListener('change', () => {
    document.getElementById('fx-novo-w').hidden = sel.value !== NOVO;
    if (sel.value === NOVO) document.getElementById('fx-novo').focus();
  });

  // Aguardar: os ônibus que faltarem nascem agora (o pedido passa a
  // reservá-los); a van fica por resolver, que é o que o status diz.
  document.getElementById('fx-aguardar')?.addEventListener('click', () =>
    decidir({ status: 'aguardando_transporte_adaptado', onibus: falta.onibus, vans: 0 }, 'Pedido aguardando van adaptada'));
  document.getElementById('fx-depois')?.addEventListener('click', () => reabrir());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    decidir({ status: confirmando ? 'confirmado' : null, onibus: falta.onibus, vans: falta.vans },
      confirmando ? 'Solicitação confirmada com frota extra' : 'Frota extra criada');
  });

  async function decidir({ status, onibus, vans }, titulo) {
    const msg = document.getElementById('fx-msg'); msg.className = 'auth-msg';
    const criaLote = onibus + vans > 0;
    // Validação de formulário fica NA LINHA do botão, não num toast: é
    // algo que a pessoa corrige ali mesmo. O banco também recusa (040).
    if (criaLote && !sel.value) return falha(msg, 'Escolha ou crie o rótulo da frota extra.');
    if (criaLote && sel.value === NOVO && !val('fx-novo')) return falha(msg, 'Informe o nome do novo rótulo.');
    const botoes = form.querySelectorAll('button');
    botoes.forEach(b => { b.disabled = true; });
    try {
      const rotuloId = criaLote ? await resolverRotulo() : null;
      await decidirComFrota({ solicitacaoId: s.id, status, rotuloId, onibus, vans });
      toast({ titulo, texto: quando, tipo: 'sucesso' });
      if (status) { fecharModal({ tudo: true }); ctx.recarregar?.(); }
      else { await reabrir(); ctx.recarregar?.(); }
    } catch (err) {
      reportarErro(err, { msg, titulo: 'Não foi possível concluir' });
      botoes.forEach(b => { b.disabled = false; });
    }
  }

  const resolverRotulo = async () => (sel.value === NOVO ? (await criarRotulo(val('fx-novo'))).id : sel.value);
}
