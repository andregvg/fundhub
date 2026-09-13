// ============================================================
// FundHub - sate/views/remanejar.js
// Remanejar um pedido: quem aprova muda data, período, horários,
// destino e número de veículos.
// Spec: 2026-09-13-sate-ciclo-de-aprovacao-design.md, D4.
//
// Estudantes e escolas NÃO se editam aqui: são das participações, e a
// lista "Escolas nesta viagem" do detalhe é onde se mexe nelas.
//
// Ao salvar, duas consequências que a pessoa não precisa lembrar:
//   - destino mudou → o trajeto é recalculado;
//   - o pedido reserva veículo e a nova data não comporta → abre o modal
//     da frota extra, em modo remanejamento.
// ============================================================
import { editarSolicitacao, PERIODOS, STATUS_RESERVA } from '../sate.model.js';
import { saldoDoDia, faltaParaConfirmar } from '../saldo.model.js';
import { atualizarTrajeto, retratoTrajeto } from '../rota.model.js';
import { velocidadeOnibusKmh, margemParadaMin } from '../sate.config.js';
import { abrirFrotaExtra } from './frota-extra.js';
import { esc, val, falha } from '../../../shared/dom.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

export function abrirRemanejar(s, ctx, reabrir) {
  const locais = (ctx.locais || []).filter(l => l.ativo || l.id === s.local_id);
  const v = (k) => esc(s[k] ?? '');

  abrirModal(`
    ${modalHead('Remanejar', esc(s.atividade?.nome || s.atividade_livre || 'Solicitação de transporte'))}
    <div class="modal-body">
      <form id="rm-form" class="esc-form">
        <fieldset class="form-grupo">
          <legend>Quando</legend>
          <div class="campos duas">
            <label>Data <input id="rm-data" type="date" required value="${v('data')}" /></label>
            <label>Período
              <select id="rm-per">${Object.entries(PERIODOS).map(([k, r]) =>
                `<option value="${esc(k)}" ${k === s.periodo ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
            <label>Horário de embarque <input id="rm-emb" type="time" value="${v('horario_embarque')}" /></label>
            <label>Horário de retorno <input id="rm-ret" type="time" value="${v('horario_retorno')}" /></label>
          </div>
        </fieldset>
        <fieldset class="form-grupo">
          <legend>Para onde e com quantos veículos</legend>
          <div class="campos duas">
            <label class="col-2">Destino
              <select id="rm-local">
                ${s.local_id ? '' : `<option value="">${esc(s.destino_nome ? `Manter: ${s.destino_nome}` : 'Sem destino do cadastro')}</option>`}
                ${locais.map(l => `<option value="${esc(l.id)}" ${l.id === s.local_id ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}
              </select></label>
            <label>Ônibus <input id="rm-onibus" type="number" inputmode="numeric" min="0" value="${Number(s.qtd_onibus) || 0}" /></label>
            <label>Vans adaptadas <input id="rm-vans" type="number" inputmode="numeric" min="0" value="${Number(s.qtd_vans) || 0}" /></label>
          </div>
          <small class="form-hint">Estudantes e escolas se ajustam na lista "Escolas nesta viagem".</small>
        </fieldset>
        <div class="form-foot">
          <span id="rm-msg" class="auth-msg"></span>
          <button type="submit" class="btn-primary" id="rm-ok">Salvar</button>
        </div>
      </form>
    </div>`, { tamanho: 'medio', voltar: reabrir });

  document.getElementById('rm-form').addEventListener('submit', (e) => salvar(e, s, ctx, reabrir));
}

async function salvar(e, s, ctx, reabrir) {
  e.preventDefault();
  const msg = document.getElementById('rm-msg'); msg.className = 'auth-msg';
  const emb = val('rm-emb') || null, ret = val('rm-ret') || null;
  if (!val('rm-data')) return falha(msg, 'Informe a data.');
  // "HH:MM" compara como texto na ordem certa.
  if (emb && ret && ret <= emb) return falha(msg, 'O retorno precisa ser depois do embarque.');

  const localId = document.getElementById('rm-local').value || null;
  const local = (ctx.locais || []).find(l => l.id === localId);
  const patch = {
    data: val('rm-data'),
    periodo: document.getElementById('rm-per').value,
    horario_embarque: emb,
    horario_retorno: ret,
    qtd_onibus: Math.max(0, parseInt(val('rm-onibus'), 10) || 0),
    qtd_vans: Math.max(0, parseInt(val('rm-vans'), 10) || 0),
    // Destino do cadastro troca nome e endereço junto; "manter" não mexe.
    ...(local ? { local_id: local.id, destino_nome: local.nome, destino_endereco: local.endereco || null } : {}),
  };
  const destinoMudou = !!local && local.id !== s.local_id;

  const btn = document.getElementById('rm-ok');
  btn.disabled = true;
  try {
    await editarSolicitacao(s.id, patch);
    Object.assign(s, patch);
    if (destinoMudou) {
      const r = await atualizarTrajeto(s, { velocidadeKmh: velocidadeOnibusKmh(), margemMin: margemParadaMin() })
        .catch(() => null);
      if (r) Object.assign(s, retratoTrajeto(r));
    }
    ctx.recarregar?.();
    toast({ titulo: 'Pedido remanejado', tipo: 'sucesso' });

    // Pedido que reserva veículo: a nova data comporta? `jaReservado`
    // porque o próprio pedido já está somado no uso depois de salvo.
    if (STATUS_RESERVA.includes(s.status)) {
      const falta = faltaParaConfirmar(s, await saldoDoDia(s.data), { jaReservado: true });
      if (falta.onibus || falta.vans) return abrirFrotaExtra({ solicitacao: s, falta, modo: 'remanejar', ctx, reabrir });
    }
    await reabrir();
  } catch (err) {
    reportarErro(err, { msg, titulo: 'Não foi possível remanejar' });
    btn.disabled = false;
  }
}
