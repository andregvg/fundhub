-- ============================================================
-- 021 — Permissões por módulo, segmentos de atuação e o vínculo
--       entre `perfil` (quem entra) e `servidor` (quem é).
--
-- Até aqui o FundHub só sabia distinguir ADMIN de NÃO-ADMIN: o
-- manifesto do módulo tinha `admin: true` e o RLS tinha is_admin().
-- Isso não dá conta do que a rede precisa:
--
--   • um gestor escolar não deve nem saber que Afastamentos existe;
--   • a Gerência de Transporte vê o SATE inteiro, o gestor vê só as
--     solicitações da PRÓPRIA escola;
--   • a equipe da SME vê tudo, mas nem todos podem escrever.
--
-- Então a autorização passa a ser um MAPA módulo → nível:
--
--   oculto   — o módulo não existe para essa pessoa (nem no menu,
--              nem na rota, nem no banco).
--   proprios — vê e mexe só no que é da sua escola / seu cadastro.
--   leitura  — vê tudo do módulo, não escreve.
--   escrita  — vê e escreve tudo do módulo.
--
-- O mapa vem do PAPEL (preset, em papel_permissao) e pode ser
-- ajustado pessoa a pessoa (override, em perfil.permissoes). Assim
-- mudar a regra dos 144 gestores é um UPDATE só, e a exceção
-- individual continua possível.
--
-- IMPORTANTE: esconder o módulo no menu é UX. O que realmente barra
-- é o RLS — por isso as policies abaixo passam a consultar o mesmo
-- mapa. Interface e banco leem a mesma fonte de verdade.
-- ============================================================

-- ── 1. Vocabulário ───────────────────────────────────────────
-- Segmentos-base. As combinações que a interface oferece
-- ("Ensino Fundamental", "Educação Infantil", "Todas") são atalhos
-- que expandem para estes valores — o banco só conhece os básicos,
-- porque combinação é assunto de tela, não de modelo.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'nivel_acesso') then
    create type nivel_acesso as enum ('oculto', 'proprios', 'leitura', 'escrita');
  end if;
end $$;

-- ── 2. Colunas novas ─────────────────────────────────────────
alter table perfil add column if not exists servidor_id uuid
  references servidor(id) on delete set null;
-- Segmentos de atuação. Array VAZIO = atua em todos (não é o mesmo
-- que "nenhum": quem não atua em nada não deveria ter perfil ativo).
alter table perfil add column if not exists segmentos text[] not null default '{}';
-- Override individual do mapa de permissões: {"afastamentos": "leitura"}.
alter table perfil add column if not exists permissoes jsonb not null default '{}'::jsonb;

-- Um servidor não pode responder por dois logins diferentes.
create unique index if not exists idx_perfil_servidor
  on perfil(servidor_id) where servidor_id is not null;

-- Código funcional: identificação do servidor na folha da prefeitura.
alter table servidor add column if not exists codigo_funcional text;
create index if not exists idx_servidor_codigo on servidor(codigo_funcional);

-- O módulo deixou de ser só de gestão (ver modules/servidores/module.js).
-- Um agente administrativo da sede não tem vínculo com escola — o
-- `vinculo` exige unidade_id —, então a lotação precisa de campo
-- próprio, senão essa gente simplesmente não caberia no cadastro.
alter table servidor add column if not exists cargo text;
alter table servidor add column if not exists lotacao text not null default 'escola'
  check (lotacao in ('escola', 'sede'));
create index if not exists idx_servidor_lotacao on servidor(lotacao);

-- ── 3. Papéis e seus presets ─────────────────────────────────
-- `papel` continua um text livre (evita migração de enum a cada
-- papel novo), mas ganha uma tabela de apoio que documenta os que
-- existem e serve de fonte para os selects da tela.
create table if not exists papel (
  chave     text primary key,
  rotulo    text not null,
  descricao text,
  ordem     int  not null default 100
);

insert into papel (chave, rotulo, descricao, ordem) values
  ('admin_sme',      'Administrador',      'Acesso total ao hub e à gestão de usuários.', 10),
  ('equipe_sme',     'Equipe SME',         'Equipe de acompanhamento e agentes da sede.', 20),
  ('transporte',     'Transporte',         'Gerência de Transporte — dona do SATE.',      30),
  ('gestor_escolar', 'Gestor(a) escolar',  'Direção e coordenação de uma unidade.',       40),
  ('leitor',         'Leitor',             'Somente leitura do essencial.',               50)
