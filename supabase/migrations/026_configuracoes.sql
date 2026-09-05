-- ============================================================
-- 026 - Configurações por módulo
-- Rode no SQL Editor, depois da 025.
--
-- Duas naturezas, duas tabelas:
--   config_modulo       - decisão da REDE (janela de cobertura, dia do
--                          TDC). Quem pode: pode_escrever(modulo).
--   preferencia_usuario  - escolha da PESSOA (ordem dos cards, exibir
--                          telefone). Quem pode: só o dono do e-mail.
--
-- Sem esta migration o app funciona: 42P01 nas leituras devolve mapa
-- vazio e todo consumidor cai no padrão declarado no <x>.config.js.
-- ============================================================

-- ── Rede ─────────────────────────────────────────────────────
create table if not exists config_modulo (
  modulo         text not null,
  chave          text not null,
  valor          jsonb not null,
  atualizado_por text,
  atualizado_em  timestamptz not null default now(),
  primary key (modulo, chave)
);
alter table config_modulo enable row level security;
alter table config_modulo force  row level security;

drop policy if exists config_modulo_sel on config_modulo;
drop policy if exists config_modulo_ins on config_modulo;
drop policy if exists config_modulo_upd on config_modulo;
drop policy if exists config_modulo_del on config_modulo;
-- A policy lê a COLUNA da própria linha: a permissão de uma
-- configuração é, literalmente, a permissão do módulo dela.
create policy config_modulo_sel on config_modulo for select using (is_autorizado());
create policy config_modulo_ins on config_modulo for insert with check (pode_escrever(modulo));
create policy config_modulo_upd on config_modulo for update using (pode_escrever(modulo))
                                                    with check (pode_escrever(modulo));
create policy config_modulo_del on config_modulo for delete using (pode_escrever(modulo));
grant select, insert, update, delete on config_modulo to authenticated;

-- ── Pessoa ───────────────────────────────────────────────────
create table if not exists preferencia_usuario (
  email         text not null,
  modulo        text not null,
  chave         text not null,
  valor         jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (email, modulo, chave)
);
alter table preferencia_usuario enable row level security;
alter table preferencia_usuario force  row level security;

drop policy if exists pref_sel on preferencia_usuario;
drop policy if exists pref_ins on preferencia_usuario;
drop policy if exists pref_upd on preferencia_usuario;
drop policy if exists pref_del on preferencia_usuario;
create policy pref_sel on preferencia_usuario for select using (email = auth_email());
create policy pref_ins on preferencia_usuario for insert with check (email = auth_email());
create policy pref_upd on preferencia_usuario for update using (email = auth_email())
                                                 with check (email = auth_email());
create policy pref_del on preferencia_usuario for delete using (email = auth_email());
grant select, insert, update, delete on preferencia_usuario to authenticated;

-- ── Auditoria (só config_modulo; preferência pessoal não vira log) ──
drop trigger if exists trg_audit on config_modulo;
create trigger trg_audit after insert or update or delete on config_modulo
  for each row execute function fn_audit();

-- Religa o array da 019 com config_modulo dentro (idempotente).
do $$
declare t text;
begin
  foreach t in array array[
    'unidade_escolar','regional','servidor','vinculo','perfil','telefone',
    'atividade_extraclasse','solicitacao_transporte','oferta_onibus','local',
    'dia_calendario','afastamento','horario_bloco','ocorrencia',
    'relatorio_visita','ata_atendimento','projeto','projeto_interesse',
    'escala_unidade','cargo_gestao','horario_exibicao','escala_tipo',
    'config_modulo'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_audit on %I', t);
      execute format(
        'create trigger trg_audit after insert or update or delete on %I
           for each row execute function fn_audit()', t);
    end if;
  end loop;
end $$;

-- ── Permissão: Configurações é de todo mundo (como Meus dados) ──
create or replace function meu_mapa_permissoes() returns jsonb
  language sql stable security definer set search_path = public as $$
    select case
      when is_admin() then
        (select jsonb_object_agg(m, 'escrita')
           from (select distinct modulo as m from papel_permissao) x)
        || '{"usuarios":"escrita","modulos":"escrita","meus_dados":"escrita","configuracoes":"escrita"}'::jsonb
      else
        coalesce(
          (select jsonb_object_agg(pp.modulo, pp.nivel::text)
             from papel_permissao pp
             join perfil p on p.papel = pp.papel
            where p.email = auth_email() and p.ativo),
          '{}'::jsonb)
        || coalesce((select permissoes from perfil where email = auth_email() and ativo), '{}'::jsonb)
        || '{"meus_dados":"escrita","modulos":"leitura","configuracoes":"escrita"}'::jsonb
    end
  $$;
grant execute on function meu_mapa_permissoes() to authenticated;

select registrar_migration('026', 'Configuracoes por modulo (config_modulo, preferencia_usuario)');
