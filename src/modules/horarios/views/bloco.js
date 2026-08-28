// ============================================================
// FundHub — horarios/views/bloco.js
// Formulário de UM bloco de jornada, compartilhado pelas duas
// visões (por escola e por servidor). Não conhece nenhuma delas:
// recebe servidor/unidade/dia prontos e devolve o controle via
// `recarregar` depois de salvar ou excluir — quem chamou decide o
// que "recarregar" significa na própria tela.
//
// As validações continuam vindo de validarDia no model; aqui só se
// pinta o resultado. Para validar o dia INTEIRO (o bloco novo somado
// aos que já existem), busca os blocos atuais da unidade — não confia
// em nenhuma lista que o chamador já tenha em memória, que pode estar
// desatualizada.
// ============================================================
import { getBlocos, criarBloco, atualizarBloco, excluirBloco, validarDia } from '../horarios.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { drawerHead, abrirDrawer, fecharDrawer } from '../../../shared/ui/drawer.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';

const hhmm = (t) => String(t ?? '').slice(0, 5);

export function formBloco(bloco, { servidorId, unidadeId, dia, nome, recarregar }) {
  const novo = !bloco;

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo bloco de jornada' : 'Editar bloco', esc(nome || ''))}
    <div class="drawer-body">
      <form id="hb-form" class="esc-form">
        <div class="esc-row">
          <label>Início <input id="b-ini" type="time" required value="${esc(hhmm(bloco?.inicio) || '07:00')}" /></label>
          <label>Fim <input id="b-fim" type="time" required value="${esc(hhmm(bloco?.fim) || '13:00')}" /></label>
        </div>
        <label>Observação <input id="b-obs" value="${esc(bloco?.obs || '')}" placeholder="Ex.: HTPC, atendimento aos pais" /></label>
        <div class="form-foot">
          <span id="b-msg" class="auth-msg"></span>
          <button type="submit" id="b-save">${novo ? 'Adicionar' : 'Salvar'}</button>
        </div>
      </form>
      ${novo ? '' : `<button type="button" class="mini-btn no" id="b-del" style="margin-top:16px">${ico('excluir')} Excluir bloco</button>`}
      <p class="form-hint" style="margin-top:16px">
        Para cumprir 8h sem ultrapassar 6h contínuas, divida o dia em dois blocos
        com intervalo entre eles.
      </p>
    </div>`);

  document.getElementById('hb-form').addEventListener('submit',
    (e) => salvarBloco(e, bloco, { servidorId, unidadeId, dia, recarregar }));
  document.getElementById('b-del')?.addEventListener('click', () => removerBloco(bloco, recarregar));
}

async function salvarBloco(e, bloco, { servidorId, unidadeId, dia, recarregar }) {
  e.preventDefault();
  const msg = document.getElementById('b-msg'); msg.className = 'auth-msg';
  const inicio = document.getElementById('b-ini').value;
  const fim = document.getElementById('b-fim').value;

  if (!inicio || !fim) return falha(msg, 'Informe início e fim.');
  if (fim <= inicio) return falha(msg, 'O fim precisa ser depois do início.');

  const btn = document.getElementById('b-save'); btn.disabled = true; btn.textContent = 'Salvando…';

  try {
    // Valida contra o dia INTEIRO daquele servidor naquela unidade —
    // o bloco novo somado aos que já existem, buscados agora mesmo.
    const doUnidade = await getBlocos(unidadeId);
    const outros = doUnidade.filter(b =>
      b.servidor_id === servidorId && b.dia_semana === dia && b.id !== bloco?.id);
    const problemas = validarDia([...outros, { inicio, fim }]);
    const erro = problemas.find(p => p.nivel === 'erro');
    if (erro) {
      falha(msg, erro.texto);
      btn.disabled = false; btn.textContent = bloco ? 'Salvar' : 'Adicionar';
      return;
    }

    const payload = {
      servidor_id: servidorId,
      unidade_id: unidadeId,
      ano: new Date().getFullYear(),
      dia_semana: dia,
      inicio, fim,
      obs: document.getElementById('b-obs').value.trim() || null,
    };

    if (bloco) await atualizarBloco(bloco.id, payload);
    else await criarBloco(payload);
    fecharDrawer();
    await recarregar();
    toast({ titulo: bloco ? 'Bloco atualizado' : 'Bloco adicionado', texto: `${inicio}-${fim}`, tipo: 'sucesso' });
  } catch (err) {
    // Erro de gravação é resultado da ação, não do campo: vai de
    // toast, que sobrevive à gaveta fechar.
    toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' });
    btn.disabled = false; btn.textContent = bloco ? 'Salvar' : 'Adicionar';
  }
}

async function removerBloco(bloco, recarregar) {
  const ok = await confirmar('Excluir este bloco da jornada?', { textoOk: 'Excluir', perigo: true });
  if (!ok) return;
  try {
    await excluirBloco(bloco.id);
    fecharDrawer();
    await recarregar();
    toast({ titulo: 'Bloco removido', texto: `${hhmm(bloco.inicio)}-${hhmm(bloco.fim)}`, tipo: 'sucesso' });
  } catch (err) {
    toast({ titulo: 'Não foi possível excluir', texto: err.message || String(err), tipo: 'erro' });
  }
}