on conflict (chave) do update
  set rotulo = excluded.rotulo, descricao = excluded.descricao, ordem = excluded.ordem;

create table if not exists papel_permissao (
  papel  text not null references papel(chave) on delete cascade,
  modulo text not null,
  nivel  nivel_acesso not null default 'oculto',
  primary key (papel, modulo)
);

-- Preset por papel. Só o que está aqui é visível: a ausência de uma
-- linha significa OCULTO. É a política mais segura por omissão —
-- módulo novo nasce invisível e você libera conscientemente.
insert into papel_permissao (papel, modulo, nivel) values
  -- Equipe SME: enxerga a rede toda; escreve no que é do dia a dia.
  ('equipe_sme', 'dashboard',     'leitura'),
  ('equipe_sme', 'escolas',       'leitura'),
  ('equipe_sme', 'servidores',    'leitura'),
  ('equipe_sme', 'calendario',    'leitura'),
  ('equipe_sme', 'horarios',      'leitura'),
  ('equipe_sme', 'afastamentos',  'escrita'),
  ('equipe_sme', 'sate',          'escrita'),
  ('equipe_sme', 'viagens',       'escrita'),
  ('equipe_sme', 'projetos',      'escrita'),
  ('equipe_sme', 'ocorrencias',   'escrita'),
  ('equipe_sme', 'atas',          'escrita'),
  ('equipe_sme', 'visitas',       'escrita'),
  ('equipe_sme', 'notificacoes',  'leitura'),

  -- Transporte: dono do SATE e das viagens; o resto é contexto.
  ('transporte', 'dashboard',     'leitura'),
  ('transporte', 'escolas',       'leitura'),
  ('transporte', 'calendario',    'leitura'),
  ('transporte', 'sate',          'escrita'),
  ('transporte', 'viagens',       'escrita'),
  ('transporte', 'notificacoes',  'leitura'),

  -- Gestor escolar: a própria escola. Afastamentos, ocorrências,
  -- atas e visitas NÃO aparecem — nem no menu, nem na API.
  ('gestor_escolar', 'dashboard',    'proprios'),
  ('gestor_escolar', 'escolas',      'proprios'),
  ('gestor_escolar', 'servidores',   'proprios'),
  ('gestor_escolar', 'calendario',   'leitura'),
  ('gestor_escolar', 'horarios',     'proprios'),
  ('gestor_escolar', 'sate',         'proprios'),
  ('gestor_escolar', 'projetos',     'leitura'),
  ('gestor_escolar', 'notificacoes', 'leitura'),

  -- Leitor: o mínimo para se orientar.
  ('leitor', 'dashboard',    'leitura'),
  ('leitor', 'escolas',      'leitura'),
  ('leitor', 'calendario',   'leitura')
on conflict (papel, modulo) do update set nivel = excluded.nivel;

-- Admin não recebe preset: is_admin() já devolve 'escrita' em tudo
-- (ver nivel_modulo abaixo). Uma linha a menos para esquecer.

-- ── 4. As funções que respondem "pode?" ──────────────────────
-- SECURITY DEFINER porque leem `perfil` e `papel_permissao`, cujas
-- policies são restritas — sem isso a policy chamaria a si mesma.

-- O servidor por trás do login (null se o perfil não estiver ligado).
create or replace function meu_servidor_id() returns uuid
  language sql stable security definer set search_path = public as $$
    select servidor_id from perfil where email = auth_email() and ativo
  $$;

-- Nível efetivo neste módulo: admin > override individual > preset
-- do papel > oculto.
create or replace function nivel_modulo(p_modulo text) returns nivel_acesso
  language plpgsql stable security definer set search_path = public as $$
declare
  v_papel     text;
  v_override  text;
  v_nivel     nivel_acesso;
