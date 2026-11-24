-- =====================================================================
--  Desať Prstov – fáza 13: Rekordy (obrazovka žiaka)
--  Spúšťa sa PO súbore faza12.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
--  Dá sa spustiť aj viackrát, nič sa tým nepokazí.
--
--  Jedna funkcia pošle žiakovi všetko pre obrazovku 🏆 Rekordy:
--   - lekcie na tento rok: jeho rating, miesto v triede a v škole
--   - test rýchlosti, ktorý práve beží: jeho výsledok a miesta
--   - sieň slávy: rekord každej lekcie a testu (meno, trieda, rok) a či ho drží on
--   - osobné rekordy: najrýchlejší text, najlepší test, texty bez chyby, čas písania
--  Mená ostatných žiakov žiak nevidí, len mená rekordérov.
-- =====================================================================

create or replace function public.rekordy_ziaka(p_kod text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  z     public.ziaci;
  tr    public.triedy;
  t     public.testy_rychlosti;
  od_   int;
  do_   int;
  lekcie jsonb;
  slava  jsonb;
  test   jsonb;
begin
  z := public.ziak_podla_kodu(p_kod);
  if z.id is null then
    return null;
  end if;
  select * into tr from public.triedy where id = z.trieda_id;

  -- Rozsah lekcií ročníka žiaka (nastavenie učiteľa, inak predvolené)
  select coalesce(d.lekcie_od, public.predvolene_lekcie_od(tr.rocnik)),
         coalesce(d.lekcie_do, public.predvolene_lekcie_do(tr.rocnik))
    into od_, do_
  from (select 1) x
  left join public.dlzky_rocnikov d on d.ucitel_id = tr.ucitel_id and d.rocnik = tr.rocnik;

  -- 1) Lekcie na tento rok: rating žiaka a miesta (rating_lekcie je z faza11.sql)
  select coalesce(jsonb_agg(polozka order by l), '[]'::jsonb) into lekcie
  from generate_series(greatest(od_, 1), least(do_, 18)) l,
  lateral (
    with r  as materialized (select * from public.rating_lekcie(l)),
         ja as (select r.body, r.cviceni from r where r.ziak_id = z.id)
    select jsonb_build_object(
      'lekcia', l,
      'body', (select ja.body from ja),
      'cviceni', (select ja.cviceni from ja),
      'pocet_cviceni', public.pocet_cviceni(l),
      'miesto_trieda', (select 1 + (select count(*) from r where r.trieda_id = z.trieda_id and r.body > ja.body) from ja),
      'pocet_trieda', (select count(*) from r where r.trieda_id = z.trieda_id),
      'miesto_skola', (select 1 + (select count(*) from r where r.body > ja.body) from ja),
      'pocet_skola', (select count(*) from r)
    ) as polozka
  ) x;

  -- 2) Sieň slávy: rekord každej lekcie 1–18 (null, ak ho ešte nikto nemá)
  select coalesce(jsonb_agg(jsonb_build_object(
           'lekcia', l,
           'meno', rk.meno, 'trieda', rk.trieda, 'rok', rk.skolsky_rok, 'body', rk.body,
           'moj', rk.ziak_id is not distinct from z.id and rk.ziak_id is not null)
         order by l), '[]'::jsonb) into slava
  from generate_series(1, 18) l
  left join lateral (
    select k.* from public.rekordy_lekcii k
    where k.lekcia = l
    order by k.body desc, k.datum
    limit 1) rk on true;

  -- 3) Test rýchlosti, ktorý práve beží: výsledok žiaka a miesta (rating_testu je z faza12.sql)
  t := public.aktivny_test();
  if t.id is not null then
    with r  as materialized (select * from public.rating_testu(t.id)),
         ja as (select r.rychlost, r.presnost from r where r.ziak_id = z.id)
    select jsonb_build_object(
      'nazov', t.nazov,
      'rychlost', (select ja.rychlost from ja),
      'miesto_trieda', (select 1 + (select count(*) from r where r.trieda_id = z.trieda_id and r.rychlost > ja.rychlost) from ja),
      'pocet_trieda', (select count(*) from r where r.trieda_id = z.trieda_id),
      'miesto_skola', (select 1 + (select count(*) from r where r.rychlost > ja.rychlost) from ja),
      'pocet_skola', (select count(*) from r)
    ) into test;
  end if;

  return json_build_object(
    'trieda', tr.nazov,
    'lekcie_od', od_,
    'lekcie_do', do_,
    'lekcie', lekcie,
    'slava_lekcii', slava,
    'test', test,
    'rekord_testu', (select jsonb_build_object('meno', rk.meno, 'trieda', rk.trieda, 'rok', rk.skolsky_rok,
                              'rychlost', rk.rychlost, 'moj', rk.ziak_id is not null and rk.ziak_id = z.id)
                     from public.rekordy_testu rk
                     order by rk.rychlost desc, rk.presnost desc, rk.datum
                     limit 1),
    -- 4) Osobné rekordy žiaka zo všetkých jeho výsledkov
    'osobne', (select jsonb_build_object(
        'najrychlejsi_text', max(v.rychlost) filter (where v.druh in ('nahodne', 'kniha')),
        'najlepsi_test', max(v.rychlost) filter (where v.druh = 'test' and v.presnost >= public.min_presnost_testu()),
        'bez_chyby', count(*) filter (where v.chyby = 0),
        'textov', count(*),
        'sekund', coalesce(sum(v.sekundy), 0))
      from public.vysledky v
      where v.ziak_id = z.id)
  );
end;
$$;

revoke execute on function public.rekordy_ziaka(text) from public;
grant  execute on function public.rekordy_ziaka(text) to anon, authenticated;
