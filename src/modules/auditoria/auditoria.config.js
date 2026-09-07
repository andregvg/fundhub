// ============================================================
// FundHub - modules/auditoria/auditoria.config.js
// Declaração de configuração do módulo Auditoria: um painel só, com a
// saúde dos registros e a poda.
//
// A poda mora AQUI, e não numa aba, de propósito: apagar trilha de
// auditoria é ação rara, destrutiva e de política - não faz parte de
// consultar o log. Fica atrás da engrenagem, com o tamanho à vista
// antes do botão, para o admin decidir olhando o número.
//
// O botão daqui é `.btn-secundario`, não `.btn-perigo`: vermelho é do
// diálogo de confirmação (ui.md - `.btn-perigo` só em diálogo), e é lá
// que confirmar() o pinta, com `perigo: true`. Um botão vermelho fixo
// no painel gritaria a cada abertura da engrenagem sem nada acontecer.
//
// Não é model: não fala com o banco (quem fala é eventos.model.js) e
// não é API pública do módulo.
// ============================================================
import { saudeLogs, podarLogs } from './eventos.model.js';
import { esc } from '../../shared/dom.js';
import { toast } from '../../shared/ui/toast.js';
import { confirmar } from '../../shared/ui/confirmar.js';
import { loading, erroBox } from '../../shared/ui/feedback.js';
import { fmtDataHora } from '../../shared/format.js';

// Padrões de retenção. Conservadores de propósito: evento é
// observabilidade e envelhece rápido; auditoria é prova.
const DIAS_EVENTO = 180;
const DIAS_AUDIT = 730;

export const DECLARACAO = {
  itens: [
    { chave: 'saude_logs', escopo: 'rede', grupo: 'regras',
      rotulo: 'Saúde dos registros',
      dica: 'Quanto os registros ocupam do banco e até onde vai a retenção. '
          + 'O plano atual do banco tem 500 MB no total.',
      painel: pintarSaude },
  ],
};

const mb = (b) => (Number(b || 0) / 1048576).toFixed(1) + ' MB';

async function pintarSaude(box) {
  if (!box) return;
  box.innerHTML = loading();

  let s;
  try { s = await saudeLogs(); }
  catch (err) { box.innerHTML = erroBox(err); return; }

  if (!s) {
    box.innerHTML = '<p class="form-hint">Indisponível: a migration 032 ainda não rodou neste banco.</p>';
    return;
  }

  const usado = Number(s.banco_bytes || 0);
  const limite = Number(s.banco_limite || 1);
  const pct = Math.min(100, Math.round((usado / limite) * 100));

  box.innerHTML = `
    <div class="au-saude">
      <div class="stat-row">
        <div class="stat-tile">
          <div class="stat-num">${esc(String(s.audit_linhas ?? 0))}</div>
          <div class="stat-label">Mudanças · ${esc(mb(s.audit_bytes))}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-num">${esc(String(s.evento_linhas ?? 0))}</div>
          <div class="stat-label">Eventos · ${esc(mb(s.evento_bytes))}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-num">${esc(String(pct))}%</div>
          <div class="stat-label">do banco (${esc(mb(usado))} de ${esc(mb(limite))})</div>
        </div>
      </div>
      <p class="form-hint">
        Mudança mais antiga guardada: ${s.audit_mais_antigo ? esc(fmtDataHora(s.audit_mais_antigo)) : 'nenhuma'}.
        Evento mais antigo: ${s.evento_mais_antigo ? esc(fmtDataHora(s.evento_mais_antigo)) : 'nenhum'}.
      </p>
      <p class="form-hint">
        Podar apaga <b>definitivamente</b> os eventos com mais de ${DIAS_EVENTO} dias
        e as mudanças com mais de ${DIAS_AUDIT} dias (cerca de dois anos).
        Não há como desfazer, e não há backup no plano atual.
      </p>
      <button type="button" class="btn-secundario" id="au-podar">Podar registros antigos</button>
    </div>`;

  box.querySelector('#au-podar').addEventListener('click', async () => {
    const ok = await confirmar('Apagar registros antigos?', {
      detalhe: `Saem os eventos com mais de ${DIAS_EVENTO} dias e as mudanças com mais de `
             + `${DIAS_AUDIT} dias. É definitivo: auditoria apagada não volta.`,
      textoOk: 'Podar', perigo: true,
    });
    if (!ok) return;
    try {
      const r = await podarLogs(DIAS_EVENTO, DIAS_AUDIT);
      toast({
        titulo: 'Registros podados',
        texto: `${r.eventos_apagados ?? 0} evento(s) e ${r.auditoria_apagada ?? 0} mudança(s).`,
        tipo: 'sucesso',
      });
      pintarSaude(box);
    } catch (err) {
      toast({ titulo: 'Não foi possível podar', texto: err.message || String(err), tipo: 'erro' });
    }
  });
}
