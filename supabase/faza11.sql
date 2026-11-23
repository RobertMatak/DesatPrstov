-- =====================================================================
--  Desať Prstov – fáza 11: rebríčky lekcií
--  Spúšťa sa raz, PO súbore faza9.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
--
--  Rating žiaka v lekcii = priemer najlepších bodov z každého cvičenia lekcie
--  (body = rýchlosť × presnosť³, počíta ich databáza pri každom výsledku).
--  Cvičenie, ktoré žiak ešte nepísal, má 0 bodov – oplatí sa spraviť všetky.
--  Do rebríčka patria len aktívni žiaci, ktorí majú lekciu v rozsahu
--  „od–do“ svojho ročníka (lekcie na opakovanie sa nerátajú).
-- =====================================================================

-- 1) Počet cvičení v lekcii (musí sedieť s lekcie-obsah.js):
--    lekcie 13–17 majú 4 cvičenia, ostatné 3
create or replace function public.pocet_cviceni(p_lekcia int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case when p_lekcia between 13 and 17 then 4 else 3 end;
$$;

-- 2) Rating všetkých žiakov v lekcii.
--    Učiteľ ju volá priamo: pravidlá RLS mu ukážu len jeho triedy.
--    Funkcia pre žiaka (nižšie) ju volá s právami databázy, teda pre celú školu.
--    rychlost a presnost = priemer z najlepších pokusov (pre tlač rebríčka)
create or replace function public.rating_lekcie(p_lekcia int)
returns table (ziak_id uuid, trieda_id uuid, meno text, body numeric,
               rychlost numeric, presnost numeric, cviceni int)
language sql
stable
set search_path = ''
as $$
  with najlepsie as (
    -- najlepší pokus (najviac bodov) v každom cvičení
    select distinct on (v.ziak_id, v.cvicenie)
           v.ziak_id, v.cvicenie, v.body, v.rychlost, v.presnost
    from public.vysledky v
    where v.druh = 'lekcia' and v.lekcia = p_lekcia
      and v.cvicenie between 1 and public.pocet_cviceni(p_lekcia)
    order by v.ziak_id, v.cvicenie, v.body desc, v.presnost desc
  )
  select z.id, z.trieda_id, z.meno,
         round(sum(n.body) / public.pocet_cviceni(p_lekcia), 1),
         round(avg(n.rychlost), 0),
         round(avg(n.presnost), 0),
         count(*)::int
  from najlepsie n
  join public.ziaci z on z.id = n.ziak_id
  join public.triedy t on t.id = z.trieda_id
  left join public.dlzky_rocnikov d on d.ucitel_id = t.ucitel_id and d.rocnik = t.rocnik
  where z.aktivny
    and p_lekcia between coalesce(d.lekcie_od, public.predvolene_lekcie_od(t.rocnik))
                     and coalesce(d.lekcie_do, public.predvolene_lekcie_do(t.rocnik))
  group by z.id, z.trieda_id, z.meno;
$$;

-- Supabase dáva novým funkciám právo spúšťania aj neprihláseným (anon), preto ho berieme
revoke execute on function public.rating_lekcie(int) from public, anon;
grant  execute on function public.rating_lekcie(int) to authenticated;

-- 3) Rebríček pre žiaka: jeho miesto v triede a v škole a jeden žiak tesne pred ním.
--    Iné mená ani body žiak nedostane.
--    Výsledok napr.:
--    { "v_rozsahu": true, "pocet_cviceni": 3,
--      "ja": { "body": 31.1, "cviceni": 3 },
--      "trieda": { "nazov": "6.D", "pocet": 24, "miesto": 7, "pred": { "meno": "Jano S.", "body": 33.0, "miesto": 6 } },
--      "skola":  { "pocet": 180, "miesto": 13, "pred": { "meno": "Dano F.", "body": 34.0, "miesto": 12 } } }
create or replace function public.rebricek_lekcie(p_kod text, p_lekcia int)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  z   public.ziaci;
  tr  public.triedy;
  od_ int;
  do_ int;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null or p_lekcia is null or p_lekcia not between 1 and 99 then
    return null;
  end if;
  select * into tr from public.triedy where id = z.trieda_id;

  -- Rozsah lekcií ročníka žiaka (nastavenie učiteľa, inak predvolené)
  select coalesce(d.lekcie_od, public.predvolene_lekcie_od(tr.rocnik)),
         coalesce(d.lekcie_do, public.predvolene_lekcie_do(tr.rocnik))
    into od_, do_
  from (select 1) x
  left join public.dlzky_rocnikov d on d.ucitel_id = tr.ucitel_id and d.rocnik = tr.rocnik;

  return (
    with r  as (select * from public.rating_lekcie(p_lekcia)),     -- celá škola
         rt as (select * from r where r.trieda_id = z.trieda_id),  -- trieda žiaka
         ja as (select r.body, r.cviceni from r where r.ziak_id = z.id)
    select json_build_object(
      'v_rozsahu', p_lekcia between od_ and do_,
      'pocet_cviceni', public.pocet_cviceni(p_lekcia),
      'ja', (select json_build_object('body', ja.body, 'cviceni', ja.cviceni) from ja),
      'trieda', json_build_object(
        'nazov', tr.nazov,
        'pocet', (select count(*) from rt),
        'miesto', (select 1 + (select count(*) from rt where rt.body > ja.body) from ja),
        -- žiak tesne pred: najmenej bodov spomedzi tých, čo majú viac
        'pred', (select json_build_object('meno', p.meno, 'body', p.body,
                          'miesto', 1 + (select count(*) from rt q where q.body > p.body))
                 from rt p, ja
                 where p.body > ja.body
                 order by p.body, p.meno
                 limit 1)),
      'skola', json_build_object(
        'pocet', (select count(*) from r),
        'miesto', (select 1 + (select count(*) from r where r.body > ja.body) from ja),
        'pred', (select json_build_object('meno', p.meno, 'body', p.body,
                          'miesto', 1 + (select count(*) from r q where q.body > p.body))
                 from r p, ja
                 where p.body > ja.body
                 order by p.body, p.meno
                 limit 1))
    )
  );
end;
$$;

revoke execute on function public.rebricek_lekcie(text, int) from public;
grant  execute on function public.rebricek_lekcie(text, int) to anon, authenticated;
