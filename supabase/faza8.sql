-- =====================================================================
--  Desať Prstov – fáza 8: knihy sú vždy pre všetky triedy
--  Spusti v Supabase → SQL Editor → Run (stačí raz).
--
--  Doteraz mohla kniha patriť jednej triede (trieda_id) alebo všetkým (null).
--  Odteraz je každá kniha pre všetky triedy učiteľa, preto všetkým knihám
--  stĺpec trieda_id vyprázdnime. Kapitoly ani postup žiakov sa nemenia.
--  Stĺpec ostáva v tabuľke, aby netreba bolo meniť funkcie pre žiakov
--  (tie s hodnotou null počítajú: null = všetky triedy).
-- =====================================================================

update public.knihy
set trieda_id = null
where trieda_id is not null;

-- Kontrola: musí vyjsť 0
select count(*) as knih_len_pre_jednu_triedu
from public.knihy
where trieda_id is not null;
