// ============================================================
// FundHub - modules/calendario/anoletivo.model.js
// As REGRAS do assistente "Montar o ano letivo": dado o período do ano, o
// que é fim de semana, feriado, recesso e dia letivo extra, devolve as
// linhas de `dia_calendario` a gravar e a contagem de dias letivos. Puro:
// sem banco e sem tela - o teste o fixa e a tela só desenha o resultado.
//
// Dia SEM registro é dia letivo. Por isso só se gera linha para o que foge
// disso: o que não é letivo, o que é letivo só em parte e a reposição.
// Datas são datas civis (yyyy-mm-dd), manipuladas como texto (R8).
//
// Quem manda, do mais fraco ao mais forte: fim de semana, recesso, feriado,
// dia letivo extra. E, acima de tudo, o que já está registrado - quando a
// pessoa pede para mantê-lo (o padrão): uma reposição marcada à mão nunca
// é desfeita por uma regra geral.
// ============================================================
import { addDias } from '../../shared/format.js';

const pad = (n) => String(n).padStart(2, '0');
const isoDe = (a, m, d) => `${a}-${pad(m)}-${pad(d)}`;
const diaDaSemana = (iso) => new Date(iso + 'T00:00:00').getDay();   // 0 = domingo
export const NOME_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_LETIVOS_EXIGIDOS = 200;
const LIMITE_DIAS = 400;

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
export function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDe(ano, mes, dia);
}

// Feriados nacionais de um ano, na ordem do calendário. `padrao`: já vem
// marcado. Carnaval e Corpus Christi são ponto facultativo, mas a rede não
// costuma ter aula - vêm marcados, e a pessoa desmarca se na dela tem.
// Os municipais a pessoa digita: variam de cidade para cidade.
export function feriadosNacionais(ano) {
  const p = pascoa(ano);
  const lista = [
    [isoDe(ano, 1, 1), 'Confraternização Universal'],
    [addDias(p, -48), 'Carnaval (segunda)'],
    [addDias(p, -47), 'Carnaval (terça)'],
    [addDias(p, -2), 'Sexta-feira Santa'],
    [isoDe(ano, 4, 21), 'Tiradentes'],
    [isoDe(ano, 5, 1), 'Dia do Trabalho'],
    [addDias(p, 60), 'Corpus Christi'],
    [isoDe(ano, 9, 7), 'Independência do Brasil'],
    [isoDe(ano, 10, 12), 'Nossa Senhora Aparecida'],
    [isoDe(ano, 11, 2), 'Finados'],
    [isoDe(ano, 11, 15), 'Proclamação da República'],
    ...(ano >= 2024 ? [[isoDe(ano, 11, 20), 'Consciência Negra']] : []),
    [isoDe(ano, 12, 25), 'Natal'],
  ];
  return lista.map(([data, nome]) => ({ data, nome })).sort((a, b) => a.data.localeCompare(b.data));
}

// Todas as datas de um intervalo inclusivo.
export function datasDe(de, ate) {
  const out = [];
  for (let d = de; d <= ate; d = addDias(d, 1)) out.push(d);
  return out;
}

const faixaValida = (de, ate) => !!de && !!ate && ate > de;

// Monta o ano.
//   inicio, fim        datas civis
//   sabadoNaoLetivo    (padrão true) / domingoNaoLetivo (padrão true)
//   feriados           [{ data, nome }]
//   recessos           [{ de, ate, nome, aulaDe?, aulaAte? }] - com faixa, o recesso é só em parte:
//                      a faixa é o trecho em que HÁ aula
//   extras             [{ data, nome?, aulaDe?, aulaAte? }] - dia letivo (inteiro ou em parte)
//   existentes         { data: registro } - o que já está gravado
//   preservar          (padrão true) não mexe em dia que já tem registro. Com false o assistente
//                      REFAZ o dia: o que viraria letivo comum sobrescreve o registro antigo
//                      (letivo, sem evento, sem faixa) em vez de deixá-lo como estava.
// Devolve { linhas, resumo } ou lança Error('...') para período inválido.
export function montarAno({
  inicio, fim, sabadoNaoLetivo = true, domingoNaoLetivo = true,
  feriados = [], recessos = [], extras = [], existentes = {}, preservar = true,
}) {
  if (!inicio || !fim || fim < inicio) throw new Error('Informe o início e o fim do ano letivo.');
  const datas = datasDe(inicio, fim);
  if (datas.length > LIMITE_DIAS) throw new Error('O ano letivo não pode passar de 400 dias.');

  const feriado = new Map(feriados.map(f => [f.data, f.nome]));
  const extra = new Map(extras.filter(x => x.data).map(x => [x.data, x]));
  const recessoDe = (data) => recessos.find(r => r.de && r.ate && data >= r.de && data <= r.ate);

  const linhas = [];
  let comFaixa = false;
  let letivos = 0, parciais = 0, naoLetivos = 0, preservados = 0;
  const porMes = new Map();   // 'yyyy-mm' → dias letivos

  for (const data of datas) {
    const reg = existentes[data];
    let letivo, de = null, ate = null, tipo = null, evento = null;
    if (preservar && reg) {
      preservados++;
      letivo = reg.letivo !== false;
      if (letivo && faixaValida(reg.letivo_de?.slice(0, 5), reg.letivo_ate?.slice(0, 5))) parciais++;
    } else {
      const dow = diaDaSemana(data);
      const fimDeSemana = (dow === 0 && domingoNaoLetivo) || (dow === 6 && sabadoNaoLetivo);
      const rec = recessoDe(data);
      const x = extra.get(data);
      letivo = !fimDeSemana;
      if (!fimDeSemana && rec) {   // fim de semana dentro do recesso continua sendo só fim de semana
        tipo = 'recesso'; evento = rec.nome || 'Recesso';
        if (faixaValida(rec.aulaDe, rec.aulaAte)) { de = rec.aulaDe; ate = rec.aulaAte; } else letivo = false;
      }
      if (feriado.has(data)) { letivo = false; tipo = 'feriado'; evento = feriado.get(data); de = ate = null; }
      if (x) {
        letivo = true; tipo = 'calendário escolar'; evento = x.nome || 'Dia letivo extra';
        de = faixaValida(x.aulaDe, x.aulaAte) ? x.aulaDe : null; ate = de ? x.aulaAte : null;
      }
      if (!letivo || de || x || reg) {
        if (de || (reg && 'letivo_de' in reg)) comFaixa = true;
        linhas.push({ data, letivo, tipo, evento, bloqueia_afastamento: false, bloqueia_extraclasse: false, obs: null, letivo_de: de, letivo_ate: ate });
      }
      if (de) parciais++;
    }
    if (letivo) {
      letivos++;
      const mes = data.slice(0, 7);
      porMes.set(mes, (porMes.get(mes) || 0) + 1);
    } else naoLetivos++;
  }
  // Linhas com as mesmas chaves (o upsert em lote exige); sem faixa nenhuma,
  // as colunas nem entram - a migration que as cria pode não ter rodado.
  if (!comFaixa) for (const l of linhas) { delete l.letivo_de; delete l.letivo_ate; }
  return {
    linhas,
    resumo: {
      dias: datas.length, letivos, parciais, naoLetivos, preservados,
      porMes: [...porMes].map(([mes, n]) => ({ mes, n })),
      exigidos: DIAS_LETIVOS_EXIGIDOS,
    },
  };
}
