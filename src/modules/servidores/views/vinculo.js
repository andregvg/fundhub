// ============================================================
// FundHub - servidores/views/vinculo.js
// O formulário do LOCAL DE TRABALHO: local, cargo, início e fim.
//
// Sem ano letivo: é um período, e "está atual" é não ter data de fim.
// Encerrar é preencher o Término - o mesmo formulário, e não mais um
// prompt() do navegador (R16).
//
// Pode ser aberto sobre a ficha do servidor: quem chama passa
// `voltar`, e o Esc desempilha em vez de fechar tudo.
// ============================================================
import { criarVinculo, atualizarVinculo, excluirVinculo, rotulaCargo, FUNCOES, temFuncao, mudarFuncao } from '../vinculos.model.js';
import { quemTemFuncao } from '../equipe.model.js';
import { eLocalInterno } from '../../escolas/escolas.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

const OUTRO = '::outro::';   // sentinela: os dois-pontos garantem que
                             // nenhum cargo digitado colide com ele

// Uma instância por modal aberta - "Adicionar"/"Editar" repetidos na
// mesma ficha do servidor criam uma instância a cada chamada; sem
// destruir a de antes, cada uma deixa um listener de document vivo
// (mesma armadilha de por-escola.js).
let buscaLocal = null;

// `ctx`: { locais, cargos, recarregar } - ver servidores.view.js § ctxAtual().
export function formVinculo(s, vinculo, ctx, { voltar = null } = {}) {
  const novo = !vinculo;
  const cargoAtual = rotulaCargo(vinculo?.papel || '');
  const conhecido = !cargoAtual || ctx.cargos.includes(cargoAtual);

  buscaLocal?.destruir();
  buscaLocal = null;

  // O catálogo é derivado dos vínculos existentes: nasce vazio numa
  // base sem ninguém e ganha o cargo assim que alguém digita um.
  const opcoesCargo = ctx.cargos.map(c =>
    `<option value="${esc(c)}" ${c === cargoAtual ? 'selected' : ''}>${esc(c)}</option>`).join('');

  abrirModal(`
    ${modalHead(novo ? 'Adicionar local de trabalho' : 'Editar local de trabalho', esc(s.nome))}
    <div class="modal-body">
      <form id="vc-form" class="esc-form">
        <fieldset class="form-grupo">
          <legend>Local de trabalho</legend>
          <div class="campos auto">
            <label class="col-full">Local de trabalho
              <div id="v-local-box"></div>
            </label>
            <label class="col-full">Cargo / função
              <select id="v-cargo" required>
                <option value="">Selecione…</option>
                ${opcoesCargo}
                <option value="${OUTRO}" ${cargoAtual && !conhecido ? 'selected' : ''}>+ Outro…</option>
              </select>
            </label>
            <label class="col-full" id="v-novo-wrap" ${cargoAtual && !conhecido ? '' : 'hidden'}>
              Qual cargo / função?
              <input id="v-novo" value="${esc(conhecido ? '' : cargoAtual)}" placeholder="Ex.: Vice-diretor(a)" />
            </label>
            <label class="col-full" id="v-funcao-wrap" hidden>Função
              <select id="v-funcao">
                <option value="">Não definida</option>
                ${FUNCOES.map(f => `<option value="${f.valor}" ${vinculo?.funcao === f.valor ? 'selected' : ''}>${esc(f.rotulo)}</option>`).join('')}
              </select>
            </label>
            <label class="col-full" id="v-desde-wrap" hidden>Mudou a partir de
              <input id="v-desde" type="date" />
              <small class="form-hint">Preencha se a pessoa trocou de função: o período anterior fica no histórico.
                Em branco, o registro é só corrigido.</small>
            </label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Período</legend>
          <div class="campos auto">
            <label>Início <input id="v-ini" type="date" value="${esc(vinculo?.ingresso || '')}" /></label>
            <label>Término <input id="v-fim" type="date" value="${esc(vinculo?.fim || '')}" />
              <small class="form-hint">Em branco = local de trabalho atual.</small></label>
          </div>
        </fieldset>

        <div class="form-foot">
          <span id="v-msg" class="auth-msg"></span>
          <button type="submit" id="v-save" class="btn-primary">${novo ? 'Adicionar' : 'Salvar'}</button>
        </div>
      </form>
      ${novo ? '' : `<button type="button" class="mini-btn no" id="v-del" style="margin-top:16px">${ico('excluir')} Excluir local de trabalho</button>
      <p class="form-hint" style="margin-top:10px">Para preservar o histórico, prefira preencher o Término em vez de excluir.</p>`}
    </div>`, { voltar });

  // Busca por nome no lugar do <select> com as 144 escolas + gerências.
  buscaLocal = criarBuscaSelecao(document.getElementById('v-local-box'), {
    opcoes: [...ctx.locais]
      .map(l => ({ id: l.id, rotulo: l.nome, detalhe: eLocalInterno(l) ? 'SME' : '', busca: l.apelido || '' })),
    valor: vinculo?.unidade_id || '',
    placeholder: 'Buscar escola ou gerência…',
    vazioTexto: 'Nada com esse nome',
  });

  const sel = document.getElementById('v-cargo');
  sel.addEventListener('change', () => {
    const outro = sel.value === OUTRO;
    document.getElementById('v-novo-wrap').hidden = !outro;
    if (outro) document.getElementById('v-novo').focus();
  });

  // A função só existe no cargo de gestor (D12). "Mudou a partir de" só
  // aparece quando há uma TROCA a datar: local de trabalho atual, que já
  // tinha função, e a escolhida é outra. Definir a função de quem não tinha
  // nenhuma é correção - sem pergunta.
  const cargoEscolhido = () => (sel.value === OUTRO ? document.getElementById('v-novo').value : sel.value);
  const funcaoEscolhida = () => Number(document.getElementById('v-funcao').value) || null;
  const eTroca = () => Boolean(vinculo && !vinculo.fim && vinculo.funcao
    && funcaoEscolhida() && funcaoEscolhida() !== vinculo.funcao);
  const pintarFuncao = () => {
    const gestor = temFuncao(cargoEscolhido());
    document.getElementById('v-funcao-wrap').hidden = !gestor;
    document.getElementById('v-desde-wrap').hidden = !(gestor && eTroca());
  };
  sel.addEventListener('change', pintarFuncao);
  document.getElementById('v-novo').addEventListener('input', pintarFuncao);
  document.getElementById('v-funcao').addEventListener('change', pintarFuncao);
  pintarFuncao();

  document.getElementById('vc-form').addEventListener('submit', (e) => salvar(e, s, vinculo, ctx, voltar, buscaLocal));
  document.getElementById('v-del')?.addEventListener('click', () => removerVinculo(s, vinculo.id, ctx));
}

