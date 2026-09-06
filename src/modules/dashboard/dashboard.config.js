// Declaração de configuração do módulo Dashboard. NÃO é model. É a
// lista canônica dos painéis (metadados, sem as funções de pintura -
// essas moram em views/paineis.js) + os acessos das duas preferências
// + o painel de ordenação. O padrão mora aqui.
import { pref, definirPref } from '../../core/configuracoes.js';
import { nivel, OCULTO } from '../../core/permissoes.js';
import { esc } from '../../shared/dom.js';
import { ico } from '../../shared/ui/icones.js';
import { toast } from '../../shared/ui/toast.js';

// O `id` é o que a preferência guarda e NUNCA muda - renomear o título
// é livre, renomear o id perde a ordem de todo mundo. `perm` ausente:
// o painel compõe dados de vários módulos e degrada sozinho.
export const PAINEIS_META = [
  { id: 'numeros',      titulo: 'Números do dia',      ico: 'dashboard' },
  { id: 'hoje',         titulo: 'Nesta data',          ico: 'horario' },
  { id: 'extraclasse',  titulo: 'Extraclasse hoje',    ico: 'transporte',  perm: 'sate' },
  { id: 'afastamentos', titulo: 'Afastamentos hoje',   ico: 'afastamento', perm: 'afastamentos' },
  { id: 'calendario',   titulo: 'Calendário hoje',     ico: 'calendario',  perm: 'calendario' },
  { id: 'ocorrencias',  titulo: 'Ocorrências de hoje', ico: 'ocorrencia',  perm: 'ocorrencias' },
];

const ORDEM_NATURAL = PAINEIS_META.map(p => p.id);

// Aplica a preferência de ordem sobre os ids que de fato existem:
// descarta id desconhecido, acrescenta id novo no fim. Sem isto,
// acrescentar um painel no futuro o tornaria invisível para quem já
// ordenou a tela.
export function ordemResolvida(idsDisponiveis) {
  const salva = pref('dashboard', 'ordem_paineis');
  const base = Array.isArray(salva) && salva.length ? salva : ORDEM_NATURAL;
  const naOrdem = base.filter(id => idsDisponiveis.includes(id));
  const faltando = idsDisponiveis.filter(id => !naOrdem.includes(id));
  return [...naOrdem, ...faltando];
}

export const paineisOcultos = () => {
  const v = pref('dashboard', 'paineis_ocultos');
  return Array.isArray(v) ? v : [];
};

export async function definirOrdem(ids)   { await definirPref('dashboard', 'ordem_paineis', ids); }
export async function definirOcultos(ids) { await definirPref('dashboard', 'paineis_ocultos', ids); }

export const DECLARACAO = {
  itens: [
    { chave: 'paineis', escopo: 'usuario', grupo: 'exibicao',
      rotulo: 'Painéis do dashboard',
      dica: 'Escolha o que aparece e em que ordem. Você também pode arrastar os painéis pelo título.',
      painel: pintarPaineisConfig },
  ],
};

async function pintarPaineisConfig(box) {
  if (!box) return;
  const disponiveis = PAINEIS_META.filter(p => !p.perm || nivel(p.perm) !== OCULTO);
  const ids = ordemResolvida(disponiveis.map(p => p.id));
  let ocultos = paineisOcultos();
  const meta = (id) => disponiveis.find(p => p.id === id);

  const desenhar = () => {
    box.innerHTML = `<div class="cfg-paineis">${ids.map((id, i) => {
      const m = meta(id); if (!m) return '';
      const oculto = ocultos.includes(id);
      return `<div class="cfg-painel-linha" data-id="${esc(id)}">
        <label class="switch">
          <input type="checkbox" class="cfg-painel-on" ${oculto ? '' : 'checked'} />
          <span class="switch-trilho" aria-hidden="true"></span></label>
        <span class="cfg-painel-nome">${ico(m.ico, { tam: 14 })} ${esc(m.titulo)}</span>
        <span class="cfg-painel-setas">
          <button type="button" class="mini-btn cfg-painel-cima" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ico('subir', { tam: 13 })}</button>
          <button type="button" class="mini-btn cfg-painel-baixo" aria-label="Descer" ${i === ids.length - 1 ? 'disabled' : ''}><span class="gira-180">${ico('subir', { tam: 13 })}</span></button>
        </span>
      </div>`;
    }).join('')}</div>`;

    box.querySelectorAll('.cfg-painel-on').forEach(inp => inp.addEventListener('change', async () => {
      const id = inp.closest('[data-id]').dataset.id;
      ocultos = inp.checked ? ocultos.filter(x => x !== id) : [...ocultos, id];
      try { await definirOcultos(ocultos); toast({ titulo: 'Preferência salva', tipo: 'sucesso' }); }
      catch (err) { toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' }); }
    }));

    const mover = async (id, delta) => {
      const pos = ids.indexOf(id);
      const alvo = pos + delta;
      if (alvo < 0 || alvo >= ids.length) return;
      ids.splice(pos, 1); ids.splice(alvo, 0, id);
      desenhar();
      try { await definirOrdem([...ids, ...ocultos.filter(o => !ids.includes(o))]); toast({ titulo: 'Ordem salva', tipo: 'sucesso' }); }
      catch (err) { toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' }); }
    };
    box.querySelectorAll('.cfg-painel-cima').forEach(b => b.addEventListener('click', () => mover(b.closest('[data-id]').dataset.id, -1)));
    box.querySelectorAll('.cfg-painel-baixo').forEach(b => b.addEventListener('click', () => mover(b.closest('[data-id]').dataset.id, +1)));
  };
  desenhar();
}
