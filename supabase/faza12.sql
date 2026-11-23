-- =====================================================================
--  Desať Prstov – fáza 12: test rýchlosti
--  Spúšťa sa PO súbore faza11b.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
--  Dá sa spustiť aj viackrát, nič sa tým nepokazí.
--
--  - učiteľ vytvorí test: názov (napr. "2026/27"), jeden text a obdobie od–do
--  - všetci žiaci školy píšu ten istý text 1 minútu, pokusov je neobmedzene
--  - výsledok = čistá rýchlosť: len správne napísané znaky (5 znakov = 1 slovo)
--  - pokus s presnosťou pod 80 % sa do rebríčka nezapočíta
--  - sieň slávy testu: najrýchlejší žiak všetkých čias (najlepší výkon za školský rok)
-- =====================================================================

-- 1) Minimálna presnosť, aby sa pokus v teste rátal (rovnaká v test.js)
create or replace function public.min_presnost_testu()
returns int
language sql
immutable
set search_path = ''
as $$ select 80; $$;

-- Dnešný dátum na Slovensku (databáza beží v čase UTC)
create or replace function public.dnes()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Europe/Bratislava')::date; $$;

-- 2) Testy rýchlosti
create table if not exists public.testy_rychlosti (
  id         uuid primary key default gen_random_uuid(),
  ucitel_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nazov      text not null check (char_length(nazov) between 1 and 60),
  text       text not null check (char_length(text) between 100 and 20000),
  od_dna     date not null,
  do_dna     date not null,
  vytvorene  timestamptz not null default now(),
  check (od_dna <= do_dna)
);

alter table public.testy_rychlosti enable row level security;
revoke all on public.testy_rychlosti from anon, authenticated;
grant select, insert, update, delete on public.testy_rychlosti to authenticated;

drop policy if exists "ucitel spravuje svoje testy" on public.testy_rychlosti;
create policy "ucitel spravuje svoje testy" on public.testy_rychlosti
  for all to authenticated
  using      (ucitel_id = (select auth.uid()))
  with check (ucitel_id = (select auth.uid()));

-- Práve bežiaci test (pre celú školu). Ak by sa obdobia prekrývali, platí najnovší.
create or replace function public.aktivny_test()
returns public.testy_rychlosti
language sql
stable
security definer
set search_path = ''
as $$
  select t.* from public.testy_rychlosti t
  where public.dnes() between t.od_dna and t.do_dna
  order by t.vytvorene desc
  limit 1;
$$;

revoke execute on function public.aktivny_test() from public, anon, authenticated;

-- 3) Výsledok si pamätá test; nový druh výsledku 'test'
alter table public.vysledky
  add column if not exists test_id uuid references public.testy_rychlosti (id) on delete set null;
alter table public.vysledky drop constraint if exists vysledky_druh_check;
alter table public.vysledky
  add constraint vysledky_druh_check check (druh in ('nahodne', 'kniha', 'lekcia', 'test'));

-- 4) Sieň slávy testu: najlepší platný výkon žiaka za školský rok
create table if not exists public.rekordy_testu (
  id          bigint generated always as identity primary key,
  ziak_id     uuid references public.ziaci (id) on delete set null,  -- po zmazaní žiaka rekord ostane
  ucitel_id   uuid not null references auth.users (id) on delete cascade,
  skolsky_rok text not null,
  meno        text not null,
  trieda      text not null,
  rychlost    int  not null,
  presnost    int  not null,
  datum       timestamptz not null default now(),
  unique (ziak_id, skolsky_rok)
);

create index if not exists rekordy_testu_rychlost on public.rekordy_testu (rychlost desc);

alter table public.rekordy_testu enable row level security;
revoke all on public.rekordy_testu from anon, authenticated;
grant select, delete on public.rekordy_testu to authenticated;  -- zapisuje len databáza sama

drop policy if exists "ucitel vidi rekordy testu" on public.rekordy_testu;
drop policy if exists "ucitel maze rekordy testu" on public.rekordy_testu;
create policy "ucitel vidi rekordy testu" on public.rekordy_testu
  for select to authenticated using (ucitel_id = (select auth.uid()));
create policy "ucitel maze rekordy testu" on public.rekordy_testu
  for delete to authenticated using (ucitel_id = (select auth.uid()));

-- Najlepší platný výkon žiaka v testoch jedného školského roka
create or replace function public.najlepsi_test_v_roku(p_ziak_id uuid, p_rok text)
returns table (rychlost int, presnost int)
language sql
stable
set search_path = ''
as $$
  select v.rychlost, v.presnost
  from public.vysledky v
  where v.ziak_id = p_ziak_id and v.druh = 'test'
    and v.presnost >= public.min_presnost_testu()
    and public.skolsky_rok(v.datum) = p_rok
  order by v.rychlost desc, v.presnost desc
  limit 1;
$$;

revoke execute on function public.najlepsi_test_v_roku(uuid, text) from public, anon, authenticated;

