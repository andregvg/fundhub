// ============================================================
// FundHub — afastamentos/views/sincronizacao.js  (sync da planilha)
// A aba "Lançamentos" (Apps Script afastamentos-gestores) segue sendo o
// ponto de lançamento — inclusive das respostas do formulário dos gestores.
// Aqui o FundHub ESPELHA aquela aba: cola-se o recorte com cabeçalho e o
// upsert é IDEMPOTENTE pela chave_externa (tipo|nome|início|criado_em, a
// mesma identidade que o Apps Script usa) — reimportar atualiza, não duplica.
//
// Por que colar e não buscar da planilha: buscar exigiria publicá-la na web
// (expondo dado pessoal de servidor, o que a regra de segurança proíbe) ou
// uma Edge Function com service account. Colar mantém o dado no caminho
// autenticado. O sync automático está no backlog C do HANDOFF.
// ============================================================
import { TIPOS_AFASTAMENTO, MAPA_TIPOS_PLANILHA, sincronizarPlanilha } from '../afastamentos.model.js';
import { esc, norm, falha, ok } from '../../../shared/dom.js';
import { agoraISO } from '../../../shared/format.js';
import { drawerHead, abrirDrawer } from '../../../shared/ui/drawer.js';

const STATUS_PLANILHA = {
  ativo: 'ativo', importado: 'importado',
  excluido: 'cancelado', cancelado: 'cancelado',
};

function tipoDaPlanilha(v) {
  const raw = String(v || '').trim();
  if (TIPOS_AFASTAMENTO.includes(raw)) return raw;
  return MAPA_TIPOS_PLANILHA[norm(raw)] || 'Outro';
}