begin
  if is_admin() then return 'escrita'; end if;

  select p.papel, p.permissoes ->> p_modulo
    into v_papel, v_override
    from perfil p
   where p.email = auth_email() and p.ativo;

  if v_papel is null then return 'oculto'; end if;

  if v_override is not null then
    -- Override com valor inválido é ignorado, não vira erro 500.
    begin
      return v_override::nivel_acesso;
    exception when invalid_text_representation then
      null;
    end;
  end if;

  select pp.nivel into v_nivel
    from papel_permissao pp
   where pp.papel = v_papel and pp.modulo = p_modulo;

  return coalesce(v_nivel, 'oculto');
end $$;

create or replace function pode_ver(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select nivel_modulo(p_modulo) <> 'oculto'
  $$;

-- Vê a rede inteira (≠ de ver só o que é seu).
create or replace function ve_tudo(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select nivel_modulo(p_modulo) in ('leitura', 'escrita')
  $$;

create or replace function pode_escrever(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select nivel_modulo(p_modulo) = 'escrita'
  $$;

-- As unidades pelas quais a pessoa responde (vínculos ativos do ano
-- corrente). Base do nível 'proprios'.
create or replace function minhas_unidades() returns setof uuid
  language sql stable security definer set search_path = public as $$
    select v.unidade_id
      from vinculo v
     where v.servidor_id = meu_servidor_id()
       and v.ativo
       and v.ano = extract(year from current_date)::int
  $$;

-- Atalho para as policies: "vejo esta unidade neste módulo?"
create or replace function ve_unidade(p_modulo text, p_unidade uuid)
  returns boolean
  language sql stable security definer set search_path = public as $$
    select case nivel_modulo(p_modulo)
      when 'oculto'   then false
      when 'proprios' then p_unidade in (select minhas_unidades())
      else true
    end
  $$;

-- Escrita respeitando o escopo: 'proprios' escreve na própria escola.
create or replace function escreve_unidade(p_modulo text, p_unidade uuid)
  returns boolean
  language sql stable security definer set search_path = public as $$
    select case nivel_modulo(p_modulo)
      when 'escrita'  then true
      when 'proprios' then p_unidade in (select minhas_unidades())
      else false
    end
  $$;

-- ── 5. Segmentos ─────────────────────────────────────────────
-- O segmento de uma unidade não é um campo só: `segmento` diz a
-- natureza (EMEF/EMEI/CEI/CONVENIADA) e `tem_eja` acrescenta EJA
-- por cima. Uma EMEF com EJA pertence aos DOIS segmentos — por isso
-- a função devolve um array, não um texto.
create or replace function unidade_segmentos(p_unidade uuid) returns text[]
  language sql stable security definer set search_path = public as $$
    select array_remove(array[
      upper(nullif(trim(u.segmento), '')),
      case when u.tem_eja then 'EJA' end
    ], null)
    from unidade_escolar u
    where u.id = p_unidade
  $$;

-- Os segmentos do usuário logado. Vazio = atua em todos.
create or replace function meus_segmentos() returns text[]
  language sql stable security definer set search_path = public as $$
    select coalesce(segmentos, '{}') from perfil
     where email = auth_email() and ativo
  $$;

-- ── 6. RLS: as policies passam a consultar o mapa ────────────
-- Cada tabela declara a que módulo pertence. Onde existe unidade_id,
-- o nível 'proprios' recorta por escola; onde não existe, 'proprios'
-- se comporta como leitura do módulo (não há por onde recortar).

-- Escolas ─────────────────────────────────────────────────────
drop policy if exists unidade_escolar_sel on unidade_escolar;
drop policy if exists unidade_escolar_ins on unidade_escolar;
drop policy if exists unidade_escolar_upd on unidade_escolar;
drop policy if exists unidade_escolar_del on unidade_escolar;
create policy unidade_escolar_sel on unidade_escolar for select
  using (ve_unidade('escolas', id));
create policy unidade_escolar_ins on unidade_escolar for insert
  with check (pode_escrever('escolas'));
create policy unidade_escolar_upd on unidade_escolar for update
  using (escreve_unidade('escolas', id)) with check (escreve_unidade('escolas', id));
create policy unidade_escolar_del on unidade_escolar for delete
  using (pode_escrever('escolas'));

-- Regionais: contexto de escola, mesma permissão.
drop policy if exists regional_sel on regional;
drop policy if exists regional_ins on regional;
drop policy if exists regional_upd on regional;
drop policy if exists regional_del on regional;
create policy regional_sel on regional for select using (pode_ver('escolas'));
create policy regional_ins on regional for insert with check (pode_escrever('escolas'));
create policy regional_upd on regional for update using (pode_escrever('escolas')) with check (pode_escrever('escolas'));
create policy regional_del on regional for delete using (pode_escrever('escolas'));

-- Servidores e vínculos ───────────────────────────────────────
-- 'proprios' aqui = os servidores vinculados às minhas unidades,
-- mais eu mesmo. Um gestor vê a própria equipe, não a rede inteira.
drop policy if exists servidor_sel on servidor;
drop policy if exists servidor_ins on servidor;
drop policy if exists servidor_upd on servidor;
drop policy if exists servidor_del on servidor;
create policy servidor_sel on servidor for select using (
  case nivel_modulo('servidores')
    when 'oculto' then false
    when 'proprios' then id = meu_servidor_id() or exists (
      select 1 from vinculo v
       where v.servidor_id = servidor.id
         and v.unidade_id in (select minhas_unidades()))
    else true
  end
);
create policy servidor_ins on servidor for insert with check (pode_escrever('servidores'));
-- A pessoa edita o PRÓPRIO cadastro (tela "Meus dados"), mesmo sem
-- permissão de escrita no módulo. É o seu nome, seu telefone.
create policy servidor_upd on servidor for update
  using (pode_escrever('servidores') or id = meu_servidor_id())
  with check (pode_escrever('servidores') or id = meu_servidor_id());
create policy servidor_del on servidor for delete using (pode_escrever('servidores'));

drop policy if exists vinculo_sel on vinculo;
drop policy if exists vinculo_ins on vinculo;
drop policy if exists vinculo_upd on vinculo;
drop policy if exists vinculo_del on vinculo;
create policy vinculo_sel on vinculo for select using (ve_unidade('servidores', unidade_id));
create policy vinculo_ins on vinculo for insert with check (pode_escrever('servidores'));
create policy vinculo_upd on vinculo for update using (pode_escrever('servidores')) with check (pode_escrever('servidores'));
create policy vinculo_del on vinculo for delete using (pode_escrever('servidores'));

-- Telefones: seguem o dono. Telefone de escola é do módulo Escolas,
-- telefone de servidor é do módulo Servidores — e o próprio dono
-- sempre pode mexer nos seus.
drop policy if exists telefone_sel on telefone;
drop policy if exists telefone_ins on telefone;
drop policy if exists telefone_upd on telefone;
drop policy if exists telefone_del on telefone;
create policy telefone_sel on telefone for select using (
  (unidade_id  is not null and ve_unidade('escolas', unidade_id))
  or (servidor_id is not null and (pode_ver('servidores') or servidor_id = meu_servidor_id()))
);
create policy telefone_ins on telefone for insert with check (
  (unidade_id  is not null and escreve_unidade('escolas', unidade_id))
  or (servidor_id is not null and (pode_escrever('servidores') or servidor_id = meu_servidor_id()))
);
create policy telefone_upd on telefone for update using (
  (unidade_id  is not null and escreve_unidade('escolas', unidade_id))
  or (servidor_id is not null and (pode_escrever('servidores') or servidor_id = meu_servidor_id()))
) with check (
  (unidade_id  is not null and escreve_unidade('escolas', unidade_id))
  or (servidor_id is not null and (pode_escrever('servidores') or servidor_id = meu_servidor_id()))
);
create policy telefone_del on telefone for delete using (
  (unidade_id  is not null and escreve_unidade('escolas', unidade_id))
  or (servidor_id is not null and (pode_escrever('servidores') or servidor_id = meu_servidor_id()))
);

-- Módulos com recorte por unidade ─────────────────────────────
-- Só entram aqui as tabelas que REALMENTE têm unidade_id. Note que
-- `oferta_onibus` NÃO entra: a oferta de ônibus é por data+período
-- para a rede toda, não por escola — ela está na lista de baixo.
-- O guard de coluna abaixo existe para que um engano desses vire um
-- aviso, e não um erro no meio da migration.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('ocorrencia',             'ocorrencias'),
      ('relatorio_visita',       'visitas'),
      ('horario_bloco',          'horarios'),
      ('solicitacao_transporte', 'sate'),
      ('projeto_interesse',      'projetos')
    ) as t(tabela, modulo)
  loop
    if to_regclass(r.tabela) is null then continue; end if;
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = r.tabela
         and column_name = 'unidade_id'
    ) then
      raise warning '021: % não tem unidade_id — policy por unidade ignorada', r.tabela;
      continue;
    end if;
    execute format('drop policy if exists %I_sel on %I', r.tabela, r.tabela);
    execute format('drop policy if exists %I_ins on %I', r.tabela, r.tabela);
    execute format('drop policy if exists %I_upd on %I', r.tabela, r.tabela);
    execute format('drop policy if exists %I_del on %I', r.tabela, r.tabela);
    execute format(
      'create policy %I_sel on %I for select using (ve_unidade(%L, unidade_id))',
      r.tabela, r.tabela, r.modulo);
    execute format(
      'create policy %I_ins on %I for insert with check (escreve_unidade(%L, unidade_id))',
      r.tabela, r.tabela, r.modulo);
    execute format(
      'create policy %I_upd on %I for update using (escreve_unidade(%L, unidade_id)) with check (escreve_unidade(%L, unidade_id))',
      r.tabela, r.tabela, r.modulo, r.modulo);
    execute format(
      'create policy %I_del on %I for delete using (escreve_unidade(%L, unidade_id))',
      r.tabela, r.tabela, r.modulo);
  end loop;
end $$;

-- Módulos sem recorte por unidade ─────────────────────────────
-- Aqui 'proprios' não tem por onde recortar: quem tem o nível vê o
-- módulo inteiro em modo leitura. É deliberado — e é por isso que
-- gestor_escolar simplesmente NÃO recebe esses módulos no preset.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('dia_calendario',       'calendario'),
      ('atividade_extraclasse','calendario'),
      ('ata_atendimento',      'atas'),
      ('projeto',              'projetos'),
      ('local',                'sate'),
      -- oferta de ônibus é por data+período, para a rede toda
      ('oferta_onibus',        'sate')
    ) as t(tabela, modulo)
  loop
    if to_regclass(r.tabela) is null then continue; end if;
    execute format('drop policy if exists %I_sel on %I', r.tabela, r.tabela);
    execute format('drop policy if exists %I_ins on %I', r.tabela, r.tabela);
    execute format('drop policy if exists %I_upd on %I', r.tabela, r.tabela);
    execute format('drop policy if exists %I_del on %I', r.tabela, r.tabela);
    execute format('create policy %I_sel on %I for select using (pode_ver(%L))',
      r.tabela, r.tabela, r.modulo);
    execute format('create policy %I_ins on %I for insert with check (pode_escrever(%L))',
      r.tabela, r.tabela, r.modulo);
    execute format('create policy %I_upd on %I for update using (pode_escrever(%L)) with check (pode_escrever(%L))',
      r.tabela, r.tabela, r.modulo, r.modulo);
    execute format('create policy %I_del on %I for delete using (pode_escrever(%L))',
      r.tabela, r.tabela, r.modulo);
  end loop;