-- 5) Uloženie výsledku po novom aj s testom (inak rovnaké ako vo faza11b.sql)
drop function if exists public.uloz_vysledok(text, text, int, int, int, int, jsonb, text, uuid, int, int);

create or replace function public.uloz_vysledok(
  p_kod            text,
  p_text_zaciatok  text,
  p_rychlost       int,
  p_presnost       int,
  p_chyby          int,
  p_sekundy        int,
  p_klavesy        jsonb,
  p_druh           text default 'nahodne',  -- 'nahodne', 'kniha', 'lekcia', 'test'
  p_kapitola_id    uuid default null,       -- pri knihe: ktorá kapitola
  p_lekcia         int  default null,       -- pri lekcii: číslo lekcie
  p_cvicenie       int  default null,       -- pri lekcii: číslo cvičenia
  p_test_id        uuid default null        -- pri teste: ktorý test
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  z  public.ziaci;
  tr public.triedy;
  k  record;
  rok text := public.skolsky_rok(now());
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    raise exception 'Neplatný kód';
  end if;
  select * into tr from public.triedy where id = z.trieda_id;

  p_druh := coalesce(p_druh, 'nahodne');

  -- Kapitolu uložíme len vtedy, ak ju trieda žiaka naozaj má
  if p_druh <> 'kniha' or (p_kapitola_id is not null and not exists (
    select 1 from public.kapitoly kap
    where kap.id = p_kapitola_id and public.kniha_pre_triedu(kap.kniha_id, z.trieda_id))) then
    p_kapitola_id := null;
  end if;

  -- Lekcia musí mať platné číslo lekcie aj cvičenia, inak je to bežný text
  if p_druh = 'lekcia' and (p_lekcia is null or p_lekcia not between 1 and 99
                            or p_cvicenie is null or p_cvicenie not between 1 and 9) then
    p_druh := 'nahodne';
  end if;
  if p_druh <> 'lekcia' then
    p_lekcia := null;
    p_cvicenie := null;
  end if;

  -- Test sa ráta len vtedy, ak práve beží (inak je to bežný text).
  -- 5 minút tolerancie: pokus začatý tesne pred polnocou posledného dňa sa ešte ráta.
  if p_druh = 'test' and (p_test_id is null or not exists (
    select 1 from public.testy_rychlosti t
    where t.id = p_test_id
      and (public.dnes() between t.od_dna and t.do_dna
           or (now() at time zone 'Europe/Bratislava' - interval '5 minutes')::date = t.do_dna))) then
    p_druh := 'nahodne';
  end if;
  if p_druh <> 'test' then
    p_test_id := null;
  end if;

  insert into public.vysledky (ziak_id, text_zaciatok, rychlost, presnost, chyby, sekundy,
                               druh, kapitola_id, lekcia, cvicenie, test_id)
  values (z.id, left(p_text_zaciatok, 60), p_rychlost, p_presnost, p_chyby, p_sekundy,
          p_druh, p_kapitola_id, p_lekcia, p_cvicenie, p_test_id);

  -- Sieň slávy lekcie: nový rating žiaka v lekcii (ak je lekcia v rozsahu jeho ročníka)
  if p_druh = 'lekcia' then
    perform public.zapis_rekord_lekcie(z.id, p_lekcia);
  end if;

  -- Sieň slávy testu: platný pokus (dosť presný) lepší ako doterajší v tomto roku
  if p_druh = 'test' and p_presnost >= public.min_presnost_testu() and z.aktivny then
    insert into public.rekordy_testu as rk (ziak_id, ucitel_id, skolsky_rok, meno, trieda, rychlost, presnost)
    values (z.id, tr.ucitel_id, rok, z.meno, tr.nazov, p_rychlost, p_presnost)
    on conflict (ziak_id, skolsky_rok) do update
      set rychlost = excluded.rychlost, presnost = excluded.presnost,
          meno = excluded.meno, trieda = excluded.trieda, datum = now()
      where excluded.rychlost > rk.rychlost
         or (excluded.rychlost = rk.rychlost and excluded.presnost > rk.presnost);
  end if;

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

revoke execute on function public.uloz_vysledok(text, text, int, int, int, int, jsonb, text, uuid, int, int, uuid) from public;
grant  execute on function public.uloz_vysledok(text, text, int, int, int, int, jsonb, text, uuid, int, int, uuid) to anon, authenticated;

-- 6) Po zmazaní výsledku: prepočet siene slávy lekcie aj testu (inak ako vo faza11b.sql)
create or replace function public.po_zmazani_vysledku()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rok text := public.skolsky_rok(old.datum);
  r   record;
