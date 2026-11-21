// ===== Desať Prstov – stránka pre učiteľa =====
// Všetky dotazy idú cez "db" (supabase-nastavenia.js).
// Čo učiteľ smie vidieť a meniť, strážia pravidlá v databáze, nie tento kód.
//
// Novinka oproti aplikácii: async / await.
// Dotaz do databázy chvíľu trvá. "await" znamená „počkaj na odpoveď a až potom
// pokračuj ďalším riadkom“. Funkcia, ktorá používa await, musí byť "async".
// Každý dotaz vráti { data, error }: buď dáta, alebo popis chyby.

const $ = (id) => document.getElementById(id); // skratka, aby sme nepísali stále document.getElementById

const ADRESA_APLIKACIE = "robertmatak.github.io/DesatPrstov";
const MAX_DLZKA_MENA = 50;

let triedy = [];           // triedy prihláseného učiteľa
let vybranaTrieda = null;  // trieda, ktorej žiakov práve vidíme
let ziaci = [];            // žiaci vybranej triedy

// ===== Zapamätanie, kde učiteľ bol (aby po obnovení stránky F5 ostal na mieste) =====
// sessionStorage je ako localStorage, ale platí len pre túto kartu prehliadača
// a po jej zatvorení sa samo vymaže.
function zapamataj(kluc, hodnota) {
  try {
    if (hodnota === null) sessionStorage.removeItem("desatPrstov.admin." + kluc);
    else sessionStorage.setItem("desatPrstov.admin." + kluc, hodnota);
  } catch (chyba) {}
}

function spomen(kluc) {
  try {
    return sessionStorage.getItem("desatPrstov.admin." + kluc);
  } catch (chyba) {
    return null;
  }
}

// Porovnávanie podľa slovenskej abecedy (Č za C, Š za S…) a čísel (5.A pred 10.A)
const podlaAbecedy = (a, b) => a.localeCompare(b, "sk", { numeric: true });


// ===== Hlásenia =====
let casovacHlasky = null;

function ukazHlasku(text, jeChyba = false) {
  const el = $("hlaska");
  el.textContent = text;
  el.classList.toggle("chyba", jeChyba);
  el.classList.remove("skryty");
  clearTimeout(casovacHlasky);
  casovacHlasky = setTimeout(() => el.classList.add("skryty"), jeChyba ? 8000 : 3000);
}

// Prevedie chybu z databázy na zrozumiteľnú vetu
function popisChyby(chyba) {
  if (chyba.code === "23505") return "Taký záznam už existuje.";
  if (chyba.code === "23514") return "Údaj má nesprávnu dĺžku (napr. prázdny alebo príliš dlhý názov).";
  if (chyba.code === "42501") return "Na túto akciu nemáš oprávnenie.";
  return "Chyba: " + (chyba.message || "neznáma chyba");
}

// Počas čakania na databázu tlačidlo vypneme, aby sa nedalo kliknúť dvakrát
async function sTlacidlom(tlacidlo, akcia) {
  if (tlacidlo) tlacidlo.disabled = true;
  try {
    await akcia();
  } finally {
    if (tlacidlo) tlacidlo.disabled = false;
  }
}


// ===== Prihlásenie a odhlásenie =====
async function zobrazPodlaPrihlasenia() {
  const { data } = await db.auth.getSession();
  const prihlaseny = data.session !== null;

  $("prihlasenie").classList.toggle("skryty", prihlaseny);
  $("aplikacia").classList.toggle("skryty", !prihlaseny);

  if (prihlaseny) {
    $("kto").textContent = data.session.user.email;
    prepniZalozku(spomen("zalozka") || "vysledky"); // záložka pred obnovením stránky
    await nacitajDlzky(); // dlzky-admin.js
    await nacitajTriedy();
  }
}

$("prihlasenieForm").addEventListener("submit", (udalost) => {
  udalost.preventDefault(); // formulár by inak znovu načítal stránku
  sTlacidlom(udalost.submitter, async () => {
    $("prihlasenieChyba").textContent = "";
    const { error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("heslo").value,
    });
    if (error) {
      $("prihlasenieChyba").textContent =
        error.message === "Invalid login credentials" ? "Nesprávny e-mail alebo heslo." : error.message;
      return;
    }
    $("heslo").value = "";
    await zobrazPodlaPrihlasenia();
  });
});

$("odhlasit").addEventListener("click", async () => {
  await db.auth.signOut();
  triedy = [];
  ziaci = [];
  vybranaTrieda = null;
  for (const kluc of ["trieda", "zalozka", "ziak"]) zapamataj(kluc, null);
  await zobrazPodlaPrihlasenia();
});


