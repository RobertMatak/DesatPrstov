-- =====================================================================
--  Desať Prstov – fáza 11b: sieň slávy (rekord lekcie všetkých čias)
--  Spúšťa sa raz, PO súbore faza11.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
--
--  Pri každom výsledku z lekcie, ktorú má žiak v rozsahu svojho ročníka,
--  sa jeho rating v lekcii zapíše do tabuľky rekordy_lekcii (ak je lepší
--  ako jeho doterajší v tomto školskom roku). Uloží sa aj meno, trieda
--  a školský rok, aby rekord ostal, aj keď žiak zo školy odíde a učiteľ ho zmaže.
--  Rekord lekcie = najvyšší rating v tejto tabuľke (v celej škole).
-- =====================================================================

-- 1) Školský rok podľa dátumu: september 2025 – august 2026 = "2025/26"
create or replace function public.skolsky_rok(p_datum timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select y || '/' || lpad(((y + 1) % 100)::text, 2, '0')
  from (select extract(year from p_datum)::int
               - case when extract(month from p_datum) < 9 then 1 else 0 end as y) x;
$$;

-- 2) Tabuľka rekordov: najlepší rating žiaka v lekcii za jeden školský rok
create table public.rekordy_lekcii (
  id          bigint generated always as identity primary key,
  ziak_id     uuid references public.ziaci (id) on delete set null,  -- po zmazaní žiaka ostane rekord bez väzby
  ucitel_id   uuid not null references auth.users (id) on delete cascade, -- učiteľ triedy v tom čase
  lekcia      int  not null check (lekcia between 1 and 99),
  skolsky_rok text not null,
  meno        text not null,
  trieda      text not null,
  body        numeric(6, 1) not null,
  rychlost    int,
  presnost    int,
  datum       timestamptz not null default now(),
  unique (ziak_id, lekcia, skolsky_rok)
);

create index on public.rekordy_lekcii (lekcia, body desc);

alter table public.rekordy_lekcii enable row level security;
-- Supabase dáva novým tabuľkám všetky práva (aj TRUNCATE, ktoré obíde pravidlá), preto najprv všetko zoberieme
revoke all on public.rekordy_lekcii from anon, authenticated;
grant select, delete on public.rekordy_lekcii to authenticated;  -- zapisuje len databáza sama

-- Učiteľ vidí a môže zmazať rekordy žiakov svojich tried (napr. keď niekto písal za spolužiaka)
create policy "ucitel vidi rekordy svojich ziakov" on public.rekordy_lekcii
  for select to authenticated using (ucitel_id = (select auth.uid()));
create policy "ucitel maze rekordy svojich ziakov" on public.rekordy_lekcii
  for delete to authenticated using (ucitel_id = (select auth.uid()));

-- 3) Zápis rekordu žiaka v lekcii (volá uloz_vysledok, žiak ani učiteľ ju volať nemôžu)
create or replace function public.zapis_rekord_lekcie(p_ziak_id uuid, p_lekcia int)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r  record;
  z  public.ziaci;
  tr public.triedy;
begin
  -- rating_lekcie vráti žiaka, len ak je aktívny a má lekciu v rozsahu svojho ročníka
  select * into r from public.rating_lekcie(p_lekcia) x where x.ziak_id = p_ziak_id;
  if r.ziak_id is null then
    return;
  end if;
  select * into z from public.ziaci where id = p_ziak_id;
  select * into tr from public.triedy where id = z.trieda_id;

  insert into public.rekordy_lekcii as rk
    (ziak_id, ucitel_id, lekcia, skolsky_rok, meno, trieda, body, rychlost, presnost)
  values (z.id, tr.ucitel_id, p_lekcia, public.skolsky_rok(now()), z.meno, tr.nazov,
          r.body, r.rychlost, r.presnost)
  on conflict (ziak_id, lekcia, skolsky_rok) do update
    set body = excluded.body, rychlost = excluded.rychlost, presnost = excluded.presnost,
        meno = excluded.meno, trieda = excluded.trieda, datum = now()
    where excluded.body > rk.body;  -- prepíše sa len lepším ratingom
end;
$$;

revoke execute on function public.zapis_rekord_lekcie(uuid, int) from public, anon, authenticated;

-- 4) Uloženie výsledku: rovnaké ako vo faza9.sql, navyše zápis rekordu pri lekcii
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

  -- Sieň slávy: nový rating žiaka v lekcii (ak je lekcia v rozsahu jeho ročníka)
  if p_druh = 'lekcia' then
    perform public.zapis_rekord_lekcie(z.id, p_lekcia);
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

-- 5) Rebríček pre žiaka po novom aj s rekordom lekcie (sieň slávy):
--    "rekord": { "meno": "Dano F.", "trieda": "9.A", "rok": "2025/26", "body": 45.2 }
--    Inak rovnaký ako vo faza11.sql.
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
                 limit 1)),
      -- Sieň slávy: najvyšší rating všetkých čias (pri rovnosti ten, kto ho dosiahol skôr)
      'rekord', (select json_build_object('meno', rk.meno, 'trieda', rk.trieda,
                          'rok', rk.skolsky_rok, 'body', rk.body)
                 from public.rekordy_lekcii rk
                 where rk.lekcia = p_lekcia
                 order by rk.body desc, rk.datum
                 limit 1)
    )
  );
end;
$$;

-- 6) Doterajšie výsledky: zapíšeme rekordy, ktoré už žiaci majú (do tohto školského roka)
select public.zapis_rekord_lekcie(r.ziak_id, l)
from generate_series(1, 18) l
cross join lateral public.rating_lekcie(l) r;