begin
  -- Maže sa celý žiak (alebo trieda)? Potom už v tabuľke ziaci nie je a rekordy nechávame.
  if not exists (select 1 from public.ziaci where id = old.ziak_id) then
    return null;
  end if;

  if old.druh = 'lekcia' and old.lekcia is not null then
    select * into r from public.rating_ziaka_v_roku(old.ziak_id, old.lekcia, rok);
    if r.body is null then
      delete from public.rekordy_lekcii
      where ziak_id = old.ziak_id and lekcia = old.lekcia and skolsky_rok = rok;
    else
      -- len úprava existujúceho záznamu (záznam zmazaný zo siene slávy sa neobnoví)
      update public.rekordy_lekcii
      set body = r.body, rychlost = r.rychlost, presnost = r.presnost
      where ziak_id = old.ziak_id and lekcia = old.lekcia and skolsky_rok = rok;
    end if;
  end if;

  if old.druh = 'test' then
    select * into r from public.najlepsi_test_v_roku(old.ziak_id, rok);
    if r.rychlost is null then
      delete from public.rekordy_testu where ziak_id = old.ziak_id and skolsky_rok = rok;
    else
      update public.rekordy_testu
      set rychlost = r.rychlost, presnost = r.presnost
      where ziak_id = old.ziak_id and skolsky_rok = rok;
    end if;
  end if;
  return null;
end;
$$;

-- 7) Rebríček testu pre učiteľa: najlepší platný pokus každého aktívneho žiaka
--    (pravidlá RLS mu ukážu len jeho triedy)
create or replace function public.rating_testu(p_test_id uuid)
returns table (ziak_id uuid, trieda_id uuid, meno text, rychlost int, presnost int, pokusov int)
language sql
stable
set search_path = ''
as $$
  select distinct on (v.ziak_id)
         v.ziak_id, z.trieda_id, z.meno, v.rychlost, v.presnost,
         (select count(*)::int from public.vysledky w
          where w.ziak_id = v.ziak_id and w.druh = 'test' and w.test_id = p_test_id)
  from public.vysledky v
  join public.ziaci z on z.id = v.ziak_id
  where v.druh = 'test' and v.test_id = p_test_id and z.aktivny
    and v.presnost >= public.min_presnost_testu()
  order by v.ziak_id, v.rychlost desc, v.presnost desc;
$$;

revoke execute on function public.rating_testu(uuid) from public, anon;
grant  execute on function public.rating_testu(uuid) to authenticated;

-- 8) Test pre žiaka: bežiaci test (s textom), jeho miesto v triede a v škole,
--    žiak tesne pred ním a rekord všetkých čias.
--    "test": null, ak práve žiadny test nebeží (rekord sa pošle aj tak).
create or replace function public.test_pre_ziaka(p_kod text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  z public.ziaci;
  tr public.triedy;
  t public.testy_rychlosti;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    return null;
  end if;
  select * into tr from public.triedy where id = z.trieda_id;
  t := public.aktivny_test();

  return (
    with r  as (select * from public.rating_testu(t.id)),          -- celá škola
         rt as (select * from r where r.trieda_id = z.trieda_id),  -- trieda žiaka
         ja as (select r.rychlost, r.presnost from r where r.ziak_id = z.id)
    select json_build_object(
      'min_presnost', public.min_presnost_testu(),
      'test', case when t.id is null then null else
        json_build_object('id', t.id, 'nazov', t.nazov, 'text', t.text, 'od', t.od_dna, 'do', t.do_dna) end,
      'pokusov', (select count(*) from public.vysledky v
                  where v.ziak_id = z.id and v.druh = 'test' and v.test_id = t.id),
      'ja', (select json_build_object('rychlost', ja.rychlost, 'presnost', ja.presnost) from ja),
      'trieda', json_build_object(
        'nazov', tr.nazov,
        'pocet', (select count(*) from rt),
        'miesto', (select 1 + (select count(*) from rt where rt.rychlost > ja.rychlost) from ja),
        'pred', (select json_build_object('meno', p.meno, 'rychlost', p.rychlost,
                          'miesto', 1 + (select count(*) from rt q where q.rychlost > p.rychlost))
                 from rt p, ja where p.rychlost > ja.rychlost
                 order by p.rychlost, p.meno limit 1)),
      'skola', json_build_object(
        'pocet', (select count(*) from r),
        'miesto', (select 1 + (select count(*) from r where r.rychlost > ja.rychlost) from ja),
        'pred', (select json_build_object('meno', p.meno, 'rychlost', p.rychlost,
                          'miesto', 1 + (select count(*) from r q where q.rychlost > p.rychlost))
                 from r p, ja where p.rychlost > ja.rychlost
                 order by p.rychlost, p.meno limit 1)),
      -- Sieň slávy: najrýchlejší všetkých čias (pri rovnosti ten, kto to dosiahol skôr)
      'rekord', (select json_build_object('meno', rk.meno, 'trieda', rk.trieda,
                          'rok', rk.skolsky_rok, 'rychlost', rk.rychlost, 'presnost', rk.presnost)
                 from public.rekordy_testu rk
                 order by rk.rychlost desc, rk.presnost desc, rk.datum
                 limit 1)
    )
  );
end;
$$;

revoke execute on function public.test_pre_ziaka(text) from public;
grant  execute on function public.test_pre_ziaka(text) to anon, authenticated;
