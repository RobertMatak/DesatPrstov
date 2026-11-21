-- =====================================================================
--  Desať Prstov – úprava databázy pre fázu 7 (knihy a kapitoly)
--  Spúšťa sa raz, PO súboroch faza6.sql a faza6b.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
--
--  Náhodné texty ostávajú v tabuľke texty. Knihy sú samostatne:
--  žiak ich dostane len v časti Príbehy, kapitolu po kapitole.
-- =====================================================================


-- ---------------------------------------------------------------------
--  0) Postup v príbehoch z fázy 6 nahrádza postup v kapitolách
-- ---------------------------------------------------------------------
drop function if exists public.uloz_postup(text, uuid, int);
drop table if exists public.postup_pribehov;


-- ---------------------------------------------------------------------
--  1) Knihy: pre jednu triedu (trieda_id) alebo pre všetky triedy učiteľa (null)
-- ---------------------------------------------------------------------
create table public.knihy (
  id         uuid primary key default gen_random_uuid(),
  ucitel_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trieda_id  uuid references public.triedy (id) on delete cascade,
  nazov      text not null check (char_length(nazov) between 1 and 100),
  autor      text check (char_length(autor) <= 100),
  zdroj      text check (char_length(zdroj) <= 300),
  vytvorene  timestamptz not null default now()
);
create index on public.knihy (ucitel_id);


-- ---------------------------------------------------------------------
--  2) Kapitoly: patria knihe, poradie určuje, ktorá je prvá
-- ---------------------------------------------------------------------
create table public.kapitoly (
  id         uuid primary key default gen_random_uuid(),
  kniha_id   uuid not null references public.knihy (id) on delete cascade,
  poradie    int  not null default 0,
  nazov      text check (char_length(nazov) <= 100),
  text       text not null check (char_length(text) between 20 and 20000),
  vytvorene  timestamptz not null default now()
);
create index on public.kapitoly (kniha_id, poradie);


-- ---------------------------------------------------------------------
--  3) Postup žiaka v kapitole: od ktorého slova pokračuje (0 = od začiatku)
-- ---------------------------------------------------------------------
create table public.postup_kapitol (
  ziak_id      uuid not null references public.ziaci (id) on delete cascade,
  kapitola_id  uuid not null references public.kapitoly (id) on delete cascade,
  pozicia      int  not null default 0 check (pozicia >= 0),
  zmenene      timestamptz not null default now(),
  primary key (ziak_id, kapitola_id)
);


-- ---------------------------------------------------------------------
--  4) Pravidlá prístupu a oprávnenia
-- ---------------------------------------------------------------------
alter table public.knihy          enable row level security;
alter table public.kapitoly       enable row level security;
alter table public.postup_kapitol enable row level security;

revoke all on public.knihy, public.kapitoly, public.postup_kapitol from anon;
grant select, insert, update, delete on public.knihy, public.kapitoly to authenticated;
grant select, delete on public.postup_kapitol to authenticated;
revoke truncate, trigger, references on public.knihy, public.kapitoly, public.postup_kapitol from authenticated;

-- Učiteľ: svoje knihy; trieda (ak je zadaná) musí byť jeho
create policy "ucitel spravuje svoje knihy" on public.knihy
  for all to authenticated
  using (ucitel_id = (select auth.uid()))
  with check (
    ucitel_id = (select auth.uid())
    and (trieda_id is null or exists (
      select 1 from public.triedy t
      where t.id = trieda_id and t.ucitel_id = (select auth.uid()))));

-- Učiteľ: kapitoly svojich kníh
create policy "ucitel spravuje kapitoly svojich knih" on public.kapitoly
  for all to authenticated
  using (exists (
    select 1 from public.knihy k
    where k.id = kniha_id and k.ucitel_id = (select auth.uid())))
  with check (exists (
    select 1 from public.knihy k
    where k.id = kniha_id and k.ucitel_id = (select auth.uid())));

-- Učiteľ: postup svojich žiakov môže čítať a vynulovať
create policy "ucitel cita postup v kapitolach" on public.postup_kapitol
  for select to authenticated
  using (exists (
    select 1 from public.ziaci z join public.triedy t on t.id = z.trieda_id
    where z.id = ziak_id and t.ucitel_id = (select auth.uid())));

create policy "ucitel maze postup v kapitolach" on public.postup_kapitol
  for delete to authenticated
  using (exists (
    select 1 from public.ziaci z join public.triedy t on t.id = z.trieda_id
    where z.id = ziak_id and t.ucitel_id = (select auth.uid())));


