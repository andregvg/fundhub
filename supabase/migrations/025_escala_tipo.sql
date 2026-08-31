-- ============================================================
-- 025 - Catálogo de tipos de escala
-- Rode no SQL Editor, depois da 024.
--
-- As TRÊS colunas de escala (dia_calendario.escala, escala_unidade.escala,
-- horario_bloco.escala) continuam `text` livre - não mudou nada nelas.
-- Esta migration acrescenta só o RÓTULO exibido para cada chave: o
-- formato de TDC muda a cada calendário escolar, e travar "TDC
-- Presencial"/"TDC Virtual" no código obrigaria a um deploy toda vez
-- que a Secretaria decidisse chamar a coisa de outro jeito.
--
-- 'normal' nasce semeado e é a única chave que o CÓDIGO depende do
-- valor literal (escolherBlocos/resolverEscala usam a string
-- 'normal' como fallback) - por isso a tela de admin não oferece
-- excluí-la. O rótulo dela, como o de qualquer outra, pode mudar.
--
-- O vocabulário inicial mudou de 'tdc-a'/'tdc-b' (citado no comentário
-- da 024) para 'tdc-presencial'/'tdc-virtual' - são estes dois que
-- ficam semeados abaixo e que o código usa. A 024 já rodou em
-- produção e não é alterada; esta linha é só para quem lê as
-- migrations em ordem não estranhar a divergência.
-- ============================================================

create table if not exists escala_tipo (
  -- Chave normalizada pelo próprio banco: minúscula, sem espaço nas
  -- pontas, nunca vazia. Sem isso um admin salvando '' ou ' TDC ' cria
  -- uma chave-fantasma que nunca casa com o que está gravado em
  -- horario_bloco.escala - e a barreira real é o banco, não a tela.
  chave      text primary key check (chave = lower(btrim(chave)) and chave <> ''),
  rotulo     text not null,
  ordem      int  not null default 0,
  criado_por text,
  criado_em  timestamptz not null default now()
);

insert into escala_tipo (chave, rotulo, ordem) values
  ('normal',         'Normal',         0),
  ('tdc-presencial',  'TDC Presencial', 1),
  ('tdc-virtual',     'TDC Virtual',    2)
on conflict (chave) do nothing;

alter table escala_tipo enable row level security;
alter table escala_tipo force row level security;

drop policy if exists escala_tipo_sel on escala_tipo;
drop policy if exists escala_tipo_wr  on escala_tipo;
create policy escala_tipo_sel on escala_tipo for select using (is_autorizado());
create policy escala_tipo_wr  on escala_tipo for all
  using (is_admin()) with check (is_admin());

grant select, insert, update, delete on escala_tipo to authenticated;

drop trigger if exists trg_audit on escala_tipo;
create trigger trg_audit after insert or update or delete on escala_tipo
  for each row execute function fn_audit();

select registrar_migration('025', 'Catalogo de tipos de escala (rotulos editaveis)');
