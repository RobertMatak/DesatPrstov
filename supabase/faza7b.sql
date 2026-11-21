-- =====================================================================
--  Desať Prstov – rozpracované kapitoly (koncepty), doplnok k fáze 7
--  Spúšťa sa raz, PO súbore faza7.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
--
--  Kapitolu označenú ako koncept žiaci nevidia. Kniha, ktorá má
--  len koncepty, sa žiakom nezobrazí vôbec.
-- =====================================================================

alter table public.kapitoly add column koncept boolean not null default false;

-- Funkcie pre žiakov po novom vynechávajú koncepty
-- (inak sú rovnaké ako vo faza7.sql)
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
  if kap.id is null or kap.koncept or not public.kniha_pre_triedu(kap.kniha_id, z.trieda_id) then
    return null;
  end if;
  return kap.text;
end;
$$;