end $$;

-- Afastamentos: o caso mais sensível. Tem unidade_id E servidor_id,
-- e o gestor não deve ver NENHUM — o preset dele não inclui o
-- módulo, então nivel_modulo devolve 'oculto' e a policy barra tudo.
-- A pessoa sempre enxerga o próprio afastamento.
drop policy if exists afastamento_sel on afastamento;
drop policy if exists afastamento_ins on afastamento;
drop policy if exists afastamento_upd on afastamento;
drop policy if exists afastamento_del on afastamento;
create policy afastamento_sel on afastamento for select using (
  ve_tudo('afastamentos') or servidor_id = meu_servidor_id()
);
create policy afastamento_ins on afastamento for insert with check (pode_escrever('afastamentos'));
create policy afastamento_upd on afastamento for update
  using (pode_escrever('afastamentos')) with check (pode_escrever('afastamentos'));
create policy afastamento_del on afastamento for delete using (pode_escrever('afastamentos'));

-- ── 7. Perfil e papéis: leitura própria, escrita do admin ────
-- Cada um lê o PRÓPRIO perfil (a tela "Meus dados" depende disso) e
-- pode editar só os campos de contato — papel, segmentos e
-- permissões continuam privativos do admin, garantido pelo trigger
-- abaixo, já que policy não sabe restringir por coluna.
drop policy if exists perfil_all on perfil;
drop policy if exists perfil_sel on perfil;
drop policy if exists perfil_ins on perfil;
drop policy if exists perfil_upd on perfil;
drop policy if exists perfil_del on perfil;
create policy perfil_sel on perfil for select
  using (is_admin() or email = auth_email());
