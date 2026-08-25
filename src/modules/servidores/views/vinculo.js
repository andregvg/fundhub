// ============================================================
// FundHub — servidores/views/vinculo.js
// O formulário da DESIGNAÇÃO: local, cargo, início e fim.
//
// Sem ano letivo: o vínculo é um período, e "está aberto" é não ter
// data de fim. Encerrar é preencher o Término — o mesmo formulário,
// e não mais um prompt() do navegador (R16).
//
// Pode ser aberto sobre a ficha do servidor: quem chama passa
// `voltar`, e o Esc desempilha em vez de fechar tudo.
// ============================================================
import { criarVinculo, atualizarVinculo, excluirVinculo, rotulaCargo } from '../vinculos.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { drawerHead, abrirDrawer } from '../../../shared/ui/drawer.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';

const OUTRO = '::outro::';   // sentinela: os dois-pontos garantem que
                             // nenhum cargo digitado colide com ele

// `ctx`: { locais, cargos, recarregar } — ver servidores.view.js § ctxAtual().
export function formVinculo(s, vinculo, ctx, { voltar = null } = {}) {
  const novo = !vinculo;
  const cargoAtual = rotulaCargo(vinculo?.papel || '');
  const conhecido = !cargoAtual || ctx.cargos.includes(cargoAtual);

  const opcoesLocal = ctx.locais.map(l =>
    `<option value="${esc(l.id)}" ${l.id === vinculo?.unidade_id ? 'selected' : ''}>${
      l.tipo === 'sede' ? '🏛 ' : ''}${esc(l.nome)}</option>`).join('');

  // O catálogo é derivado dos vínculos existentes: nasce vazio numa
  // base sem ninguém e ganha o cargo assim que alguém digita um.
  const opcoesCargo = ctx.cargos.map(c =>
    `<option value="${esc(c)}" ${c === cargoAtual ? 'selected' : ''}>${esc(c)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo vínculo' : 'Editar vínculo', esc(s.nome))}
    <div class="drawer-body">
      <form id="vc-form" class="esc-form">
        <fieldset class="form-grupo">
          <legend>Designação</legend>
          <div class="campos auto">
            <label class="col-full">Local
              <select id="v-local" required>
                <option value="">Selecione…</option>${opcoesLocal}
              </select>
            </label>
            <label class="col-full">Cargo / função
              <select id="v-cargo" required>
                <option value="">Selecione…</option>
                ${opcoesCargo}
                <option value="${OUTRO}" ${cargoAtual && !conhecido ? 'selected' : ''}>➕ Outro…</option>
              </select>
            </label>
            <label class="col-full" id="v-novo-wrap" ${cargoAtual && !conhecido ? '' : 'hidden'}>
              Qual cargo / função?
              <input id="v-novo" value="${esc(conhecido ? '' : cargoAtual)}" placeholder="Ex.: Vice-diretor(a)" />
            </label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Período</legend>
          <div class="campos auto">
            <label>Início <input id="v-ini" type="date" value="${esc(vinculo?.ingresso || '')}" /></label>
            <label>Término <input id="v-fim" type="date" value="${esc(vinculo?.fim || '')}" />
              <small class="form-hint">Em branco = vínculo em aberto.</small></label>
          </div>
        </fieldset>

        <div class="form-foot">
          <span id="v-msg" class="auth-msg"></span>
          <button type="submit" id="v-save" class="btn-primary">${novo ? 'Vincular' : 'Salvar'}</button>
        </div>
      </form>
      ${novo ? '' : `<button type="button" class="mini-btn no" id="v-del" style="margin-top:16px">🗑 Excluir vínculo</button>
      <p class="form-hint" style="margin-top:10px">Para preservar o histórico, prefira preencher o Término em vez de excluir.</p>`}
    </div>`, { voltar });

  const sel = document.getElementById('v-cargo');
  sel.addEventListener('change', () => {
    const outro = sel.value === OUTRO;
    document.getElementById('v-novo-wrap').hidden = !outro;
    if (outro) document.getElementById('v-novo').focus();
  });

  document.getElementById('vc-form').addEventListener('submit', (e) => salvar(e, s, vinculo, ctx, voltar));
  document.getElementById('v-del')?.addEventListener('click', () => removerVinculo(s, vinculo.id, ctx));
}

async function salvar(e, s, vinculo, ctx, voltar) {
  e.preventDefault();
  const msg = document.getElementById('v-msg'); msg.className = 'auth-msg';
  const unidade_id = document.getElementById('v-local').value;
  const escolhido = document.getElementById('v-cargo').value;
  const papel = escolhido === OUTRO ? document.getElementById('v-novo').value : escolhido;
  const ingresso = document.getElementById('v-ini').value || null;
  const fim = document.getElementById('v-fim').value || null;

  if (!unidade_id) return falha(msg, 'Selecione o local.');
  if (!String(papel).trim()) return falha(msg, 'Informe o cargo/função.');
  // Fim antes do início é impossível, não indesejável: barra (R15).
  if (ingresso && fim && fim < ingresso) return falha(msg, 'O término não pode ser anterior ao início.');

  const btn = document.getElementById('v-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (vinculo) await atualizarVinculo(vinculo.id, { unidade_id, papel, ingresso, fim });
    else await criarVinculo({ servidor_id: s.id, unidade_id, papel, ingresso, fim });
    const novoCtx = await ctx.recarregar();
    // Volta para a gaveta de baixo já com o dado novo — é para isso
    // que a pilha guarda uma função, e não o HTML anterior.
    if (voltar) voltar(); else novoCtx.abrirDetalhe(s.id);
  } catch (err) {
    falha(msg, err.message || String(err));
    btn.disabled = false; btn.textContent = vinculo ? 'Salvar' : 'Vincular';
  }
}

export async function removerVinculo(s, vinculoId, ctx) {
  const ok = await confirmar('Excluir este vínculo?', {
    detalhe: 'Excluir apaga o registro. Para preservar o histórico, preencha o Término.',
    textoOk: 'Excluir', perigo: true,
  });
  if (!ok) return;
  try {
    await excluirVinculo(vinculoId);
    const novoCtx = await ctx.recarregar();
    novoCtx.abrirDetalhe(s.id);
  } catch (err) {
    toast({ titulo: 'Não foi possível excluir', texto: err.message || String(err), tipo: 'no' });
  }
}
