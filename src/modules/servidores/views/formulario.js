// ============================================================
// FundHub - servidores/views/formulario.js  (criar, editar, excluir)
// ============================================================
import { criarServidor, atualizarServidor, excluirServidor, cargoDe, lotacaoDe, vinculosAbertos } from '../servidores.model.js';
import { sincronizarTelefones } from '../../telefones/telefones.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { mascaraCPF, mascaraRG, noPadraoCPF, noPadraoRG } from '../../../shared/format.js';
import { drawerHead, abrirDrawer, fecharDrawer } from '../../../shared/ui/drawer.js';
import { phonesEditorHtml, montarPhonesEditor, lerPhonesEditor } from '../../../shared/ui/phones.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';
import { formVinculo } from './vinculo.js';
import { ico } from '../../../shared/ui/icones.js';

// `ctx`: { recarregar } - ver servidores.view.js § ctxAtual().
export function formServidor(s, ctx, { voltar = null } = {}) {
  const novo = !s;
  const v = (k) => esc(s?.[k] ?? '');
  const cargo = s ? cargoDe(s) : '';
  const lotacao = s ? lotacaoDe(s, { completo: true }) : '';

  // Cargo e lotação continuam à vista - são o que identifica a pessoa
  // - mas não são editáveis aqui: eles vêm do vínculo, que é o único
  // dono desse dado. O botão de editar abre a gaveta do vínculo POR CIMA desta.
  const derivado = (rotulo, valor, acao) => `
    <label>${rotulo}
      <span class="campo-derivado">
        <span class="cd-valor"${valor ? ` title="${esc(valor)}"` : ''}>${
          valor ? esc(valor) : '<span class="vazio">Sem vínculo</span>'}</span>
        ${ctx.podeEditar && !novo
          ? `<button type="button" class="mini-btn" data-vinc="${acao}"
               aria-label="${valor ? 'Editar' : 'Criar'} vínculo">${valor ? ico('editar') : ico('adicionar')}</button>`
          : ''}
      </span>
    </label>`;

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo servidor' : 'Editar servidor', novo ? '' : esc(s.nome))}
    <div class="drawer-body">
      <form id="sv-form" class="esc-form">

        <fieldset class="form-grupo">
          <legend>Identificação</legend>
          <div class="campos auto">
            <label class="col-full">Nome completo <input id="s-nome" required value="${v('nome')}" /></label>
            <label>Apelido / como é chamado(a) <input id="s-apelido" value="${v('apelido')}" /></label>
            <label>Data de nascimento <input id="s-nascimento" type="date" value="${v('nascimento')}" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Documentos</legend>
          <div class="campos auto">
            <label>CPF <input id="s-cpf" inputmode="numeric" placeholder="000.000.000-00" value="${v('cpf')}" /></label>
            <label>RG <input id="s-rg" inputmode="text" placeholder="00.000.000-0" value="${v('rg')}" /></label>
            <label>Código funcional <input id="s-codigo" inputmode="numeric" value="${v('codigo_funcional')}" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Rede</legend>
          <div class="campos auto">
            <label>Ingresso na rede <input id="s-ingresso" type="date" value="${v('inicio_rede')}" /></label>
            ${derivado('Cargo / função', cargo, 'cargo')}
            ${derivado('Lotação', lotacao, 'lotacao')}
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Contato</legend>
          <div class="campos auto">
            <label class="col-full">E-mail <input id="s-email" type="email" value="${v('email')}" /></label>
            <div class="col-full">${phonesEditorHtml(s?.telefones)}</div>
          </div>
        </fieldset>

        <div class="form-foot">
          <span id="s-msg" class="auth-msg"></span>
          <button type="submit" id="s-save" class="btn-primary">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
      ${novo ? `<p class="form-hint" style="margin-top:14px">Depois de criar, abra o servidor para vinculá-lo a uma escola ou à SME.</p>` : ''}
    </div>`, { voltar });

  const form = document.getElementById('sv-form');
  montarPhonesEditor(form);

  // Máscara enquanto digita. O caso comum é digitar do começo ao fim;
  // reformatar o valor inteiro mantém o cursor no lugar certo aí.
  const mascarar = (id, fn) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => { el.value = fn(el.value); });
    el.value = fn(el.value);
  };
  mascarar('s-cpf', mascaraCPF);
  mascarar('s-rg', mascaraRG);

  // O botão de editar cargo/lotação abre o vínculo sobre esta gaveta;
  // ao fechar, volta para cá com o servidor recarregado.
  form.querySelectorAll('[data-vinc]').forEach(b => b.addEventListener('click', async () => {
    const c = await ctx.recarregar();
    const atual = c.lista.find(x => x.id === s.id);
    const aberto = vinculosAbertos(atual)[0] || null;
    formVinculo(atual, aberto, c, { voltar: (freshCtx) => {
      const ctx2 = freshCtx || c;
      const s2 = ctx2.lista.find(x => x.id === atual.id) || atual;
      formServidor(s2, ctx2);
    } });
  }));

  form.addEventListener('submit', (e) => salvarServidor(e, s, ctx, voltar));
}

async function salvarServidor(e, s, ctx, voltar) {
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
    cpf: val('s-cpf') || null,
    rg: val('s-rg') || null,
    nascimento: document.getElementById('s-nascimento').value || null,
    inicio_rede: document.getElementById('s-ingresso').value || null,
  };
  if (!payload.nome) return falha(msg, 'Informe o nome completo.');

  // Documento fora do padrão é AVISO, não erro: RG de outro estado tem
  // outro formato e a pessoa precisa ser cadastrada assim mesmo (R15).
  const fora = [
    noPadraoCPF(payload.cpf) ? '' : 'CPF',
    noPadraoRG(payload.rg) ? '' : 'RG',
  ].filter(Boolean);
  if (fora.length) {
    toast({ titulo: `${fora.join(' e ')} fora do padrão`,
            texto: 'Salvo assim mesmo - confira se está correto.', tipo: 'atencao' });
  }

  const telefones = lerPhonesEditor(document.getElementById('sv-form'));

  const btn = document.getElementById('s-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    const id = s ? (await atualizarServidor(s.id, payload), s.id) : (await criarServidor(payload)).id;
    await sincronizarTelefones({ servidorId: id }, telefones);
    // Recarrega ANTES de fechar: a gaveta de baixo precisa reabrir com o
    // dado novo, não com o `ctx` de antes da edição. Veio da ficha? volta
    // para ela. Mesmo padrão de views/vinculo.js § salvar.
    const novoCtx = await ctx.recarregar();
    if (voltar) voltar(novoCtx); else fecharDrawer();
    toast({ titulo: s ? 'Servidor atualizado' : 'Servidor cadastrado', texto: payload.nome, tipo: 'sucesso' });
  } catch (err) {
    // Erro de gravação: inline quando dá para corrigir no formulário
    // aberto, toast quando não dá - reportarErro decide pelo código.
    reportarErro(err, { msg, titulo: 'Não foi possível salvar' });
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
    toast({ titulo: 'Servidor removido', texto: s.nome, tipo: 'sucesso' });
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível excluir' });
  }
}
