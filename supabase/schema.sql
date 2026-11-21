-- =====================================================================
--  Desať Prstov – databáza pre triedy a žiakov (fáza 1)
--  Spustenie: Supabase → SQL Editor → New query → vložiť celý súbor → Run
--
--  Čo vytvorí:
--    tabuľky:  triedy, ziaci, vysledky, statistika_klavesov, texty
--    pravidlá: učiteľ vidí len svoje triedy, žiak nevidí nič priamo
--    funkcie:  4 funkcie pre žiakov, ktoré si najprv overia kód
--
--  Komentáre začínajú dvoma pomlčkami (ako # v Pythone).
-- =====================================================================

-- Rozšírenie na bezpečné náhodné čísla (v Supabase býva už zapnuté)
create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------------
--  Generátor kódov pre žiakov, napríklad KX7M-4PRT
--  Bez znakov, ktoré sa dajú zameniť: 0/O, 1/I/L
-- ---------------------------------------------------------------------
create or replace function public.novy_kod()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  abeceda constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 znakov
  kod text := '';
  bajty bytea := extensions.gen_random_bytes(8);
begin
  for i in 0..7 loop
    kod := kod || substr(abeceda, 1 + get_byte(bajty, i) % length(abeceda), 1);
    if i = 3 then
      kod := kod || '-';
    end if;
  end loop;
  return kod;
end;
$$;


-- ---------------------------------------------------------------------
--  Tabuľky
-- ---------------------------------------------------------------------

-- Triedy: každá patrí jednému učiteľovi (auth.uid() = prihlásený učiteľ)
create table public.triedy (
  id         uuid primary key default gen_random_uuid(),
  ucitel_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nazov      text not null check (char_length(nazov) between 1 and 50),
  vytvorene  timestamptz not null default now()
);

-- Žiaci: meno (krstné + písmeno priezviska), trieda a prihlasovací kód
create table public.ziaci (
  id         uuid primary key default gen_random_uuid(),
  trieda_id  uuid not null references public.triedy (id) on delete cascade,
  meno       text not null check (char_length(meno) between 1 and 50),
  kod        text not null unique default public.novy_kod(),
  email      text,                      -- zatiaľ nepoužité, pre prípadné prihlásenie cez Microsoft 365
  aktivny    boolean not null default true,
  vytvorene  timestamptz not null default now()
);
create index on public.ziaci (trieda_id);

-- Výsledky jednotlivých textov
create table public.vysledky (
  id             bigint generated always as identity primary key,
  ziak_id        uuid not null references public.ziaci (id) on delete cascade,
  datum          timestamptz not null default now(),
  text_zaciatok  text,
  rychlost       int not null check (rychlost between 0 and 1000),   -- slov za minútu
  presnost       int not null check (presnost between 0 and 100),    -- %
  chyby          int not null check (chyby >= 0),
  sekundy        int not null check (sekundy >= 0)
);
create index on public.vysledky (ziak_id, datum);

-- Štatistika klávesov: pre každého žiaka a znak počet použití a chýb
create table public.statistika_klavesov (
  ziak_id  uuid not null references public.ziaci (id) on delete cascade,
  znak     text not null check (char_length(znak) = 1),
  spolu    int not null default 0 check (spolu >= 0),
  chyby    int not null default 0 check (chyby >= 0),
  primary key (ziak_id, znak)
);

-- Texty od učiteľa: pre jednu triedu, alebo pre všetky jeho triedy (trieda_id = null)
create table public.texty (
  id         uuid primary key default gen_random_uuid(),
  ucitel_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trieda_id  uuid references public.triedy (id) on delete cascade,
  text       text not null check (char_length(text) between 20 and 1500),
  vytvorene  timestamptz not null default now()
);
create index on public.texty (ucitel_id);


-- ---------------------------------------------------------------------
--  Pravidlá prístupu (Row Level Security)
--  Keď je RLS zapnuté a pre niekoho neexistuje pravidlo, nevidí nič.
--  Neprihlásený návštevník (rola anon) nemá žiadne pravidlo,
--  takže do tabuliek priamo nevidí vôbec.
-- ---------------------------------------------------------------------
alter table public.triedy              enable row level security;
alter table public.ziaci               enable row level security;
alter table public.vysledky            enable row level security;
alter table public.statistika_klavesov enable row level security;
alter table public.texty               enable row level security;

-- Pre istotu odoberieme neprihláseným aj samotné oprávnenia na tabuľky
revoke all on public.triedy, public.ziaci, public.vysledky,
              public.statistika_klavesov, public.texty from anon;

-- Učiteľ: svoje triedy môže čítať, vytvárať, meniť aj mazať
create policy "ucitel spravuje svoje triedy" on public.triedy
  for all to authenticated
  using      (ucitel_id = (select auth.uid()))
  with check (ucitel_id = (select auth.uid()));

-- Učiteľ: žiakov len vo svojich triedach
create policy "ucitel spravuje ziakov svojich tried" on public.ziaci
  for all to authenticated
  using (exists (
    select 1 from public.triedy t
    where t.id = trieda_id and t.ucitel_id = (select auth.uid())))
  with check (exists (
    select 1 from public.triedy t
    where t.id = trieda_id and t.ucitel_id = (select auth.uid())));

-- Učiteľ: výsledky svojich žiakov môže čítať a mazať (zapisujú ich žiaci)
create policy "ucitel cita vysledky" on public.vysledky
  for select to authenticated
  using (exists (
    select 1 from public.ziaci z join public.triedy t on t.id = z.trieda_id
    where z.id = ziak_id and t.ucitel_id = (select auth.uid())));

create policy "ucitel maze vysledky" on public.vysledky
  for delete to authenticated
  using (exists (
    select 1 from public.ziaci z join public.triedy t on t.id = z.trieda_id
    where z.id = ziak_id and t.ucitel_id = (select auth.uid())));

-- Učiteľ: štatistiku klávesov svojich žiakov môže čítať a mazať
create policy "ucitel cita statistiku" on public.statistika_klavesov
  for select to authenticated
  using (exists (
    select 1 from public.ziaci z join public.triedy t on t.id = z.trieda_id
    where z.id = ziak_id and t.ucitel_id = (select auth.uid())));

create policy "ucitel maze statistiku" on public.statistika_klavesov
  for delete to authenticated
  using (exists (
    select 1 from public.ziaci z join public.triedy t on t.id = z.trieda_id
    where z.id = ziak_id and t.ucitel_id = (select auth.uid())));

-- Učiteľ: svoje texty; trieda (ak je zadaná) musí byť jeho
create policy "ucitel spravuje svoje texty" on public.texty
  for all to authenticated
  using (ucitel_id = (select auth.uid()))
  with check (
    ucitel_id = (select auth.uid())
    and (trieda_id is null or exists (
      select 1 from public.triedy t
      where t.id = trieda_id and t.ucitel_id = (select auth.uid()))));


-- ---------------------------------------------------------------------
--  Funkcie pre žiakov
--  "security definer" znamená, že funkcia beží s právami databázy,
--  nie neprihláseného žiaka. Preto smie do tabuliek, ale každá najprv
--  overí kód a pracuje LEN s údajmi žiaka, ktorému kód patrí.
-- ---------------------------------------------------------------------

-- Pomocná funkcia: nájde aktívneho žiaka podľa kódu.
-- Kód môže byť zadaný malými písmenami, s medzerami alebo bez pomlčky.
-- Žiaci ju volať nemôžu (oprávnenie odoberáme nižšie).
create or replace function public.ziak_podla_kodu(p_kod text)
returns public.ziaci
language sql
stable
security definer
set search_path = ''
as $$
  select z.*
  from public.ziaci z
  where z.aktivny
    and replace(z.kod, '-', '') = upper(regexp_replace(coalesce(p_kod, ''), '[^A-Za-z0-9]', '', 'g'))
  limit 1;
$$;

-- 1) Prihlásenie: vráti meno a triedu, alebo null pri zlom kóde
create or replace function public.prihlas_ziaka(p_kod text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  z public.ziaci;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    return null;
  end if;
  return json_build_object(
    'meno',   z.meno,
    'trieda', (select t.nazov from public.triedy t where t.id = z.trieda_id)
  );
end;
$$;

-- 2) Uloženie výsledku a štatistiky klávesov po dopísaní textu.
--    p_klavesy je napríklad {"a": {"spolu": 12, "chyby": 1}, "ď": {...}}
create or replace function public.uloz_vysledok(
  p_kod            text,
  p_text_zaciatok  text,
  p_rychlost       int,
  p_presnost       int,
  p_chyby          int,
  p_sekundy        int,
  p_klavesy        jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  z public.ziaci;
  k record;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    raise exception 'Neplatný kód';
  end if;

  insert into public.vysledky (ziak_id, text_zaciatok, rychlost, presnost, chyby, sekundy)
  values (z.id, left(p_text_zaciatok, 60), p_rychlost, p_presnost, p_chyby, p_sekundy);

  -- Pripočítanie štatistiky klávesov (najviac 200 rôznych znakov naraz)
  for k in
    select key, value
    from jsonb_each(coalesce(p_klavesy, '{}'::jsonb))
    where char_length(key) = 1 and jsonb_typeof(value) = 'object'
    limit 200
  loop
    insert into public.statistika_klavesov as s (ziak_id, znak, spolu, chyby)
    values (
      z.id,
      k.key,
      least(greatest(coalesce((k.value ->> 'spolu')::int, 0), 0), 10000),
      least(greatest(coalesce((k.value ->> 'chyby')::int, 0), 0), 10000)
    )
    on conflict (ziak_id, znak) do update
      set spolu = s.spolu + excluded.spolu,
          chyby = s.chyby + excluded.chyby;
  end loop;

  return true;
end;
$$;

-- 3) Výsledky a štatistika klávesov prihláseného žiaka (pre graf a mapu chýb)
create or replace function public.moje_vysledky(p_kod text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  z public.ziaci;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    return null;
  end if;
  return json_build_object(
    'vysledky', coalesce((
      select json_agg(json_build_object(
               'datum',    v.datum,
               'text',     v.text_zaciatok,
               'rychlost', v.rychlost,
               'presnost', v.presnost,
               'chyby',    v.chyby,
               'sekundy',  v.sekundy)
             order by v.datum)
      from public.vysledky v
      where v.ziak_id = z.id), '[]'::json),
    'klavesy', coalesce((
      select json_object_agg(s.znak, json_build_object('spolu', s.spolu, 'chyby', s.chyby))
      from public.statistika_klavesov s
      where s.ziak_id = z.id), '{}'::json)
  );
end;
$$;

-- 4) Texty pre triedu žiaka (pre jeho triedu + pre všetky triedy jeho učiteľa)
create or replace function public.texty_pre_ziaka(p_kod text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  z public.ziaci;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    return null;
  end if;
  return coalesce((
    select json_agg(t.text order by t.vytvorene)
    from public.texty t
    join public.triedy tr on tr.id = z.trieda_id
    where t.ucitel_id = tr.ucitel_id
      and (t.trieda_id is null or t.trieda_id = z.trieda_id)), '[]'::json);
end;
$$;


-- ---------------------------------------------------------------------
--  Funkcia pre učiteľa: nový kód pre žiaka (napr. keď ho žiak prezradil)
--  Beží s právami učiteľa, takže pravidlá vyššie platia aj tu.
-- ---------------------------------------------------------------------
create or replace function public.vygeneruj_novy_kod(p_ziak_id uuid)
returns text
language sql
volatile
set search_path = ''
as $$
  update public.ziaci
  set kod = public.novy_kod()
  where id = p_ziak_id
  returning kod;
$$;


-- ---------------------------------------------------------------------
--  Kto smie volať ktoré funkcie
-- ---------------------------------------------------------------------
-- Pomocnú funkciu nesmie volať nikto zvonku
revoke execute on function public.ziak_podla_kodu(text) from public, anon, authenticated;

-- Generátor kódov a nový kód: len prihlásený učiteľ
revoke execute on function public.novy_kod() from public, anon;
revoke execute on function public.vygeneruj_novy_kod(uuid) from public, anon;
grant  execute on function public.novy_kod() to authenticated;
grant  execute on function public.vygeneruj_novy_kod(uuid) to authenticated;

-- Štyri funkcie pre žiakov: smie ich volať ktokoľvek, overujú si kód samy
revoke execute on function public.prihlas_ziaka(text) from public;
revoke execute on function public.uloz_vysledok(text, text, int, int, int, int, jsonb) from public;
revoke execute on function public.moje_vysledky(text) from public;
revoke execute on function public.texty_pre_ziaka(text) from public;
grant  execute on function public.prihlas_ziaka(text) to anon, authenticated;
grant  execute on function public.uloz_vysledok(text, text, int, int, int, int, jsonb) to anon, authenticated;
grant  execute on function public.moje_vysledky(text) to anon, authenticated;
grant  execute on function public.texty_pre_ziaka(text) to anon, authenticated;


-- ---------------------------------------------------------------------
--  Oprávnenia na tabuľky pre prihláseného učiteľa
--  (Supabase ich novým tabuľkám nedáva, pravidlá RLS stále určujú riadky)
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.triedy, public.ziaci, public.texty to authenticated;
grant select, delete on public.vysledky, public.statistika_klavesov to authenticated;

-- Odobratie oprávnení, ktoré aplikácia nepotrebuje (TRUNCATE by obišiel pravidlá RLS)
revoke truncate, trigger, references
  on public.triedy, public.ziaci, public.vysledky, public.statistika_klavesov, public.texty
  from authenticated;
