-- =====================================================================
--  Desať Prstov – presnosť v knihách a druh výsledkov (doplnok k fáze 7)
--  Spúšťa sa raz, PO súbore faza7c.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
--
--  - pri ročníkoch sa dá nastaviť potrebná presnosť pre postup v knihách
--  - pri každom výsledku sa ukladá, či išlo o náhodný text alebo knihu
-- =====================================================================

-- 1) Potrebná presnosť (%) pre ročník; prázdne = predvolená hodnota
alter table public.dlzky_rocnikov
  add column presnost int check (presnost between 50 and 100);

create or replace function public.predvolena_presnost(p_rocnik int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p_rocnik in (1, 2) then 80
    when p_rocnik in (3, 4) then 85
    else 90
  end;
$$;

-- 2) Druh výsledku a kapitola (pri knihe)
alter table public.vysledky
  add column druh text not null default 'nahodne'
    check (druh in ('nahodne', 'kniha', 'lekcia')),
  add column kapitola_id uuid references public.kapitoly (id) on delete set null;

-- 3) Uloženie výsledku po novom aj s druhom a kapitolou.
--    Staré volanie (bez druhu) funguje ďalej: druh bude 'nahodne'.
drop function if exists public.uloz_vysledok(text, text, int, int, int, int, jsonb);

-- Uloženie výsledku a štatistiky klávesov po dopísaní textu (po novom aj s druhom).
--    p_klavesy je napríklad {"a": {"spolu": 12, "chyby": 1}, "ď": {...}}
create or replace function public.uloz_vysledok(
  p_kod            text,
  p_text_zaciatok  text,
  p_rychlost       int,
  p_presnost       int,
  p_chyby          int,
  p_sekundy        int,
  p_klavesy        jsonb,
  p_druh           text default 'nahodne',  -- 'nahodne', 'kniha' (neskôr 'lekcia')
  p_kapitola_id    uuid default null        -- pri knihe: ktorá kapitola
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

  -- Kapitolu uložíme len vtedy, ak ju trieda žiaka naozaj má
  if p_kapitola_id is not null and not exists (
    select 1 from public.kapitoly kap
    where kap.id = p_kapitola_id and public.kniha_pre_triedu(kap.kniha_id, z.trieda_id)) then
    p_kapitola_id := null;
  end if;

  insert into public.vysledky (ziak_id, text_zaciatok, rychlost, presnost, chyby, sekundy, druh, kapitola_id)
  values (z.id, left(p_text_zaciatok, 60), p_rychlost, p_presnost, p_chyby, p_sekundy,
          coalesce(p_druh, 'nahodne'), p_kapitola_id);

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


revoke execute on function public.uloz_vysledok(text, text, int, int, int, int, jsonb, text, uuid) from public;
grant  execute on function public.uloz_vysledok(text, text, int, int, int, int, jsonb, text, uuid) to anon, authenticated;

-- 4) Funkcia pre žiakov po novom posiela aj potrebnú presnosť
--    (inak je rovnaká ako vo faza7c.sql)
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
    'presnost', coalesce(
      (select d.presnost from public.dlzky_rocnikov d
       where d.ucitel_id = tr.ucitel_id and d.rocnik = tr.rocnik),
      public.predvolena_presnost(tr.rocnik)),
    'texty', coalesce((
      select json_agg(json_build_object(
               'id', t.id, 'nazov', t.nazov, 'text', t.text,
               'autor', t.autor, 'zdroj', t.zdroj)
             order by t.vytvorene)
      from public.texty t
      where t.ucitel_id = tr.ucitel_id
        and (tr.rocnik is null or tr.rocnik = any(t.rocniky))), '[]'::json),
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
                 where kap.kniha_id = k.id and not kap.koncept), '[]'::json))
             order by k.vytvorene)
      from public.knihy k
      where public.kniha_pre_triedu(k.id, tr.id)
        and exists (select 1 from public.kapitoly kap
                    where kap.kniha_id = k.id and not kap.koncept)), '[]'::json),
    'postup', coalesce((
      select json_object_agg(p.kapitola_id, p.pozicia)
      from public.postup_kapitol p
      where p.ziak_id = z.id), '{}'::json)
  );
end;
$$;

