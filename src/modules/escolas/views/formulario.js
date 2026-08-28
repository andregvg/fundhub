// ============================================================
// FundHub — escolas/views/formulario.js  (criar, editar, excluir)
// ============================================================
import { criarUnidade, atualizarUnidade, excluirUnidade } from '../escolas.model.js';
import { sincronizarTelefones } from '../../telefones/telefones.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { drawerHead, abrirDrawer, fecharDrawer } from '../../../shared/ui/drawer.js';
import { phonesEditorHtml, montarPhonesEditor, lerPhonesEditor } from '../../../shared/ui/phones.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';

// `ctx`: { recarregar } — ver escolas.view.js § ctxAtual().
export function abrirForm(u, ctx) {
  const novo = !u;
  const v = (k) => esc(u?.[k] ?? '');
  const chk = (k) => (u?.[k] ? 'checked' : '');

  // Os campos são muitos (16). Agrupá-los em blocos com título é só
  // visual — o payload continua o mesmo — mas transforma uma parede
  // de inputs numa ficha que se lê de relance.
  abrirDrawer(`
    ${drawerHead(novo ? 'Nova escola' : 'Editar escola', novo ? '' : esc(u.nome))}
    <div class="drawer-body">
      <form id="esc-form" class="esc-form">

        <fieldset class="form-grupo">
          <legend>Identificação</legend>
          <div class="campos auto">
            <label>Nome <input name="nome" required value="${v('nome')}" />
              <small class="form-hint">Como aparece nos cards e nas listas.</small></label>
            <label>Apelido <input name="apelido" value="${v('apelido')}" />
              <small class="form-hint">Forma curta de uso interno (ex.: “Alcina”).</small></label>
            <label class="col-full">Nome oficial / SAE <input name="nome_oficial" value="${v('nome_oficial')}" />
              <small class="form-hint">Como consta no SAE — use para conferir relatórios.</small></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Segmento e oferta</legend>
          <div class="campos auto">
            <label>Segmento <input name="segmento" list="segs" value="${v('segmento')}" />
              <datalist id="segs"><option>EMEF</option><option>EMEI</option><option>CEI</option><option>EMEPB</option><option>CONVENIADA</option></datalist>
            </label>
            <label>Oferta <input name="oferta" placeholder="EF1/EF2" value="${v('oferta')}" /></label>
            <label class="inline col-full"><input type="checkbox" name="tem_transporte" ${chk('tem_transporte')} /> Transporte de alunos</label>
            <label class="inline col-full"><input type="checkbox" name="tem_eja" ${chk('tem_eja')} /> Atende EJA</label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Localização</legend>
          <div class="campos auto">
            <label class="col-full">Endereço <input name="endereco" value="${v('endereco')}" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Contato</legend>
          <div class="campos auto">
            <label class="col-full">E-mail institucional <input name="email" type="email" value="${v('email')}" /></label>
            <div class="col-full">${phonesEditorHtml(u?.telefones)}</div>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Cadastros e links</legend>
          <div class="campos auto">
            <label>INEP <input name="inep" value="${v('inep')}" /></label>
            <label class="col-full">Site APM <input name="site_apm" value="${v('site_apm')}" /></label>
          </div>
        </fieldset>

        <div class="form-foot">
          <span id="ef-msg" class="auth-msg"></span>
          <button type="submit" id="ef-save" class="btn-primary">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`);

  montarPhonesEditor(document.getElementById('esc-form'));
  document.getElementById('esc-form').addEventListener('submit', (e) => salvar(e, u, ctx));
}

async function salvar(e, u, ctx) {
  e.preventDefault();
  const f = e.target;
  const msg = document.getElementById('ef-msg'); msg.className = 'auth-msg';
  const payload = {
    nome: f.nome.value.trim(),
    apelido: f.apelido.value.trim() || null,
    nome_oficial: f.nome_oficial.value.trim() || null,
    segmento: f.segmento.value.trim() || null,
    endereco: f.endereco.value.trim() || null,
    email: f.email.value.trim() || null,
    oferta: f.oferta.value.trim() || null,
    inep: f.inep.value.trim() || null,
    site_apm: f.site_apm.value.trim() || null,
    tem_transporte: f.tem_transporte.checked,
    tem_eja: f.tem_eja.checked,
  };
  if (!payload.nome) return falha(msg, 'Informe o nome.');
  const telefones = lerPhonesEditor(f);

  const btn = document.getElementById('ef-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    const id = u ? (await atualizarUnidade(u.id, payload), u.id) : (await criarUnidade(payload)).id;
    await sincronizarTelefones({ unidadeId: id }, telefones);
    fecharDrawer();
    await ctx.recarregar();
    toast({ titulo: u ? 'Escola atualizada' : 'Escola cadastrada', texto: payload.nome, tipo: 'sucesso' });
  } catch (err) {
    // Erro de gravação é resultado da ação, não do campo: vai de
    // toast, que sobrevive à gaveta fechar.
    toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' });
    btn.disabled = false; btn.textContent = u ? 'Salvar' : 'Criar';
  }
}

export async function removerEscola(u, ctx) {
  const ok = await confirmar(`Excluir a escola "${u.nome}"?`,
    { detalhe: 'Esta ação não pode ser desfeita.', textoOk: 'Excluir', perigo: true });
  if (!ok) return;
  try {
    await excluirUnidade(u.id);
    fecharDrawer();
    await ctx.recarregar();
    toast({ titulo: 'Escola removida', texto: u.nome, tipo: 'sucesso' });
  } catch (err) {
    toast({ titulo: 'Não foi possível excluir', texto: err.message || String(err), tipo: 'erro' });
  }
}
