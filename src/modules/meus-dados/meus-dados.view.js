// ============================================================
// FundHub — modules/meus-dados/meus-dados.view.js
// A tela em que a pessoa cuida do próprio cadastro.
//
// O que ela PODE editar: nome de exibição e, se o perfil estiver
// ligado a um cadastro funcional, os dados de contato desse servidor
// (apelido, e-mail alternativo, telefones).
//
// O que ela NÃO pode: papel, segmentos, permissões e o vínculo com o
// servidor. Isso é decisão de administrador — e não depende de a tela
// esconder: a policy perfil_upd deixa a linha ser atualizada, mas o
// trigger fn_perfil_protege_privilegio devolve esses campos ao valor
// antigo se quem edita não é admin. Se este arquivo tentasse mandar
// papel novo, o banco simplesmente ignoraria.
//
// Também não há troca de senha, porque não há senha: o acesso é por
// link mágico ou conta Google.
// ============================================================
import { getMeuPerfil, salvarMeuNome } from '../usuarios/usuarios.model.js';
import { atualizarServidor, rotulaLotacao, rotulaPapel, ANO_LETIVO } from '../servidores/servidores.model.js';
import { sincronizarTelefones, getTelefonesMapas } from '../telefones/telefones.model.js';
import { recarregarPerfil } from '../../core/perfil.js';
import { mapaAtual, rotulaNivel, OCULTO } from '../../core/permissoes.js';
import { MODULOS, chavePerm } from '../../core/registry.js';
import { rotuloSelecao } from '../../core/segmentos.js';
import { esc, falha } from '../../shared/dom.js';
import { fmtData, fmtDataHora } from '../../shared/format.js';
import { erroBox, emptyState } from '../../shared/ui/feedback.js';
import { phonesEditorHtml, montarPhonesEditor, lerPhonesEditor } from '../../shared/ui/phones.js';
import { signOut } from '../../core/auth.js';

let perfil = null, servidor = null, telefones = [];

export async function render(app, ctx = {}) {
  try {
    perfil = await getMeuPerfil();
  } catch (err) {
    app.innerHTML = erroBox(err);
    return;
  }
  if (!perfil) {
    app.innerHTML = emptyState('🪪', 'Perfil não encontrado',
      'Seu acesso existe, mas o cadastro não foi localizado. Fale com a Gerência de Ensino Fundamental.');
    return;
  }

  servidor = perfil.servidor || null;
  if (servidor) {
    const mapas = await getTelefonesMapas().catch(() => ({ porServidor: {} }));
    telefones = mapas.porServidor?.[servidor.id] || [];
  }

  app.innerHTML = `
    <div class="page-head">
      <h1>Meus dados</h1>
      <p>Seu cadastro no FundHub. O que estiver bloqueado só um administrador altera.</p>
    </div>

    <div class="md-grid">
      <section class="panel">
        <h2 class="secao-tit">Conta</h2>
        <form id="md-conta" class="esc-form">
          <label>E-mail institucional
            <input value="${esc(perfil.email)}" readonly />
            <small class="form-hint">É a sua identidade no hub — não pode ser alterado.</small></label>
          <label>Nome de exibição
            <input id="md-nome" value="${esc(perfil.nome || '')}" placeholder="Como você quer ser chamado(a)" /></label>
          <div class="form-foot">
            <span id="md-msg" class="auth-msg"></span>
            <button type="submit" id="md-save" class="btn-primary">Salvar</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <h2 class="secao-tit">Acesso</h2>
        ${blocoAcesso()}
      </section>
    </div>

    ${servidor ? blocoServidor() : blocoSemServidor()}

    <section class="panel" style="margin-top:16px">
      <h2 class="secao-tit">Sessão</h2>
      <p class="form-hint">O FundHub não usa senha: você entra por link enviado ao
         seu e-mail institucional ou pela sua conta Google. Não há senha a redefinir.</p>
      <button type="button" id="md-sair" class="btn-secundario" style="margin-top:10px">Encerrar sessão</button>
    </section>`;

  document.getElementById('md-conta').addEventListener('submit', salvarConta);
  document.getElementById('md-sair').addEventListener('click', () => signOut());

  if (servidor) {
    montarPhonesEditor(document.getElementById('md-servidor'));
    document.getElementById('md-servidor').addEventListener('submit', salvarServidor);
  }
}

