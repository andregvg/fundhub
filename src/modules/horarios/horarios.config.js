// Declaração de configuração do módulo Horários. NÃO é model. Itens de
// rede: quais cargos são equipe gestora, a janela de cobertura por tipo
// de escola e o dia da semana de cada escala. Os painéis moram em
// views/ (cargos.js) e neste arquivo; os acessos, aqui.
import { conf, definirConf } from '../../core/configuracoes.js';
import { segmentosDaUnidade } from '../../core/segmentos.js';
import { paraMin, paraHora, DIAS } from './horarios.model.js';
import { JANELA_FABRICA } from './grade.model.js';
import { getEscalas, definirEscalaTipo } from './escalas.model.js';
import { pintarCargosGestao } from './views/cargos.js';
import { esc } from '../../shared/dom.js';
import { toast } from '../../shared/ui/toast.js';
import { loading, erroBox } from '../../shared/ui/feedback.js';

// Os tipos de cobertura que a rede usa. EMEF_EJA é o único combinado -
// uma EMEF que também atende EJA funciona até mais tarde.
export const TIPOS_COBERTURA = [
  { id: 'EMEF',       rotulo: 'EMEF' },
  { id: 'EMEF_EJA',   rotulo: 'EMEF com EJA' },
  { id: 'CEI',        rotulo: 'CEI' },
  { id: 'EMEI',       rotulo: 'EMEI' },
  { id: 'CONVENIADA', rotulo: 'Conveniada' },
];

// O tipo de cobertura de uma unidade: EMEF_EJA se é EMEF e tem EJA;
// senão o segmento-base. Sem segmento (a Sede) → null, sem cobertura.
export function tipoCobertura(u) {
  const segs = segmentosDaUnidade(u);
  if (!segs.length) return null;
  if (segs.includes('EMEF') && segs.includes('EJA')) return 'EMEF_EJA';
  return segs[0];
}

// A janela de cobertura de uma unidade, em minutos: { ini, fim }.
// Cai na janela de fábrica (07:00–18:20) quando o tipo não foi
// configurado ou a unidade não tem tipo.
export function janelaDaUnidade(u) {
  const tipo = tipoCobertura(u);
  const mapa = conf('horarios', 'cobertura_por_tipo') || {};
  const j = tipo && mapa[tipo];
  if (!j?.inicio || !j?.fim) return { ...JANELA_FABRICA };
  return { ini: paraMin(j.inicio), fim: paraMin(j.fim) };
}

export const DECLARACAO = {
  itens: [
    { chave: 'cargos_gestao', escopo: 'rede', grupo: 'regras',
      rotulo: 'Equipe gestora',
      dica: 'Quais cargos entram na grade e na cobertura por padrão.',
      painel: pintarCargosGestao },
    { chave: 'cobertura_por_tipo', escopo: 'rede', grupo: 'calendario',
      rotulo: 'Janela de cobertura por tipo de escola',
      dica: 'O horário em que precisa haver alguém da equipe gestora na unidade. O padrão é 07:00–18:20 para todos os tipos.',
      painel: pintarCoberturaPorTipo },
    { chave: 'dia_semana_escala', escopo: 'rede', grupo: 'calendario',
      rotulo: 'Dia da semana de cada escala',
      dica: 'Em que dia o TDC costuma cair. O calendário ainda manda na resolução de cada data - isto só faz a escala aparecer na jornada antes de o calendário do ano ser lançado.',
      painel: pintarDiasDeEscala },
  ],
};

async function pintarDiasDeEscala(box) {
  if (!box) return;
  box.innerHTML = loading();
  let catalogo;
  try { catalogo = await getEscalas(); }
  catch (err) { box.innerHTML = erroBox(err); return; }

  const escalas = catalogo.filter(e => e.chave !== 'normal');
  if (!escalas.length) {
    box.innerHTML = '<p class="form-hint">Nenhuma escala de TDC no catálogo ainda.</p>';
    return;
  }

  box.innerHTML = `<div class="cfg-dias esc-form">${escalas.map(e => `
    <div class="cfg-dia-linha campos" data-chave="${esc(e.chave)}">
      <label>${esc(e.rotulo)}
        <select class="cfg-dia-sel">
          <option value="">sem dia fixo</option>
          ${DIAS.map(d => `<option value="${d.n}" ${e.dia_semana === d.n ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}
        </select>
      </label>
    </div>`).join('')}</div>`;

  box.addEventListener('change', async (e) => {
    const sel = e.target.closest('.cfg-dia-sel'); if (!sel) return;
    const chave = sel.closest('[data-chave]').dataset.chave;
    sel.disabled = true;
    try {
      await definirEscalaTipo(chave, { dia_semana: sel.value ? Number(sel.value) : null });
      toast({ titulo: 'Dia da escala atualizado', tipo: 'sucesso' });
    } catch (err) {
      toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' });
    } finally { sel.disabled = false; }
  });
}

function pintarCoberturaPorTipo(box) {
  if (!box) return;
  const mapa = conf('horarios', 'cobertura_por_tipo') || {};
  const padraoIni = paraHora(JANELA_FABRICA.ini).slice(0, 5);
  const padraoFim = paraHora(JANELA_FABRICA.fim).slice(0, 5);

  box.innerHTML = `
    <div class="cfg-cobertura esc-form">
      ${TIPOS_COBERTURA.map(t => `
        <div class="cfg-cob-linha campos" data-tipo="${esc(t.id)}">
          <span class="cfg-cob-tipo">${esc(t.rotulo)}</span>
          <label>Início <input type="time" class="cfg-cob-ini" value="${esc(mapa[t.id]?.inicio || padraoIni)}" /></label>
          <label>Fim <input type="time" class="cfg-cob-fim" value="${esc(mapa[t.id]?.fim || padraoFim)}" /></label>
        </div>`).join('')}
    </div>`;

  box.addEventListener('change', async (e) => {
    if (!e.target.matches('.cfg-cob-ini, .cfg-cob-fim')) return;
    const obj = {};
    box.querySelectorAll('.cfg-cob-linha').forEach(linha => {
      const ini = linha.querySelector('.cfg-cob-ini').value;
      const fim = linha.querySelector('.cfg-cob-fim').value;
      if (ini && fim && !(ini === padraoIni && fim === padraoFim)) {
        obj[linha.dataset.tipo] = { inicio: ini, fim };
      }
    });
    try {
      await definirConf('horarios', 'cobertura_por_tipo', obj);
      toast({ titulo: 'Cobertura salva', tipo: 'sucesso' });
    } catch (err) {
      toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' });
    }
  });
}