// ===== Triedy =====
async function nacitajTriedy() {
  // "ziaci(count)" pridá ku každej triede počet jej žiakov
  const { data, error } = await db.from("triedy").select("id, nazov, rocnik, pismeno, ziaci(count)");
  if (error) return ukazHlasku(popisChyby(error), true);

  // Radenie podľa ročníka, potom písmena; triedy bez ročníka na koniec
  triedy = data.sort((a, b) =>
    (a.rocnik ?? 99) - (b.rocnik ?? 99) || podlaAbecedy(a.nazov, b.nazov));

  // Vybraná trieda: tá doterajšia, alebo zapamätaná pred obnovením stránky.
  // Ak medzitým zmizla (bola zmazaná), výber sa zruší.
  const idTriedy = vybranaTrieda ? vybranaTrieda.id : spomen("trieda");
  vybranaTrieda = triedy.find((t) => t.id === idTriedy) || null;
  vykresliTriedy();
  await vykresliDetail();
}

function vykresliTriedy() {
  const zoznam = $("zoznamTried");
  zoznam.innerHTML = "";
  $("ziadneTriedy").classList.toggle("skryty", triedy.length > 0);

  for (const trieda of triedy) {
    const li = document.createElement("li");
    if (vybranaTrieda && trieda.id === vybranaTrieda.id) li.classList.add("vybrana");

    const nazov = document.createElement("span");
    nazov.textContent = trieda.nazov;
    if (trieda.rocnik === null) {
      // Stará trieda, z ktorej názvu sa ročník nedal zistiť
      const upozornenie = document.createElement("span");
      upozornenie.className = "upozornenie";
      upozornenie.textContent = " · doplň ročník";
      nazov.appendChild(upozornenie);
    }
    const pocet = document.createElement("span");
    pocet.className = "sivy";
    pocet.textContent = trieda.ziaci[0].count + " ž.";

    li.append(nazov, pocet);
    li.addEventListener("click", async () => {
      vybranaTrieda = trieda;
      zapamataj("trieda", trieda.id);
      vykresliTriedy();
      await vykresliDetail();
    });
    zoznam.appendChild(li);
  }
}

// Z ročníka a písmena poskladá údaje triedy: (5, "d") → { rocnik: 5, pismeno: "D", nazov: "5.D" }
function udajeTriedy(rocnik, pismeno) {
  pismeno = pismeno.trim().toUpperCase();
  return { rocnik, pismeno, nazov: `${rocnik}.${pismeno}` };
}

// Písmeno triedy: 1 až 3 písmená bez diakritiky (A, B, AJ…)
const jeSpravnePismeno = (p) => /^[A-Za-z]{1,3}$/.test(p.trim());

$("novaTriedaForm").addEventListener("submit", (udalost) => {
  udalost.preventDefault();
  sTlacidlom(udalost.submitter, async () => {
    const rocnik = Number($("novyRocnik").value);
    if (!rocnik) return ukazHlasku("Vyber ročník.", true);
    if (!jeSpravnePismeno($("novePismeno").value)) {
      return ukazHlasku("Písmeno triedy musí byť 1 až 3 písmená bez diakritiky, napr. A.", true);
    }
    const nova = udajeTriedy(rocnik, $("novePismeno").value);
    if (triedy.some((t) => t.nazov === nova.nazov)) {
      return ukazHlasku(`Trieda ${nova.nazov} už existuje.`, true);
    }

    // .select().single() vráti práve vytvorenú triedu (aj s jej id)
    const { data, error } = await db.from("triedy").insert(nova).select().single();
    if (error) return ukazHlasku(popisChyby(error), true);

    $("novePismeno").value = "";
    vybranaTrieda = data;
    zapamataj("trieda", data.id);
    ukazHlasku(`Trieda ${nova.nazov} bola vytvorená.`);
    await nacitajTriedy();
  });
});

