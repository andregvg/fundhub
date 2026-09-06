// ============================================================
// FundHub - servidores/views/formulario.js  (criar, editar, excluir)
// ============================================================
import { criarServidor, atualizarServidor, excluirServidor, cargoDe, localDeTrabalhoDe, vinculosAbertos } from '../servidores.model.js';
import { criarVinculo } from '../vinculos.model.js';
import { eLocalInterno } from '../../escolas/escolas.model.js';
import { sincronizarTelefones } from '../../telefones/telefones.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { mascaraCPF, mascaraRG, cpfCru, rgCru, noPadraoCPF, noPadraoRG } from '../../../shared/format.js';
import { drawerHead, abrirDrawer, fecharDrawer } from '../../../shared/ui/drawer.js';
import { phonesEditorHtml, montarPhonesEditor, lerPhonesEditor } from '../../../shared/ui/phones.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';
import { formVinculo } from './vinculo.js';
import { ico } from '../../../shared/ui/icones.js';

const OUTRO = '::outro::';

// Uma instância por gaveta aberta - reabrir "Novo servidor" sem destruir
// a de antes deixa um listener de document vivo (mesma armadilha de vinculo.js).
let buscaLocalNovo = null;

// `ctx`: { recarregar, podeEditar, locais, cargos } - ver servidores.view.js § ctxAtual().
export function formServidor(s, ctx, { voltar = null } = {}) {
  const novo = !s;
  const v = (k) => esc(s?.[k] ?? '');
  const cargo = s ? cargoDe(s) : '';
  const local = s ? localDeTrabalhoDe(s, { completo: true }) : '';

  buscaLocalNovo?.destruir();
  buscaLocalNovo = null;

  // Cargo e local de trabalho continuam à vista na edição - são o que
  // identifica a pessoa -, mas não são editáveis aqui: vêm do vínculo,
  // seu único dono. O botão de editar abre a gaveta do vínculo por cima.
  const derivado = (rotulo, valor, acao) => `
    <label>${rotulo}
      <span class="campo-derivado">
        <span class="cd-valor"${valor ? ` title="${esc(valor)}"` : ''}>${
          valor ? esc(valor) : '<span class="vazio">Sem local de trabalho</span>'}</span>
        ${ctx.podeEditar && !novo
          ? `<button type="button" class="mini-btn" data-vinc="${acao}"
               aria-label="${valor ? 'Editar' : 'Adicionar'} local de trabalho">${valor ? ico('editar') : ico('adicionar')}</button>`
          : ''}
      </span>
    </label>`;

  const opcoesCargo = (ctx.cargos || [])
    .map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

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
            ${novo ? '' : derivado('Cargo / função', cargo, 'cargo')}
            ${novo ? '' : derivado('Local de trabalho', local, 'lotacao')}
          </div>
        </fieldset>

        ${novo ? `
        <fieldset class="form-grupo">
          <legend>Local de trabalho
            <span class="form-hint" style="text-transform:none;font-weight:400;letter-spacing:0">opcional - pode adicionar depois pela ficha</span>
          </legend>
          <div class="campos auto">
            <label class="col-full">Local de trabalho <div id="s-local-box"></div></label>
            <label class="col-full">Cargo / função
              <select id="s-cargo">
                <option value="">Selecione…</option>
                ${opcoesCargo}
                <option value="${OUTRO}">+ Outro…</option>
              </select>
            </label>
            <label class="col-full" id="s-cargo-novo-wrap" hidden>Qual cargo / função?
              <input id="s-cargo-novo" placeholder="Ex.: Vice-diretor(a)" />
            </label>
            <label>Início <input id="s-vinc-ini" type="date" /></label>
          </div>
        </fieldset>` : ''}

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
    </div>`, { voltar });

  const form = document.getElementById('sv-form');
  montarPhonesEditor(form);

  if (novo) {
    buscaLocalNovo = criarBuscaSelecao(document.getElementById('s-local-box'), {
      opcoes: [...(ctx.locais || [])].map(l => ({
        id: l.id, rotulo: l.nome,
        detalhe: eLocalInterno(l) ? 'SME' : '',
        busca: l.apelido || '',
      })),
      placeholder: 'Buscar escola ou gerência…',
      vazioTexto: 'Nada com esse nome',
    });
    const selCargo = document.getElementById('s-cargo');
    selCargo.addEventListener('change', () => {
      const outro = selCargo.value === OUTRO;
      document.getElementById('s-cargo-novo-wrap').hidden = !outro;
      if (outro) document.getElementById('s-cargo-novo').focus();
    });
  }

  // Máscara enquanto digita. O caso comum é digitar do começo ao fim;
  // reformatar o valor inteiro mantém o cursor no lugar certo aí.
  const mascarar = (id, fn) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => { el.value = fn(el.value); });
    el.value = fn(el.value);
  };
  mascarar('s-cpf', mascaraCPF);
  mascarar('s-rg', mascaraRG);

  // O botão de editar cargo/local abre o vínculo sobre esta gaveta;
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
    cpf: cpfCru(val('s-cpf')) || null,
    rg: rgCru(val('s-rg')) || null,
    nascimento: document.getElementById('s-nascimento').value || null,
    inicio_rede: document.getElementById('s-ingresso').value || null,
  };
  if (!payload.nome) return falha(msg, 'Informe o nome completo.');

  // Local de trabalho da modal (só no cadastro novo). Local sem cargo é
  // erro: não dá para ter designação sem função. Cargo sem local é
  // ignorado com aviso.
  let vinc = null;
  if (!s && buscaLocalNovo) {
    const unidade_id = buscaLocalNovo.valorAtual();
    const escolhido = document.getElementById('s-cargo').value;
    const papel = escolhido === OUTRO ? val('s-cargo-novo') : escolhido;
    const ingresso = document.getElementById('s-vinc-ini').value || null;
    if (unidade_id && !String(papel).trim()) {
      return falha(msg, 'Escolha também o cargo do local de trabalho, ou deixe o local em branco.');
    }
    if (unidade_id) vinc = { unidade_id, papel, ingresso };
    else if (String(papel).trim()) {
      toast({ titulo: 'Cargo ignorado', texto: 'Escolha um local de trabalho para registrar o cargo.', tipo: 'atencao' });
    }
  }

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
    if (vinc) {
      try {
        await criarVinculo({ servidor_id: id, ...vinc });
      } catch (err) {
        // O servidor já está no banco; não desfaz. A ficha resolve.
        toast({ titulo: 'Servidor criado',
                texto: 'O local de trabalho não pôde ser salvo - adicione pela ficha.', tipo: 'atencao' });
      }
    }
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
    ? `Isso apaga junto ${n} registro(s) de local de trabalho, os horários e os afastamentos dele. Não pode ser desfeito.`
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