create policy perfil_ins on perfil for insert with check (is_admin());
create policy perfil_upd on perfil for update
  using (is_admin() or email = auth_email())
  with check (is_admin() or email = auth_email());
create policy perfil_del on perfil for delete using (is_admin());

-- Escalada de privilégio é o risco óbvio de deixar o usuário
-- atualizar a própria linha. Este trigger devolve os campos
-- sensíveis ao valor antigo quando quem edita não é admin.
create or replace function fn_perfil_protege_privilegio() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then return new; end if;
  new.papel       := old.papel;
  new.ativo       := old.ativo;
  new.segmentos   := old.segmentos;
  new.permissoes  := old.permissoes;
  new.servidor_id := old.servidor_id;
  new.email       := old.email;
  return new;
end $$;

drop trigger if exists trg_perfil_privilegio on perfil;
create trigger trg_perfil_privilegio before update on perfil
  for each row execute function fn_perfil_protege_privilegio();

-- Catálogo de papéis e presets: todo mundo lê (a tela precisa dos
-- rótulos), só admin escreve.
alter table papel           enable row level security;
alter table papel_permissao enable row level security;
alter table papel           force  row level security;
alter table papel_permissao force  row level security;

drop policy if exists papel_sel on papel;
drop policy if exists papel_wr  on papel;
create policy papel_sel on papel for select using (is_autorizado());
create policy papel_wr  on papel for all using (is_admin()) with check (is_admin());

