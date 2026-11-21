-- =====================================================================
--  Desať Prstov – náhodné texty podľa ročníkov (doplnok k fáze 7)
--  Spúšťa sa raz, PO súbore faza7b.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
--
--  Náhodný text už nepatrí jednej triede, ale vybraným ročníkom (1–9).
--  Uvidia ho všetky triedy učiteľa v týchto ročníkoch.
-- =====================================================================

-- Nový stĺpec: zoznam ročníkov, napr. {3,4} alebo {7,8,9}
alter table public.texty add column rocniky int[];

-- Doterajšie texty: "pre všetky triedy" → všetky ročníky,
-- "len pre triedu" → ročník tej triedy (ak ho trieda nemá, tak všetky)
update public.texty t
set rocniky = case
  when t.trieda_id is null then array[1, 2, 3, 4, 5, 6, 7, 8, 9]
  else coalesce(
    (select array[tr.rocnik] from public.triedy tr where tr.id = t.trieda_id and tr.rocnik is not null),
    array[1, 2, 3, 4, 5, 6, 7, 8, 9])
end;

alter table public.texty
  alter column rocniky set not null,
  alter column rocniky set default array[1, 2, 3, 4, 5, 6, 7, 8, 9],
  add constraint texty_rocniky_check
    check (cardinality(rocniky) between 1 and 9 and rocniky <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9]);

-- Trieda už neurčuje, kto text vidí (stĺpec ostáva, ale nepoužíva sa)
update public.texty set trieda_id = null;

-- Funkcia pre žiakov: náhodné texty podľa ročníka triedy
-- (inak je rovnaká ako vo faza7b.sql; trieda bez ročníka vidí všetky texty učiteľa)
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

