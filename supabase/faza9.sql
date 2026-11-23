-- =====================================================================
--  Desať Prstov – fáza 9: lekcie
--  Spúšťa sa raz, PO súbore faza8.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
--
--  - ročník má rozsah lekcií „od–do“ (do = najvyššia prístupná lekcia,
--    od = lekcie, ktoré ročník robí tento rok; nižšie sú na opakovanie)
--  - výsledok si pamätá lekciu a cvičenie
--  - každý výsledok má body (rating) = rýchlosť × presnosť³,
--    počíta ich sama databáza, aby sa nedali podvrhnúť
-- =====================================================================

-- 1) Rozsah lekcií pre ročník; prázdne = predvolené hodnoty
--    0 = ročník zatiaľ lekcie nemá (1. a 2. ročník)
alter table public.dlzky_rocnikov
  add column lekcie_od int check (lekcie_od between 0 and 99),
  add column lekcie_do int check (lekcie_do between 0 and 99),
  add constraint lekcie_od_do check (lekcie_od is null or lekcie_do is null or lekcie_od <= lekcie_do);

-- Predvolené rozsahy (rovnaké ako v dlzky-admin.js):
--   1.–2.: žiadne, 3.: 1–4, 4.: 4–8, 5.: 8–10, 6.: 10–12, 7.: 12–14, 8.: 14–16, 9.: 16–18
--   trieda bez ročníka (krúžok): všetky
create or replace function public.predvolene_lekcie_od(p_rocnik int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case when p_rocnik is null then 1
              else coalesce((array[0, 0, 1, 4, 8, 10, 12, 14, 16])[p_rocnik], 1) end;
$$;

create or replace function public.predvolene_lekcie_do(p_rocnik int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case when p_rocnik is null then 18
              else coalesce((array[0, 0, 4, 8, 10, 12, 14, 16, 18])[p_rocnik], 18) end;
$$;

-- 2) Lekcia, cvičenie a body pri výsledku
alter table public.vysledky
  add column lekcia  int check (lekcia between 1 and 99),
  add column cvicenie int check (cvicenie between 1 and 9),
  -- "generated always as": stĺpec si databáza vypočíta sama pri každom uložení
  add column body numeric(6, 1)
    generated always as (round(rychlost * power(presnost / 100.0, 3), 1)) stored;

-- 3) Uloženie výsledku po novom aj s lekciou a cvičením.
--    Staré volania (bez lekcie) fungujú ďalej.
drop function if exists public.uloz_vysledok(text, text, int, int, int, int, jsonb, text, uuid);

create or replace function public.uloz_vysledok(
  p_kod            text,
  p_text_zaciatok  text,
  p_rychlost       int,
  p_presnost       int,
  p_chyby          int,
  p_sekundy        int,
  p_klavesy        jsonb,
  p_druh           text default 'nahodne',  -- 'nahodne', 'kniha', 'lekcia'
  p_kapitola_id    uuid default null,       -- pri knihe: ktorá kapitola
  p_lekcia         int  default null,       -- pri lekcii: číslo lekcie
  p_cvicenie       int  default null        -- pri lekcii: číslo cvičenia
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

  insert into public.vysledky (ziak_id, text_zaciatok, rychlost, presnost, chyby, sekundy,
                               druh, kapitola_id, lekcia, cvicenie)
  values (z.id, left(p_text_zaciatok, 60), p_rychlost, p_presnost, p_chyby, p_sekundy,
          p_druh, p_kapitola_id, p_lekcia, p_cvicenie);

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

revoke execute on function public.uloz_vysledok(text, text, int, int, int, int, jsonb, text, uuid, int, int) from public;
grant  execute on function public.uloz_vysledok(text, text, int, int, int, int, jsonb, text, uuid, int, int) to anon, authenticated;

-- 4) Údaje pre žiaka po novom aj s rozsahom lekcií a postupom v lekciách
--    (inak rovnaké ako vo faza7d.sql)
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
  d  public.dlzky_rocnikov;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    return null;
  end if;
  select * into tr from public.triedy where id = z.trieda_id;
  select * into d from public.dlzky_rocnikov
  where ucitel_id = tr.ucitel_id and rocnik = tr.rocnik;

  return json_build_object(
    'rocnik', tr.rocnik,
    'slov', coalesce(d.slov, public.predvolena_dlzka(tr.rocnik)),
    'presnost', coalesce(d.presnost, public.predvolena_presnost(tr.rocnik)),
    'lekcie_od', coalesce(d.lekcie_od, public.predvolene_lekcie_od(tr.rocnik)),
    'lekcie_do', coalesce(d.lekcie_do, public.predvolene_lekcie_do(tr.rocnik)),
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
      where p.ziak_id = z.id), '{}'::json),
    -- Najlepšia presnosť v každom cvičení: {"6-2": 95, ...} (lekcia-cvičenie)
    'postup_lekcii', coalesce((
      select json_object_agg(v.lekcia || '-' || v.cvicenie, v.presnost)
      from (select lekcia, cvicenie, max(presnost) as presnost
            from public.vysledky
            where ziak_id = z.id and druh = 'lekcia' and lekcia is not null
            group by lekcia, cvicenie) v), '{}'::json)
  );
end;
$$;
