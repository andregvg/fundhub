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
import { getServidoresDaUnidade, vinculosAbertos } from './servidores.model.js';
import { rotulaCargo } from './vinculos.model.js';

// Supervisão NÃO é equipe da escola (spec 2026-10-03, D13): o supervisor
// trabalha na Secretaria e acompanha várias unidades. O vínculo dele com a
// escola continua existindo - é o que registra "supervisiona esta escola"
// e o que dá a ele acesso aos dados dela -, mas é lido como supervisão.
// Reconhecida pelo rótulo canônico (o que a migration 023 produz); a regra
// mora aqui, num lugar só, para virar marca no banco se um dia precisar.
export const CARGO_SUPERVISAO = 'Supervisor(a)';
export const eSupervisao = (cargo) => rotulaCargo(cargo) === CARGO_SUPERVISAO;

// Quem tem local de trabalho aberto na unidade, já na forma de LEITURA que
// outra tela exibe: { id, nome, cargo, email, telefone, supervisao }.
//   - o cargo é o do(s) vínculo(s) aberto(s) NESTA unidade, não o geral -
//     quem responde por duas unidades aparece em cada uma com o cargo de lá;
//   - o telefone é o principal, ou o primeiro se nenhum for;
//   - `supervisao` marca quem só SUPERVISIONA a unidade: quem consome
//     decide onde mostrar (a ficha da escola separa; o SATE e Horários
//     deixam de fora).
// Ordenada por nome. Lê o cache de servidores, que toda gravação invalida.
export async function getEquipeDaUnidade(unidadeId) {
  const servidores = await getServidoresDaUnidade(unidadeId);
  return servidores.map(s => {
    const daqui = vinculosAbertos(s).filter(v => v.unidade_id === unidadeId);
    const cargo = [...new Set(daqui.map(v => rotulaCargo(v.papel)).filter(Boolean))].join(' · ');
    const tels = s.telefones || [];
    const tel = tels.find(t => t.principal) || tels[0];
    return {
      id: s.id, nome: s.nome, cargo, email: s.email || '', telefone: tel?.numero || '',
      // Só supervisão NESTA unidade: quem é coordenador aqui e supervisor de
      // outra escola continua sendo equipe daqui.
      supervisao: daqui.length > 0 && daqui.every(v => eSupervisao(v.papel)),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
}