async function salvar(e, s, vinculo, ctx, voltar, buscaLocal) {
  e.preventDefault();
  const msg = document.getElementById('v-msg'); msg.className = 'auth-msg';
  const unidade_id = buscaLocal.valorAtual();
  const escolhido = document.getElementById('v-cargo').value;
  const papel = escolhido === OUTRO ? document.getElementById('v-novo').value : escolhido;
  const ingresso = document.getElementById('v-ini').value || null;
  const fim = document.getElementById('v-fim').value || null;

  if (!unidade_id) return falha(msg, 'Selecione o local de trabalho.');
  if (!String(papel).trim()) return falha(msg, 'Informe o cargo/função.');
  // Fim antes do início é impossível, não indesejável: barra (R15).
  if (ingresso && fim && fim < ingresso) return falha(msg, 'O término não pode ser anterior ao início.');

  const funcao = temFuncao(papel) ? (Number(document.getElementById('v-funcao').value) || null) : null;
  const desde = document.getElementById('v-desde-wrap').hidden ? '' : document.getElementById('v-desde').value;

  // Troca datada: é a única coisa que este salvamento faz. Misturar com
  // mudança de local ou de datas deixaria ambíguo a que período cada
  // alteração pertence.
  if (desde) {
    const mexeuNoResto = unidade_id !== vinculo.unidade_id
      || (ingresso || null) !== (vinculo.ingresso || null) || (fim || null) !== (vinculo.fim || null)
      || rotulaCargo(papel) !== rotulaCargo(vinculo.papel);
    if (mexeuNoResto) return falha(msg, 'Salve a troca de função separada das outras alterações.');
  }

  const btn = document.getElementById('v-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (desde) await mudarFuncao(s.id, vinculo, funcao, desde);
    else if (vinculo) await atualizarVinculo(vinculo.id, { unidade_id, papel, ingresso, fim, funcao });
    else await criarVinculo({ servidor_id: s.id, unidade_id, papel, ingresso, fim, funcao });

    // Aviso, não erro (R15): numa transição dois gestores com a mesma
    // função se encostam. A consulta é depois de gravar e não derruba nada.
    // Mostrado depois do toast de sucesso: o aviso é a última coisa lida.
    // Só quando a função passou a valer num lugar ou período NOVO (local novo,
    // função diferente, troca datada, outro local, ou local encerrado que foi
    // reaberto): corrigir só a data de início de quem já era Gestor 1 não é
    // motivo para avisar de novo.
    const tocou = Boolean(desde) || !vinculo || funcao !== (vinculo.funcao || null)
      || unidade_id !== vinculo.unidade_id || Boolean(vinculo.fim && !fim);
    let outro = null;
    if (funcao && !fim && tocou) outro = await quemTemFuncao(unidade_id, funcao, s.id).catch(() => null);
    const novoCtx = await ctx.recarregar();
    // Volta para o modal de baixo já com o dado novo: passamos o ctx
    // recarregado para quem chamou reconstruir a tela a partir dele.
    if (voltar) voltar(novoCtx); else novoCtx.abrirDetalhe(s.id);
    const encerrou = vinculo && !vinculo.fim && fim;
    const titulo = desde ? 'Função alterada' : !vinculo ? 'Local de trabalho adicionado'
      : (encerrou ? 'Local de trabalho encerrado' : 'Local de trabalho atualizado');
    toast({ titulo, texto: s.nome, tipo: 'sucesso' });
    if (outro) toast({ titulo: `Este local já tem Gestor ${funcao}`, texto: outro.nome, tipo: 'atencao' });
  } catch (err) {
    // Erro de gravação: inline quando dá para corrigir no formulário
    // aberto, toast quando não dá - reportarErro decide pelo código.
    // vinculo_aberto_unico (023) recusa um segundo aberto: 23505.
    reportarErro(err, { msg, titulo: 'Não foi possível salvar' });
    btn.disabled = false; btn.textContent = vinculo ? 'Salvar' : 'Adicionar';
  }
}

export async function removerVinculo(s, vinculoId, ctx) {
  const ok = await confirmar('Excluir este local de trabalho?', {
    detalhe: 'Excluir apaga o registro. Para preservar o histórico, preencha o Término.',
    textoOk: 'Excluir', perigo: true,
  });
  if (!ok) return;
  try {
    await excluirVinculo(vinculoId);
    const novoCtx = await ctx.recarregar();
    novoCtx.abrirDetalhe(s.id);
    toast({ titulo: 'Local de trabalho excluído', texto: s.nome, tipo: 'sucesso' });
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível excluir' });
  }
}
