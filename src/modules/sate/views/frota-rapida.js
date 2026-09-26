// ============================================================
// FundHub - sate/views/frota-rapida.js
// O cadastro rápido de frota, pintado na LINHA do saldo do formulário de
// solicitação quando quem aprova pede transporte num dia sem frota
// nenhuma (spec 2026-09-26-sate-frota-e-disponibilidade-design.md, D4).
//
// Fronteira própria, por isso saiu de formulario.js (R11, "tire o que
// tem fronteira própria"): o formulário só decide QUANDO mostrar o
// cartão (dia sem frota, para quem aprova); escolher ou criar rótulo,
// validar e gravar o lote é só deste arquivo.
//
// É LOTE (com fim), não frota em aberto: abrir uma aqui poderia
// substituir a aberta do mesmo rótulo que começa depois (abrir_frota).
// ============================================================
import { criarLote, getRotulos, criarRotulo } from '../frota.model.js';
import { esc, val, falha } from '../../../shared/dom.js';
import { fmtData } from '../../../shared/format.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

export async function cadastroRapidoHtml(data) {
  const rotulos = await getRotulos().catch(() => []);
  return `<div class="sol-cad-frota">
    <div class="sol-cad-campos">
      <label>Rótulo <select id="cf-rotulo">
        <option value="">Selecione…</option>
        ${rotulos.map(r => `<option value="${esc(r.id)}">${esc(r.nome)}</option>`).join('')}
        <option value="__novo__">+ Novo rótulo…</option>
      </select></label>
      <label id="cf-novo-w" hidden>Nome do rótulo <input id="cf-novo" type="text" maxlength="60" /></label>
      <label>Ônibus <input id="cf-qtd" type="number" min="1" inputmode="numeric" /></label>
      <label>Até <input id="cf-fim" type="date" min="${esc(data)}" value="${esc(data)}" /></label>
      <button type="button" class="btn-secundario" id="cf-ok">Cadastrar frota</button>
    </div>
    <span class="form-hint">Frota em aberto (sem data para acabar) se cadastra na página Frota.</span>
    <span class="auth-msg" id="cf-msg"></span>
  </div>`;
}

// `aoCadastrar` é chamado depois de gravar - o formulário repinta o
// saldo com a frota nova, sem este arquivo precisar conhecer a tela.
export function ligarCadastroRapido(data, aoCadastrar) {
  const ok = document.getElementById('cf-ok');
  if (!ok) return;
  const sel = document.getElementById('cf-rotulo');
  sel.addEventListener('change', () => { document.getElementById('cf-novo-w').hidden = sel.value !== '__novo__'; });
  ok.addEventListener('click', async () => {
    const msg = document.getElementById('cf-msg'); msg.className = 'auth-msg';
    const qtd = parseInt(val('cf-qtd'), 10);
    if (!sel.value) return falha(msg, 'Escolha ou crie o rótulo.');
    if (sel.value === '__novo__' && !val('cf-novo')) return falha(msg, 'Informe o nome do rótulo.');
    if (!qtd || qtd < 1) return falha(msg, 'Informe quantos ônibus.');
    const fim = val('cf-fim') || data;
    if (fim < data) return falha(msg, 'A data final não pode ser antes do dia do pedido.');
    ok.disabled = true;
    try {
      const rotuloId = sel.value === '__novo__' ? (await criarRotulo(val('cf-novo'))).id : sel.value;
      await criarLote({ rotuloId, quantidade: qtd, inicio: data, fim, tipo: 'onibus' });
      toast({ titulo: 'Frota cadastrada', texto: fmtData(data), tipo: 'sucesso' });
      aoCadastrar?.();
    } catch (err) {
      reportarErro(err, { msg, titulo: 'Não foi possível cadastrar' });
      ok.disabled = false;
    }
  });
}
