// ============================================================
// FundHub — servidores/views/formulario.js  (criar, editar, excluir)
// ============================================================
import { LOTACOES, CARGOS_SEDE, criarServidor, atualizarServidor, excluirServidor } from '../servidores.model.js';
import { sincronizarTelefones } from '../../telefones/telefones.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { drawerHead, abrirDrawer, fecharDrawer } from '../../../shared/ui/drawer.js';
import { phonesEditorHtml, montarPhonesEditor, lerPhonesEditor } from '../../../shared/ui/phones.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';

// `ctx`: { recarregar } — ver servidores.view.js § ctxAtual().
export function formServidor(s, ctx) {
  const novo = !s;
  const v = (k) => esc(s?.[k] ?? '');

  const lot = s?.lotacao || 'escola';

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo servidor' : 'Editar servidor', novo ? '' : esc(s.nome))}
    <div class="drawer-body">
      <form id="sv-form" class="esc-form">

        <fieldset class="form-grupo">
          <legend>Identificação</legend>
          <div class="campos">
            <label>Nome completo <input id="s-nome" required value="${v('nome')}" /></label>
            <label>Apelido / como é chamado(a) <input id="s-apelido" value="${v('apelido')}" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Dados funcionais</legend>
          <div class="campos duas">
            <label>Código funcional <input id="s-codigo" inputmode="numeric" value="${v('codigo_funcional')}" /></label>
            <label>Ingresso na rede <input id="s-ingresso" type="date" value="${v('inicio_rede')}" /></label>
            <label>Lotação <select id="s-lotacao">
              ${LOTACOES.map(([val, r]) => `<option value="${val}" ${lot === val ? 'selected' : ''}>${esc(r)}</option>`).join('')}
            </select></label>
            <label>Cargo / função <input id="s-cargo" list="cargos" value="${v('cargo')}" />
              <datalist id="cargos">${CARGOS_SEDE.map(c => `<option>${esc(c)}</option>`).join('')}</datalist>
            </label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Documentos</legend>
          <div class="campos duas">
            <label>CPF <input id="s-cpf" inputmode="numeric" placeholder="000.000.000-00" value="${v('cpf')}" /></label>
            <label>RG <input id="s-rg" value="${v('rg')}" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Contato</legend>
          <div class="campos">
            <label>E-mail <input id="s-email" type="email" value="${v('email')}" /></label>
            ${phonesEditorHtml(s?.telefones)}
          </div>
        </fieldset>

        <div class="form-foot">
          <span id="s-msg" class="auth-msg"></span>
          <button type="submit" id="s-save" class="btn-primary">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
      ${novo ? `<p class="form-hint" style="margin-top:14px">Depois de criar, abra o servidor para vinculá-lo a uma escola.</p>` : ''}
    </div>`);

  montarPhonesEditor(document.getElementById('sv-form'));
  document.getElementById('sv-form').addEventListener('submit', (e) => salvarServidor(e, s, ctx));
}

async function salvarServidor(e, s, ctx) {
  e.preventDefault();
  const msg = document.getElementById('s-msg'); msg.className = 'auth-msg';
  const val = (id) => document.getElementById(id).value.trim();
  const payload = {
    // Nome em caixa alta na origem: os cards e a gaveta exibem assim,
    // e gravar normalizado evita a lista misturar "Maria" e "MARIA".
    nome: val('s-nome').toUpperCase(),
    apelido: val('s-apelido') || null,
    email: val('s-email') || null,
    codigo_funcional: val('s-codigo') || null,
    cargo: val('s-cargo') || null,
    lotacao: document.getElementById('s-lotacao').value,
    cpf: val('s-cpf') || null,
    rg: val('s-rg') || null,
    inicio_rede: document.getElementById('s-ingresso').value || null,
  };
  if (!payload.nome) return falha(msg, 'Informe o nome completo.');
  const telefones = lerPhonesEditor(document.getElementById('sv-form'));

  const btn = document.getElementById('s-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    const id = s ? (await atualizarServidor(s.id, payload), s.id) : (await criarServidor(payload)).id;
    await sincronizarTelefones({ servidorId: id }, telefones);
    fecharDrawer();
    await ctx.recarregar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = s ? 'Salvar' : 'Criar';
  }
}

export async function removerServidor(s, ctx) {
  const n = s.vinculos.length;
  const aviso = n
    ? `Isso apaga junto ${n} vínculo(s), os horários e os afastamentos dele. Não pode ser desfeito.`
    : 'Esta ação não pode ser desfeita.';
  const ok = await confirmar(`Excluir "${s.nome}"?`, { detalhe: aviso, textoOk: 'Excluir', perigo: true });
  if (!ok) return;
  try {
    await excluirServidor(s.id);
    fecharDrawer();
    await ctx.recarregar();
  } catch (err) {
    toast({ titulo: 'Não foi possível excluir', texto: err.message || String(err), tipo: 'no' });
  }
}
