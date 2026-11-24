-- =====================================================================
--  Desať Prstov – nástenka siene slávy (fáza 12 na tabuli)
--  Spúšťa sa PO súbore faza13.sql:
--  Supabase → SQL Editor → New query → vložiť celý súbor → Run
--  Dá sa spustiť aj viackrát, nič sa tým nepokazí.
--
--  Stránka si pamätá, čo je vytlačené na nástenke (každý riadok: kto, rok,
--  výkon) a v akom formáte. Podľa toho ponúkne prelepky: riadky, ktoré sa
--  od posledného vytlačenia zmenili. Uložené je to v databáze, takže to
--  funguje na ktoromkoľvek počítači, kde sa učiteľ prihlási.
-- =====================================================================

create table if not exists public.nastenka_ucitela (
  ucitel_id  uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  format     text not null default 'A4' check (format in ('A4', 'A3', 'A2')),
  vytlacene  timestamptz,
  obsah      jsonb not null default '{}'::jsonb   -- "skola|L9": { "meno": …, "rok": …, … }
);

alter table public.nastenka_ucitela enable row level security;
revoke all on public.nastenka_ucitela from anon, authenticated;
grant select, insert, update, delete on public.nastenka_ucitela to authenticated;

drop policy if exists "ucitel ma svoju nastenku" on public.nastenka_ucitela;
create policy "ucitel ma svoju nastenku" on public.nastenka_ucitela
  for all to authenticated
  using      (ucitel_id = (select auth.uid()))
  with check (ucitel_id = (select auth.uid()));
