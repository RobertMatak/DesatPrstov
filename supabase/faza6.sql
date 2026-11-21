-- =====================================================================
--  Desať Prstov – úprava databázy pre fázu 6
--  (ročník tried, dĺžky úryvkov, dlhé texty s názvom, príbehy na pokračovanie)
--
--  Spúšťa sa raz, PO súbore schema.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
--  Existujúce triedy, žiaci, kódy, výsledky ani texty sa nestratia.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1) Triedy: ročník (1–9) a písmeno
--     Názov (napr. 5.D) ostáva, skladá ho admin.html z ročníka a písmena.
-- ---------------------------------------------------------------------
alter table public.triedy
  add column rocnik  int  check (rocnik between 1 and 9),
  add column pismeno text check (char_length(pismeno) between 1 and 3);

-- Existujúce triedy: ročník = číslica na začiatku názvu, písmeno = písmená na konci
-- (z "5.D" bude ročník 5 a písmeno D). Ak sa to z názvu nedá zistiť, ostane prázdne
-- a admin.html ťa požiada, aby si ho doplnil.
update public.triedy
set rocnik  = (regexp_match(nazov, '^\s*([1-9])\s*\.?\s*([A-Za-z]{1,3})\s*$'))[1]::int,
    pismeno = upper((regexp_match(nazov, '^\s*([1-9])\s*\.?\s*([A-Za-z]{1,3})\s*$'))[2])
where rocnik is null;


-- ---------------------------------------------------------------------
--  2) Dĺžky úryvkov: koľko slov má úryvok pre daný ročník
--     Každý učiteľ má vlastné nastavenie. Ak ročník nemá záznam,
--     použije sa predvolená hodnota (funkcia nizsie).
-- ---------------------------------------------------------------------
create table public.dlzky_rocnikov (
  ucitel_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rocnik     int  not null check (rocnik between 1 and 9),
  slov       int  not null check (slov between 3 and 200),
  primary key (ucitel_id, rocnik)
);

alter table public.dlzky_rocnikov enable row level security;
revoke all on public.dlzky_rocnikov from anon;
grant select, insert, update, delete on public.dlzky_rocnikov to authenticated;
revoke truncate, trigger, references on public.dlzky_rocnikov from authenticated;

create policy "ucitel spravuje svoje dlzky" on public.dlzky_rocnikov
  for all to authenticated
  using      (ucitel_id = (select auth.uid()))
  with check (ucitel_id = (select auth.uid()));

-- Predvolené dĺžky pre ročníky 1–9 (rovnaké ako v admin.html)
create or replace function public.predvolena_dlzka(p_rocnik int)
returns int
language sql
immutable
set search_path = ''
as $$
  select coalesce((array[6, 8, 10, 15, 20, 25, 30, 40, 50])[p_rocnik], 20);
$$;


-- ---------------------------------------------------------------------
--  3) Texty: voliteľný názov a dĺžka až 20 000 znakov (celá rozprávka)
-- ---------------------------------------------------------------------
alter table public.texty drop constraint if exists texty_text_check;
alter table public.texty add constraint texty_text_check check (char_length(text) between 20 and 20000);
alter table public.texty add column nazov text check (char_length(nazov) <= 100);


-- ---------------------------------------------------------------------
--  4) Postup v príbehoch: kde žiak v ktorom texte skončil
--     pozicia = poradové číslo slova, od ktorého pokračuje (0 = od začiatku)
-- ---------------------------------------------------------------------
create table public.postup_pribehov (
  ziak_id   uuid not null references public.ziaci (id) on delete cascade,
  text_id   uuid not null references public.texty (id) on delete cascade,
  pozicia   int  not null default 0 check (pozicia >= 0),
  zmenene   timestamptz not null default now(),
  primary key (ziak_id, text_id)
);

alter table public.postup_pribehov enable row level security;
revoke all on public.postup_pribehov from anon;
grant select, delete on public.postup_pribehov to authenticated;
revoke truncate, trigger, references on public.postup_pribehov from authenticated;

-- Učiteľ vidí (a môže vynulovať) postup svojich žiakov; zapisujú ho žiaci cez funkciu
create policy "ucitel cita postup" on public.postup_pribehov
  for select to authenticated
  using (exists (
    select 1 from public.ziaci z join public.triedy t on t.id = z.trieda_id
    where z.id = ziak_id and t.ucitel_id = (select auth.uid())));

create policy "ucitel maze postup" on public.postup_pribehov
  for delete to authenticated
  using (exists (
    select 1 from public.ziaci z join public.triedy t on t.id = z.trieda_id
    where z.id = ziak_id and t.ucitel_id = (select auth.uid())));


-- ---------------------------------------------------------------------
--  5) Nové funkcie pre žiakov (overujú si kód rovnako ako tie zo schema.sql)
-- ---------------------------------------------------------------------

-- Všetko, čo aplikácia žiaka potrebuje po prihlásení:
-- dĺžka úryvku pre jeho ročník, texty pre jeho triedu a postup v príbehoch.
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
      select json_agg(json_build_object('id', t.id, 'nazov', t.nazov, 'text', t.text)
                      order by t.vytvorene)
      from public.texty t
      where t.ucitel_id = tr.ucitel_id
        and (t.trieda_id is null or t.trieda_id = tr.id)), '[]'::json),
    'postup', coalesce((
      select json_object_agg(p.text_id, p.pozicia)
      from public.postup_pribehov p
      where p.ziak_id = z.id), '{}'::json)
  );
end;
$$;

-- Uloží, kde žiak v príbehu skončil (len pre text, ktorý jeho trieda naozaj má)
create or replace function public.uloz_postup(p_kod text, p_text_id uuid, p_pozicia int)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  z  public.ziaci;
  tr public.triedy;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    raise exception 'Neplatný kód';
  end if;
  select * into tr from public.triedy where id = z.trieda_id;

  if not exists (
    select 1 from public.texty t
    where t.id = p_text_id
      and t.ucitel_id = tr.ucitel_id
      and (t.trieda_id is null or t.trieda_id = tr.id)) then
    raise exception 'Text nie je pre túto triedu';
  end if;

  insert into public.postup_pribehov (ziak_id, text_id, pozicia)
  values (z.id, p_text_id, greatest(p_pozicia, 0))
  on conflict (ziak_id, text_id) do update
    set pozicia = excluded.pozicia, zmenene = now();
  return true;
end;
$$;

revoke execute on function public.udaje_pre_ziaka(text) from public;
revoke execute on function public.uloz_postup(text, uuid, int) from public;
grant  execute on function public.udaje_pre_ziaka(text) to anon, authenticated;
grant  execute on function public.uloz_postup(text, uuid, int) to anon, authenticated;
