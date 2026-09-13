// ============================================================
// FundHub - modules/escolas/localizacao.model.js
// Localizar em lote as escolas que ainda não têm latitude e longitude.
//
// Nasce separado de `escolas.model.js` por ser outro agregado, e não
// para caber no teto: aquele arquivo é o CADASTRO (ler, criar, editar);
// este é uma TAREFA - tem começo, progresso, fim e pode ser interrompida.
// O que ele escreve passa pelo cadastro (`atualizarUnidade`), e o que ele
// sabe de geografia vem de `locais.model.js`. Nenhuma das duas coisas é
// reimplementada aqui.
//
// A tarefa mora no MODEL, e não na tela, de propósito: fechar o painel
// de configuração não pode parar o trabalho no meio. A tela só assina o
// progresso enquanto está aberta.
//
// Ritmo: o Nominatim (OpenStreetMap) aceita no máximo uma consulta por
// segundo. É a política de uso do serviço gratuito, e é o que torna 100
// escolas uma tarefa de dois minutos, não de dois segundos.
// ============================================================
import { getUnidades, atualizarUnidade } from './escolas.model.js';
import {
  geocodificar, precisaoDe, naCidade, variantesDeEndereco, temCoordenada,
} from '../locais/locais.model.js';

const INTERVALO_MS = 1100;          // um pouco acima de 1 s, com folga
const FALHAS_SEGUIDAS_MAX = 3;      // serviço fora do ar: para, não insiste

const nomeDe = (u) => u.apelido || u.nome || 'Escola';
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

// ── Puras ────────────────────────────────────────────────────
// Quem ainda precisa de localização. Escola sem endereço não entra na
// fila - não há o que procurar - mas é contada, porque é o que a pessoa
// precisa resolver à mão antes.
export function pendentes(unidades) {
  const lista = unidades || [];
  const semLocal = lista.filter(u => !temCoordenada(u.latitude, u.longitude));
  return {
    total: lista.length,
    localizadas: lista.length - semLocal.length,
    aLocalizar: semLocal.filter(u => String(u.endereco || '').trim()),
    semEndereco: semLocal.filter(u => !String(u.endereco || '').trim()),
  };
}

// Segundos restantes pelo ritmo REAL da tarefa (fallback de endereço e
// latência do serviço mudam o ritmo); antes da primeira escola, pelo
// intervalo mínimo.
export function restanteSeg({ total, feitas, iniciadaEm }, agora = Date.now()) {
  const faltam = Math.max(0, total - feitas);
  const porEscola = feitas ? (agora - iniciadaEm) / feitas : INTERVALO_MS * 1.2;
  return Math.round((faltam * porEscola) / 1000);
}

// ── Leitura ──────────────────────────────────────────────────
export async function resumoLocalizacao() {
  return pendentes(await getUnidades());
}

// ── A tarefa ─────────────────────────────────────────────────
// Uma por vez no navegador. O estado é a verdade; quem escuta recebe uma
// FOTO, nunca o objeto vivo - uma tela não pode alterar a tarefa por
// descuido.
let _tarefa = null;
const _ouvintes = new Set();

function foto() {
  if (!_tarefa) return null;
  const t = _tarefa;
  return {
    ativa: t.ativa, cancelada: t.cancelada, interrompida: t.interrompida,
    total: t.total, feitas: t.feitas, atual: t.atual,
    localizadas: [...t.localizadas], revisar: [...t.revisar], naoEncontradas: [...t.naoEncontradas],
    restanteSeg: t.ativa ? restanteSeg(t) : 0,
  };
}

function avisar() {
  const f = foto();
  // Um ouvinte com defeito não derruba a tarefa nem cala os outros.
  for (const fn of _ouvintes) { try { fn(f); } catch (err) { console.warn('[escolas] ouvinte da localização:', err); } }
}

export const tarefaLocalizacao = () => foto();

export function acompanharLocalizacao(fn) {
  _ouvintes.add(fn);
  return () => _ouvintes.delete(fn);
}

// Pede para parar. A escola em andamento termina (a consulta já saiu), e
// nada do que foi gravado se desfaz - cada localização é independente.
export function cancelarLocalizacao() {
  if (_tarefa?.ativa) { _tarefa.cancelada = true; avisar(); }
}

// Procura uma escola, tentando as variantes do endereço. Devolve
// { achado, precisao } ou { achado: null }; lança só se o SERVIÇO falhar.
async function procurar(u) {
  for (const endereco of variantesDeEndereco(u.endereco)) {
    if (_tarefa.cancelada) break;
    const r = await geocodificar(endereco);
    await esperar(INTERVALO_MS);
    if (!r || !naCidade(r)) continue;
    const precisao = precisaoDe(r);
    // Bairro ou cidade inteira não é localização: erra quilômetros, e o
    // tempo de viagem do SATE sairia errado sem ninguém perceber.
    if (precisao === 'aproximada') continue;
    return { achado: r, precisao };
  }
  return { achado: null };
}

export async function localizarEscolas() {
  if (_tarefa?.ativa) return foto();

  const { aLocalizar } = pendentes(await getUnidades());
  _tarefa = {
    ativa: true, cancelada: false, interrompida: null,
    total: aLocalizar.length, feitas: 0, atual: null, iniciadaEm: Date.now(),
    localizadas: [], revisar: [], naoEncontradas: [],
  };
  avisar();

  let falhas = 0;
  for (const u of aLocalizar) {
    if (_tarefa.cancelada) break;
    _tarefa.atual = nomeDe(u);
    avisar();

    let resultado;
    try {
      resultado = await procurar(u);
      falhas = 0;
    } catch (err) {
      // Falha do serviço, não "endereço não encontrado". Três seguidas é
      // serviço fora do ar: continuar só enfileiraria erro.
      if (++falhas >= FALHAS_SEGUIDAS_MAX) {
        _tarefa.interrompida = 'O serviço de mapa parou de responder. As escolas já localizadas continuam salvas; tente de novo mais tarde.';
        break;
      }
      await esperar(INTERVALO_MS);
      resultado = { achado: null, falhou: true };
    }

    const item = { id: u.id, nome: nomeDe(u), endereco: u.endereco };
    if (resultado.achado) {
      const { lat, lng } = resultado.achado;
      try {
        await atualizarUnidade(u.id, { latitude: lat, longitude: lng });
        (resultado.precisao === 'exata' ? _tarefa.localizadas : _tarefa.revisar).push({ ...item, lat, lng });
      } catch (err) {
        // Gravação recusada é permissão ou banco - vale para todas as
        // próximas também. Para em vez de repetir a mesma recusa 100 vezes.
        _tarefa.interrompida = `Não foi possível salvar: ${err?.message || err}`;
        break;
      }
    } else {
      _tarefa.naoEncontradas.push(item);
    }
    _tarefa.feitas++;
    avisar();
  }

  _tarefa.ativa = false;
  _tarefa.atual = null;
  avisar();
  return foto();
}