$("premenovatTriedu").addEventListener("click", async () => {
  const odpoved = prompt(
    "Zadaj ročník a písmeno triedy, napríklad 6.D:",
    vybranaTrieda.rocnik ? vybranaTrieda.nazov : ""
  );
  if (odpoved === null) return;

  // "6.D", "6D" aj "6 d" → ročník 6, písmeno D
  const zhoda = odpoved.trim().match(/^([1-9])\s*\.?\s*([A-Za-z]{1,3})$/);
  if (!zhoda) return ukazHlasku("Zadaj ročník 1 až 9 a písmeno, napríklad 6.D.", true);

  const zmena = udajeTriedy(Number(zhoda[1]), zhoda[2]);
  if (triedy.some((t) => t.nazov === zmena.nazov && t.id !== vybranaTrieda.id)) {
    return ukazHlasku(`Trieda ${zmena.nazov} už existuje.`, true);
  }
  const { error } = await db.from("triedy").update(zmena).eq("id", vybranaTrieda.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku(`Trieda je teraz ${zmena.nazov}.`);
  await nacitajTriedy();
});

$("zmazatTriedu").addEventListener("click", async () => {
  // Mazanie triedy zmaže aj žiakov a ich výsledky, preto chceme potvrdenie názvom
  const odpoved = prompt(
    `Zmazaním triedy ${vybranaTrieda.nazov} sa zmažú aj všetci jej žiaci (${ziaci.length}) ` +
    `a všetky ich výsledky. Toto sa nedá vrátiť.\n\nNa potvrdenie napíš názov triedy:`
  );
  if (odpoved === null) return;
  if (odpoved.trim() !== vybranaTrieda.nazov) {
    return ukazHlasku("Názov sa nezhoduje, trieda nebola zmazaná.", true);
  }

  const { error } = await db.from("triedy").delete().eq("id", vybranaTrieda.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku(`Trieda ${vybranaTrieda.nazov} bola zmazaná.`);
  vybranaTrieda = null;
  zapamataj("trieda", null);
  await nacitajTriedy();
});


// ===== Žiaci vybranej triedy =====
async function vykresliDetail() {
  $("vyberTriedu").classList.toggle("skryty", vybranaTrieda !== null);
  $("detailTriedy").classList.toggle("skryty", vybranaTrieda === null);
  if (!vybranaTrieda) return;

  $("nazovTriedy").textContent = vybranaTrieda.nazov;
  await nacitajZiakov();
  if (ziaci.length === 0) prepniZalozku("spravaZiakov"); // prázdna trieda: rovno pridávanie žiakov
  await nacitajVysledkyTriedy(); // vysledky-admin.js
  await nacitajTexty();          // texty-admin.js
}

// ===== Záložky Výsledky / Žiaci a kódy =====
function prepniZalozku(nazov) {
  for (const t of document.querySelectorAll(".zalozky button")) {
    t.classList.toggle("aktivny", t.dataset.zalozka === nazov);
  }
  for (const z of ["vysledky", "spravaZiakov", "texty"]) {
    $("zalozka-" + z).classList.toggle("skryty", nazov !== z);
  }
  zapamataj("zalozka", nazov);
}

for (const t of document.querySelectorAll(".zalozky button")) {
  t.addEventListener("click", () => prepniZalozku(t.dataset.zalozka));
}

async function nacitajZiakov() {
  const { data, error } = await db
    .from("ziaci")
    .select("id, meno, kod, aktivny")
    .eq("trieda_id", vybranaTrieda.id);
  if (error) return ukazHlasku(popisChyby(error), true);

  ziaci = data.sort((a, b) => podlaAbecedy(a.meno, b.meno));
  vykresliZiakov();
}

function vykresliZiakov() {
  const telo = $("zoznamZiakov");
  telo.innerHTML = "";
  $("ziadniZiaci").classList.toggle("skryty", ziaci.length > 0);

  for (const ziak of ziaci) {
    const tr = document.createElement("tr");
    if (!ziak.aktivny) tr.classList.add("vypnuty");

    const meno = document.createElement("td");
    meno.textContent = ziak.meno;

    const kod = document.createElement("td");
    kod.className = "kod";
    kod.textContent = ziak.kod;

    const stav = document.createElement("td");
    stav.textContent = ziak.aktivny ? "aktívny" : "vypnutý";

    const akcie = document.createElement("td");
    akcie.className = "akcie";
    akcie.append(
      tlacidlo("Nový kód", "druhotne", () => novyKod(ziak)),
      tlacidlo(ziak.aktivny ? "Vypnúť" : "Zapnúť", "druhotne", () => prepniAktivny(ziak)),
      tlacidlo("Zmazať", "nebezpecne", () => zmazZiaka(ziak)),
    );

    tr.append(meno, kod, stav, akcie);
    telo.appendChild(tr);
  }
}

// Vytvorí malé tlačidlo s textom, ktoré po kliknutí spustí akciu
function tlacidlo(text, trieda, akcia) {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = trieda + " male";
  b.addEventListener("click", () => sTlacidlom(b, akcia));
  return b;
}

$("noviZiaciForm").addEventListener("submit", (udalost) => {
  udalost.preventDefault();
  sTlacidlom(udalost.submitter, async () => {
    // Každý riadok je jeden žiak; prázdne riadky a nadbytočné medzery vynecháme
    const mena = $("noviZiaci").value
      .split("\n")
      .map((m) => m.trim().replace(/\s+/g, " "))
      .filter((m) => m.length > 0);
    const jedinecne = [...new Set(mena)];

    if (jedinecne.length === 0) return ukazHlasku("Napíš aspoň jedno meno.", true);
    const dlhe = jedinecne.find((m) => m.length > MAX_DLZKA_MENA);
    if (dlhe) return ukazHlasku(`Meno „${dlhe.slice(0, 30)}…“ je príliš dlhé (najviac ${MAX_DLZKA_MENA} znakov).`, true);

    const uzSu = jedinecne.filter((m) => ziaci.some((z) => z.meno === m));
    if (uzSu.length > 0) {
      const pokracovat = confirm(`V triede už sú: ${uzSu.join(", ")}.\nPridať ich aj tak ešte raz?`);
      if (!pokracovat) return;
    }

    const novi = jedinecne.map((meno) => ({ trieda_id: vybranaTrieda.id, meno }));
    const { error } = await db.from("ziaci").insert(novi);
    if (error) return ukazHlasku(popisChyby(error), true);

    $("noviZiaci").value = "";
    ukazHlasku(jedinecne.length === 1 ? "Žiak bol pridaný." : `Pridaných žiakov: ${jedinecne.length}.`);
    await nacitajTriedy(); // obnoví počty v zozname tried aj žiakov
  });
});

async function novyKod(ziak) {
  const pokracovat = confirm(
    `Vygenerovať nový kód pre ${ziak.meno}?\nStarý kód prestane fungovať a žiak sa bude musieť prihlásiť novým.`
  );
  if (!pokracovat) return;

  // rpc = zavolanie funkcie v databáze (vygeneruj_novy_kod zo schema.sql)
  const { error } = await db.rpc("vygeneruj_novy_kod", { p_ziak_id: ziak.id });
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku(`${ziak.meno} má nový kód.`);
  await nacitajZiakov();
}

async function prepniAktivny(ziak) {
  const { error } = await db.from("ziaci").update({ aktivny: !ziak.aktivny }).eq("id", ziak.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku(ziak.aktivny
    ? `${ziak.meno} je vypnutý: kód nefunguje, výsledky ostávajú.`
    : `${ziak.meno} je znova aktívny.`);
  await nacitajZiakov();
}

async function zmazZiaka(ziak) {
  const pokracovat = confirm(
    `Naozaj zmazať žiaka ${ziak.meno}?\nZmažú sa aj všetky jeho výsledky. Toto sa nedá vrátiť.\n\n` +
    `(Ak ho chceš len dočasne zablokovať, použi radšej „Vypnúť“.)`
  );
  if (!pokracovat) return;

  const { error } = await db.from("ziaci").delete().eq("id", ziak.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku(`${ziak.meno} bol zmazaný.`);
  await nacitajTriedy();
}


// ===== Tlač kartičiek s kódmi =====
$("tlacitKarticky").addEventListener("click", () => {
  const aktivni = ziaci.filter((z) => z.aktivny);
  if (aktivni.length === 0) return ukazHlasku("V triede nie sú žiadni aktívni žiaci.", true);

  const karticky = $("karticky");
  karticky.innerHTML = "";
  for (const ziak of aktivni) {
    const k = document.createElement("div");
    k.className = "karticka";
    for (const [trieda, text] of [
      ["app", "Desať Prstov – písanie všetkými desiatimi"],
      ["meno", ziak.meno],
      ["trieda", "Trieda " + vybranaTrieda.nazov],
      ["kod", ziak.kod],
      ["adresa", ADRESA_APLIKACIE],
    ]) {
      const riadok = document.createElement("div");
      riadok.className = trieda;
      riadok.textContent = text;
      k.appendChild(riadok);
    }
    karticky.appendChild(k);
  }
  window.print(); // otvorí okno tlače; na obrazovke sú kartičky skryté
});


// ===== Štart =====
// Spustíme až po načítaní VŠETKÝCH skriptov stránky (DOMContentLoaded).
// Inak by prihlásený učiteľ po obnovení stránky (F5) volal funkcie
// zo súborov, ktoré sa ešte nenačítali (napr. dlzky-admin.js).
document.addEventListener("DOMContentLoaded", zobrazPodlaPrihlasenia);
