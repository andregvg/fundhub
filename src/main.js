// ============================================================
// FundHub - main.js  (bootstrap do FundHub)
// Ordem: portão (login, pendência, domínio) → moldura (menu) →
// roteador → serviços de fundo (notificações).
//
// Quem entra é decisão de `shell/portao.js`, o mesmo portão do SATE
// (sate.html). Aqui fica só o que é do FUNDHUB depois da porta.
// ============================================================
import { hasSupabase } from './core/supabase.js';
import { startRouter } from './core/router.js';
import { servicos } from './core/registry.js';
import { abrirPortao } from './shell/portao.js';
import { montarNav, marcarNav, marcarAtualizacao } from './shell/chrome.js';
import { limparToasts } from './shared/ui/toast.js';

const app = document.getElementById('app');
const rodando = [];

function montarApp() {
  montarNav();
  // O carimbo marca só a PRIMEIRA rota depois do boot - aqui, e mais
  // nenhuma vez pelo onRoute. onRoute dispara em toda troca de rota,
  // mas os models têm cache de módulo que sobrevive à navegação: voltar
  // para uma tela já visitada devolve o cache sem tocar no banco, e
  // marcar de novo mentiria sobre a idade do dado. Da segunda vez em
  // diante o carimbo só volta a mudar no clique em Atualizar (ver
  // shell/chrome.js), o único caminho que de fato limpa os caches.
  let primeiraRotaMarcada = false;
  startRouter(app, { onRoute: (hash) => {
    marcarNav(hash);
    if (!primeiraRotaMarcada) { marcarAtualizacao(); primeiraRotaMarcada = true; }
  } });
  iniciarServicos();
}

// Serviços de fundo declarados no registro (servico: true).
async function iniciarServicos() {
  if (!hasSupabase()) return;
  for (const m of servicos()) {
    try {
      const svc = await m.load();
      await svc.iniciar?.();
      rodando.push(svc);
    } catch (err) {
      console.warn(`[FundHub] serviço "${m.id}" não iniciou:`, err);
    }
  }
}

function pararServicos() {
  rodando.splice(0).forEach(svc => { try { svc.parar?.(); } catch (_) {} });
  limparToasts();
}

abrirPortao(app, { aoEntrar: montarApp, aoSair: pararServicos });
