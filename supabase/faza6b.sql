-- =====================================================================
--  Desať Prstov – autor a zdroj textov (doplnok k fáze 6)
--  Spúšťa sa raz, PO súbore faza6.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
-- =====================================================================

-- Dva nepovinné stĺpce pri textoch
alter table public.texty
  add column autor text check (char_length(autor) <= 100),
  add column zdroj text check (char_length(zdroj) <= 300);

-- Funkcia pre žiakov po novom posiela aj autora a zdroj textu
-- (inak je rovnaká ako vo faza6.sql)
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
    'postup', coalesce((
      select json_object_agg(p.text_id, p.pozicia)
      from public.postup_pribehov p
      where p.ziak_id = z.id), '{}'::json)
  );
end;
$$;
