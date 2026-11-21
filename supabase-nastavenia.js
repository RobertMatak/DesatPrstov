// ===== Pripojenie k databáze Supabase =====
// Tieto dve hodnoty smú byť verejné (sú v každej stránke, ktorá Supabase používa).
// Ochranu údajov zabezpečujú pravidlá v databáze (supabase/schema.sql).
// NIKDY sem nedávaj "secret" kľúč ani heslo k databáze!

const SUPABASE_URL = "https://omreejunhmcqjaoncsbs.supabase.co";
const SUPABASE_KLUC = "sb_publishable_neGaXGWgpAQHkEBD_xRqUw_2LpLTnHU";

// Pripojenie k databáze. Premenná "supabase" je knižnica (supabase.js),
// "db" je naše pripojenie, cez ktoré posielame dotazy.
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KLUC);