-- ---------------------------------------------------------------------
--  5) Funkcie pre žiakov
-- ---------------------------------------------------------------------

-- Pomocná: smie trieda žiaka vidieť túto knihu? (žiaci ju volať nemôžu)
create or replace function public.kniha_pre_triedu(p_kniha_id uuid, p_trieda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.knihy k
    join public.triedy tr on tr.id = p_trieda_id
    where k.id = p_kniha_id
      and k.ucitel_id = tr.ucitel_id
      and (k.trieda_id is null or k.trieda_id = tr.id));
$$;

-- Po prihlásení: dĺžka úryvku, náhodné texty, knihy (bez textov kapitol,
-- tie sa načítajú až pri otvorení kapitoly) a postup v kapitolách
create or replace function public.udaje_pre_ziaka(p_kod text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  z  public.ziaci;
  tr public.triedy;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    return null;
  end if;
  select * into tr from public.triedy where id = z.trieda_id;

  return json_build_object(
    'rocnik', tr.rocnik,
    'slov', coalesce(
      (select d.slov from public.dlzky_rocnikov d
       where d.ucitel_id = tr.ucitel_id and d.rocnik = tr.rocnik),
      public.predvolena_dlzka(tr.rocnik)),
    'texty', coalesce((
      select json_agg(json_build_object(
               'id', t.id, 'nazov', t.nazov, 'text', t.text,
               'autor', t.autor, 'zdroj', t.zdroj)
             order by t.vytvorene)
      from public.texty t
      where t.ucitel_id = tr.ucitel_id
        and (t.trieda_id is null or t.trieda_id = tr.id)), '[]'::json),
    'knihy', coalesce((
      select json_agg(json_build_object(
               'id', k.id, 'nazov', k.nazov, 'autor', k.autor, 'zdroj', k.zdroj,
               'kapitoly', coalesce((
                 select json_agg(json_build_object(
                          'id', kap.id,
                          'nazov', kap.nazov,
                          'slov', coalesce(array_length(regexp_split_to_array(btrim(kap.text), '\s+'), 1), 0))
                        order by kap.poradie, kap.vytvorene)
                 from public.kapitoly kap
                 where kap.kniha_id = k.id), '[]'::json))
             order by k.vytvorene)
      from public.knihy k
      where public.kniha_pre_triedu(k.id, tr.id)), '[]'::json),
    'postup', coalesce((
      select json_object_agg(p.kapitola_id, p.pozicia)
      from public.postup_kapitol p
      where p.ziak_id = z.id), '{}'::json)
  );
end;
$$;

-- Text jednej kapitoly (len ak je kniha pre triedu žiaka)
create or replace function public.kapitola_pre_ziaka(p_kod text, p_kapitola_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  z public.ziaci;
  kap public.kapitoly;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    return null;
  end if;
  select * into kap from public.kapitoly where id = p_kapitola_id;
  if kap.id is null or not public.kniha_pre_triedu(kap.kniha_id, z.trieda_id) then
    return null;
  end if;
  return kap.text;
end;
$$;

-- Uloží, kde žiak v kapitole skončil
create or replace function public.uloz_postup_kapitoly(p_kod text, p_kapitola_id uuid, p_pozicia int)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  z public.ziaci;
  kap public.kapitoly;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    raise exception 'Neplatný kód';
  end if;
  select * into kap from public.kapitoly where id = p_kapitola_id;
  if kap.id is null or not public.kniha_pre_triedu(kap.kniha_id, z.trieda_id) then
    raise exception 'Kapitola nie je pre túto triedu';
  end if;

  insert into public.postup_kapitol (ziak_id, kapitola_id, pozicia)
  values (z.id, p_kapitola_id, greatest(p_pozicia, 0))
  on conflict (ziak_id, kapitola_id) do update
    set pozicia = excluded.pozicia, zmenene = now();
  return true;
end;
$$;

revoke execute on function public.kniha_pre_triedu(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.kapitola_pre_ziaka(text, uuid) from public;
revoke execute on function public.uloz_postup_kapitoly(text, uuid, int) from public;
grant  execute on function public.kapitola_pre_ziaka(text, uuid) to anon, authenticated;
grant  execute on function public.uloz_postup_kapitoly(text, uuid, int) to anon, authenticated;