drop policy if exists papel_permissao_sel on papel_permissao;
drop policy if exists papel_permissao_wr  on papel_permissao;
create policy papel_permissao_sel on papel_permissao for select using (is_autorizado());
create policy papel_permissao_wr  on papel_permissao for all using (is_admin()) with check (is_admin());

grant select on papel, papel_permissao to authenticated;
grant insert, update, delete on papel, papel_permissao to authenticated;

grant execute on function nivel_modulo(text), pode_ver(text), ve_tudo(text),
  pode_escrever(text), ve_unidade(text, uuid), escreve_unidade(text, uuid),
  minhas_unidades(), meu_servidor_id(), meus_segmentos(),
  unidade_segmentos(uuid) to authenticated;

-- ── 8. Uma leitura só para a tela ────────────────────────────
-- O app precisa do mapa inteiro no boot. Sem isto seriam N chamadas
-- (uma por módulo) só para montar o menu.
create or replace function meu_mapa_permissoes() returns jsonb
  language sql stable security definer set search_path = public as $$
    select case
      when is_admin() then
        (select jsonb_object_agg(m, 'escrita')
           from (select distinct modulo as m from papel_permissao) x)
        || '{"usuarios":"escrita","modulos":"escrita","meus_dados":"escrita"}'::jsonb
      else
        coalesce(
          (select jsonb_object_agg(pp.modulo, pp.nivel::text)
             from papel_permissao pp
             join perfil p on p.papel = pp.papel
            where p.email = auth_email() and p.ativo),
          '{}'::jsonb)
        || coalesce((select permissoes from perfil where email = auth_email() and ativo), '{}'::jsonb)
        -- Toda pessoa autorizada tem os próprios dados e a lista de módulos.
        || '{"meus_dados":"escrita","modulos":"leitura"}'::jsonb
    end
  $$;

grant execute on function meu_mapa_permissoes() to authenticated;

-- ── 9. Backfill ──────────────────────────────────────────────
-- Quem já estava na allowlist como 'leitor' continua leitor; os
-- admins seguem admins. Ninguém perde acesso nesta migration.
-- Ligar perfil → servidor pelo e-mail, quando bater exatamente.
update perfil p
   set servidor_id = s.id
  from servidor s
 where p.servidor_id is null
   and s.email is not null
   and lower(s.email) = lower(p.email)
   and not exists (select 1 from perfil q where q.servidor_id = s.id);