// "aaaa-mm-dd" ou "dd/mm/aaaa" → "aaaa-mm-dd"
function parseDataBR(v) {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

// "dd/mm/aaaa HH:MM" → ISO (ou null). Usado para espelhar criado_em.
// Não é agoraISO(): serializa uma data JÁ PARSEADA da planilha, não "agora" —
// por isso fica aqui, e não em shared/format.js (é parsing de um formato
// externo específico deste módulo, não formatação de exibição reusável).
function parseCarimbo(v) {
  const m = String(v || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).toISOString(); // fundhub:ok-6 ver comentario acima
}

// `ctx`: { servidores, unidades, carregar } — ver afastamentos.view.js § ctxAtual().
export function abrirSync(ctx) {
  abrirDrawer(`
    ${drawerHead('Sincronizar com a planilha', 'Aba “Lançamentos” do Drive')}
    <div class="drawer-body">
      <p class="form-hint">
        Copie da aba <b>Lançamentos</b> (com a linha de cabeçalho) e cole abaixo.
        Reconhece as colunas do Apps Script: <code>tipo, data_inicio, data_fim,
        nome_completo, processo, escola, status, origem, observacoes, criado_em,
        criado_por, atualizado_por</code>.
        A sincronização é <b>idempotente</b> — colar o mesmo trecho de novo
        <b>atualiza</b> os registros, nunca duplica.
        Gestores que não estiverem cadastrados em <a href="#/servidores">Servidores</a>
        são <b>ignorados e listados</b> no fim.
      </p>
      <form id="sync-form" class="esc-form">
        <label>Dados da planilha
          <textarea id="sync-txt" rows="10" placeholder="tipo	data_inicio	data_fim	nome_completo	…"></textarea>
        </label>
        <div class="form-foot">
          <span id="sync-msg" class="auth-msg"></span>
          <button type="submit" id="sync-save">Sincronizar</button>
        </div>
      </form>
      <div id="sync-relatorio"></div>
    </div>`);
  document.getElementById('sync-form').addEventListener('submit', (e) => sincronizar(e, ctx));
}

async function sincronizar(e, ctx) {
  e.preventDefault();
  const msg = document.getElementById('sync-msg'); msg.className = 'auth-msg';
  const txt = document.getElementById('sync-txt').value.trim();
  if (!txt) return falha(msg, 'Cole os dados da planilha.');

  const linhas = txt.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return falha(msg, 'Inclua o cabeçalho e ao menos uma linha.');
  const sep = linhas[0].includes('\t') ? '\t' : (linhas[0].includes(';') ? ';' : ',');
  const hdr = linhas[0].split(sep).map(h => norm(h).replace(/\s+/g, '_'));
  const col = (n) => hdr.indexOf(n);
  const iTipo = col('tipo'), iIni = col('data_inicio'), iFim = col('data_fim');
  const iNome = col('nome_completo'), iProc = col('processo'), iEsc = col('escola');
  const iStatus = col('status'), iOrigem = col('origem'), iObs = col('observacoes');
  const iCriadoEm = col('criado_em'), iCriadoPor = col('criado_por'), iAtualPor = col('atualizado_por');
  if (iNome < 0 || iIni < 0) return falha(msg, 'Cabeçalho sem as colunas "nome_completo" e "data_inicio".');

  // Índices para casar gestor e escola por nome normalizado.
  const porServidor = new Map();
  ctx.servidores.forEach(s => {
    porServidor.set(norm(s.nome), s);
    if (s.apelido && !porServidor.has(norm(s.apelido))) porServidor.set(norm(s.apelido), s);
  });
  const porUnidade = new Map();
  ctx.unidades.forEach(u => {
    porUnidade.set(norm(u.nome), u);
    if (u.apelido && !porUnidade.has(norm(u.apelido))) porUnidade.set(norm(u.apelido), u);
  });

  const rows = [], semServidor = new Set(), invalidas = [];
  for (let i = 1; i < linhas.length; i++) {
    const c = linhas[i].split(sep);
    const nome = String(c[iNome] || '').trim();
    const inicio = parseDataBR(c[iIni]);
    if (!nome || !inicio) { invalidas.push(i + 1); continue; }

    const serv = porServidor.get(norm(nome));
    if (!serv) { semServidor.add(nome); continue; }

    const tipoRaw = iTipo >= 0 ? String(c[iTipo] || '').trim() : '';
    const criadoEmRaw = iCriadoEm >= 0 ? String(c[iCriadoEm] || '').trim() : '';
    const uni = iEsc >= 0 ? porUnidade.get(norm(String(c[iEsc] || '').trim())) : null;
    const statusRaw = iStatus >= 0 ? norm(String(c[iStatus] || '').trim()) : '';

    rows.push({
      // identidade NA PLANILHA (idêntica ao chaveRec do Apps Script)
      chave_externa: `${tipoRaw}|${nome}|${inicio}|${criadoEmRaw}`,
      servidor_id: serv.id,
      unidade_id: uni ? uni.id : null,
      tipo: tipoDaPlanilha(tipoRaw),
      inicio,
      fim: iFim >= 0 ? parseDataBR(c[iFim]) : null,
      processo: iProc >= 0 ? (String(c[iProc] || '').trim() || null) : null,
      motivo: iObs >= 0 ? (String(c[iObs] || '').trim() || null) : null,
      status: STATUS_PLANILHA[statusRaw] || 'ativo',
      origem: iOrigem >= 0 ? (norm(String(c[iOrigem] || '').trim()) || 'planilha') : 'planilha',
      // Sempre presente: o upsert em lote do PostgREST exige chaves uniformes
      // e criado_em é NOT NULL. (criado_em/atualizado_em são "ruído" para a
      // auditoria — ver 011 — então re-sincronizar não polui o log.)
      criado_em: parseCarimbo(criadoEmRaw) || agoraISO(),
      criado_por: iCriadoPor >= 0 ? (String(c[iCriadoPor] || '').trim() || null) : null,
      atualizado_em: agoraISO(),
      atualizado_por: iAtualPor >= 0 ? (String(c[iAtualPor] || '').trim() || null) : null,
    });
  }

  const rel = document.getElementById('sync-relatorio');
  if (!rows.length) {
    falha(msg, 'Nenhuma linha sincronizável.');
    rel.innerHTML = relatorioSync(0, invalidas, semServidor);
    return;
  }

  const btn = document.getElementById('sync-save'); btn.disabled = true; btn.textContent = 'Sincronizando…';
  try {
    const n = await sincronizarPlanilha(rows);
    ok(msg, `${n} registro(s) sincronizado(s).`);
    rel.innerHTML = relatorioSync(n, invalidas, semServidor);
    await ctx.carregar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
  } finally {
    btn.disabled = false; btn.textContent = 'Sincronizar';
  }
}

function relatorioSync(n, invalidas, semServidor) {
  const faltantes = [...semServidor];
  return `
    <hr class="sep" />
    <div class="field"><div class="lbl">Resultado</div>
      <div class="val">${n} sincronizado(s)${invalidas.length ? ` · ${invalidas.length} linha(s) inválida(s)` : ''}${faltantes.length ? ` · ${faltantes.length} sem cadastro` : ''}</div>
    </div>
    ${faltantes.length ? `
      <div class="field">
        <div class="lbl">Gestores não cadastrados (ignorados)</div>
        <div class="val">
          <p class="form-hint">Cadastre em <a href="#/servidores">Servidores</a> e sincronize de novo — os registros entram sem duplicar.</p>
          <ul class="af-faltantes">${faltantes.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>
      </div>` : ''}`;
}
