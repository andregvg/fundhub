// ============================================================
// FundHub - modules/servidores/equipe.model.js
// A EQUIPE de uma unidade: quem trabalha lá agora, com que cargo - a
// leitura que as outras telas fazem do vínculo (ficha da escola, pedido
// do SATE, Horários).
//
// Separado de vinculos.model.js por ser outro agregado, e não só para
// caber no teto: aquele é o CADASTRO do vínculo (criar, editar,
// encerrar); este é a LEITURA da equipe, com as regras de quem é equipe
// e quem não é. Os dois são API pública do módulo (R2).
//
// Direção dos imports (R4): equipe → vinculos → servidores. Nunca o
// contrário.
// ============================================================
import { getServidoresDaUnidade, vinculosAbertos, CARGO_GESTOR, rotulaVinculo } from './servidores.model.js';
import { rotulaCargo, temFuncao } from './vinculos.model.js';

// Supervisão NÃO é equipe da escola (spec 2026-10-03, D13): o supervisor
// trabalha na Secretaria e acompanha várias unidades. O vínculo dele com a
// escola continua existindo - é o que registra "supervisiona esta escola"
// e o que dá a ele acesso aos dados dela -, mas é lido como supervisão.
// Reconhecida pelo rótulo canônico (o que a migration 023 produz); a regra
// mora aqui, num lugar só, para virar marca no banco se um dia precisar.
export const CARGO_SUPERVISAO = 'Supervisor(a)';
export const eSupervisao = (cargo) => rotulaCargo(cargo) === CARGO_SUPERVISAO;

// Posição na equipe da escola (D7): Gestor 1, Gestor 2, gestor sem função
// definida, coordenação, demais.
export function ordemNaEquipe(v) {
  const cargo = rotulaCargo(v?.papel);
  if (cargo === CARGO_GESTOR) return v.funcao === 1 ? 0 : v.funcao === 2 ? 1 : 2;
  return cargo === 'Coordenador(a)' ? 3 : 4;
}

// Os vínculos que fazem da pessoa EQUIPE de algum lugar: abertos, e não de
// supervisão. É o que Horários lê.
export const vinculosDeEquipe = (s) => vinculosAbertos(s).filter(v => !eSupervisao(v.papel));

// A unidade é só SUPERVISIONADA pela pessoa: há vínculo aberto de supervisão
// nela e nenhum de equipe. Quem coordena uma escola e supervisiona outra tem
// a primeira como local de jornada; a segunda, não (D14).
export function soSupervisiona(s, unidadeId) {
  if (vinculosDeEquipe(s).some(v => v.unidade_id === unidadeId)) return false;
  return vinculosAbertos(s).some(v => v.unidade_id === unidadeId && eSupervisao(v.papel));
}

// Quem tem local de trabalho aberto na unidade, já na forma de LEITURA que
// outra tela exibe: { id, nome, cargo, email, telefone, supervisao, ordem }.
//   - o cargo é o do(s) vínculo(s) aberto(s) NESTA unidade, não o geral -
//     quem responde por duas unidades aparece em cada uma com o cargo de lá,
//     e o de gestor leva a função ("Gestor(a) 1");
//   - `ordem` é a posição na equipe (ordemNaEquipe): quem tem mais de um
//     vínculo aberto aqui fica na MENOR posição (o cargo mais alto);
//   - o telefone é o principal, ou o primeiro se nenhum for;
//   - `supervisao` marca quem só SUPERVISIONA a unidade: quem consome
//     decide onde mostrar (a ficha da escola separa; o SATE e Horários
//     deixam de fora).
// Ordenada por `ordem`, depois cargo e nome. Lê o cache de servidores, que toda gravação invalida.
export async function getEquipeDaUnidade(unidadeId) {
  const servidores = await getServidoresDaUnidade(unidadeId);
  return servidores.map(s => {
    const daqui = vinculosAbertos(s).filter(v => v.unidade_id === unidadeId);
    const cargo = [...new Set(daqui
      .map(v => rotulaVinculo({ ...v, papel: rotulaCargo(v.papel) })).filter(Boolean))].join(' · ');
    const tels = s.telefones || [];
    const tel = tels.find(t => t.principal) || tels[0];
    return {
      id: s.id, nome: s.nome, cargo, email: s.email || '', telefone: tel?.numero || '',
      // Só supervisão NESTA unidade: quem é coordenador aqui e supervisor de
      // outra escola continua sendo equipe daqui.
      supervisao: daqui.length > 0 && daqui.every(v => eSupervisao(v.papel)),
      ordem: Math.min(4, ...daqui.map(ordemNaEquipe)),
    };
  }).sort((a, b) => a.ordem - b.ordem
    || a.cargo.localeCompare(b.cargo, 'pt') || a.nome.localeCompare(b.nome, 'pt'));
}

// Quem já ocupa a função na unidade - para AVISAR, não para barrar (R15):
// numa transição os dois períodos se encostam.
export async function quemTemFuncao(unidadeId, funcao, excetoServidorId) {
  const servidores = await getServidoresDaUnidade(unidadeId);
  return servidores.find(s => s.id !== excetoServidorId && vinculosAbertos(s)
    .some(v => v.unidade_id === unidadeId && temFuncao(v.papel) && v.funcao === Number(funcao))) || null;
}