// ── Blocos de leitura ────────────────────────────────────────
function blocoAcesso() {
  const mapa = mapaAtual();
  const visiveis = MODULOS
    .filter(m => m.rota && (mapa[chavePerm(m)] || OCULTO) !== OCULTO)
    .map(m => `<span class="tag">${m.ico} ${esc(m.navNome || m.nome)} · ${esc(rotulaNivel(mapa[chavePerm(m)]))}</span>`)
    .join('');

  return `
    <div class="field"><div class="lbl">Papel</div>
      <div class="val">${esc(perfil.papel_rotulo || perfil.papel || 'leitor')}</div></div>
    <div class="field"><div class="lbl">Segmentos de atuação</div>
      <div class="val">${esc(rotuloSelecao(perfil.segmentos))}</div></div>
    <div class="field"><div class="lbl">Último acesso</div>
      <div class="val">${esc(fmtDataHora(perfil.ultimo_acesso))}</div></div>
    <div class="field"><div class="lbl">Módulos liberados</div>
      <div class="tags" style="margin-top:4px">${visiveis || '<span class="count">Nenhum.</span>'}</div></div>
    <p class="form-hint">Precisa de outro módulo ou de mudar o segmento?
       Fale com a Gerência de Ensino Fundamental.</p>`;
}

function blocoSemServidor() {
  return `
    <section class="panel" style="margin-top:16px">
      <h2 class="secao-tit">Cadastro funcional</h2>
      ${emptyState('👥', 'Seu acesso não está ligado a um cadastro de servidor',
        `Por isso não há contatos para editar aqui. Se você é servidor da rede, peça a um
         administrador para ligar o seu acesso ao seu cadastro em Servidores.`)}
    </section>`;
}

function blocoServidor() {
  const s = servidor;
  const vinculos = (s.vinculos || []).filter(v => v.ativo && v.ano === ANO_LETIVO);
  return `
    <section class="panel" style="margin-top:16px">
      <h2 class="secao-tit">Cadastro funcional</h2>
      <form id="md-servidor" class="esc-form">

        <fieldset class="form-grupo">
          <legend>Identificação (somente leitura)</legend>
          <div class="campos duas">
            <label>Nome completo <input value="${esc(s.nome || '')}" readonly /></label>
            <label>Código funcional <input value="${esc(s.codigo_funcional || '')}" readonly /></label>
            <label>Lotação <input value="${esc(rotulaLotacao(s.lotacao))}" readonly /></label>
            <label>Cargo / função <input value="${esc(s.cargo || '')}" readonly /></label>
            <label>Ingresso na rede <input value="${esc(s.inicio_rede ? fmtData(s.inicio_rede) : '')}" readonly /></label>
          </div>
          <small class="form-hint">Nome, documentos e lotação constam da folha —
            correções são feitas por um administrador.</small>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Contato (você pode editar)</legend>
          <div class="campos">
            <label>Apelido / como é chamado(a)
              <input id="md-apelido" value="${esc(s.apelido || '')}" /></label>
            <label>E-mail de contato
              <input id="md-email" type="email" value="${esc(s.email || '')}" /></label>
            ${phonesEditorHtml(telefones)}
          </div>
        </fieldset>

        ${vinculos.length ? `
        <fieldset class="form-grupo">
          <legend>Lotações vigentes em ${ANO_LETIVO}</legend>
          <div class="tags">
            ${vinculos.map(v => `<span class="tag">${esc(v.unidade?.nome || '—')} · ${esc(rotulaPapel(v.papel))}</span>`).join('')}
          </div>
        </fieldset>` : ''}

        <div class="form-foot">
          <span id="md-smsg" class="auth-msg"></span>
          <button type="submit" id="md-ssave" class="btn-primary">Salvar contatos</button>
        </div>
      </form>
    </section>`;
}

// ── Gravação ─────────────────────────────────────────────────
async function salvarConta(e) {
  e.preventDefault();
  const msg = document.getElementById('md-msg'); msg.className = 'auth-msg';
  const btn = document.getElementById('md-save');
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    await salvarMeuNome(perfil.email, document.getElementById('md-nome').value.trim());
    await recarregarPerfil();
    msg.classList.add('ok'); msg.textContent = 'Salvo.';
  } catch (err) {
    falha(msg, 'Não foi possível salvar: ' + (err.message || err));
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar';
  }
}

async function salvarServidor(e) {
  e.preventDefault();
  const msg = document.getElementById('md-smsg'); msg.className = 'auth-msg';
  const btn = document.getElementById('md-ssave');
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    await atualizarServidor(servidor.id, {
      apelido: document.getElementById('md-apelido').value.trim() || null,
      email: document.getElementById('md-email').value.trim() || null,
    });
    await sincronizarTelefones(
      { servidorId: servidor.id },
      lerPhonesEditor(document.getElementById('md-servidor')));
    msg.classList.add('ok'); msg.textContent = 'Contatos atualizados.';
  } catch (err) {
    falha(msg, 'Não foi possível salvar: ' + (err.message || err));
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar contatos';
  }
}
