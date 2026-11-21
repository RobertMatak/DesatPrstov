// ===== Knihy a kapitoly (učiteľ) =====
// Kniha patrí jednej triede (trieda_id) alebo všetkým triedam učiteľa (null).
// Kapitoly majú poradie (0, 1, 2…), v ktorom ich žiaci píšu.
// Pravidlá v databáze zaručujú, že učiteľ vidí a mení len svoje knihy.

let knihy = [];          // knihy, ktoré vidí vybraná trieda
let vybranaKniha = null; // otvorená kniha (null = zoznam kníh)
let kapitoly = [];       // kapitoly otvorenej knihy v poradí

// Text pre všetky polia „jeden riadok“: orezať medzery, prázdne → null
const riadokAleboNull = (text) => text.trim().replace(/\s+/g, " ") || null;

async function nacitajKnihy() {
  $("nazovTriedyKnihy").textContent = vybranaTrieda.nazov;

  // "kapitoly(count)" pridá ku každej knihe počet jej kapitol
  const { data, error } = await db
    .from("knihy")
    .select("id, trieda_id, nazov, autor, zdroj, vytvorene, kapitoly(count)")
    .order("vytvorene");
  if (error) return ukazHlasku(popisChyby(error), true);

  knihy = data.filter((k) => k.trieda_id === null || k.trieda_id === vybranaTrieda.id);

  // Otvorená kniha: doterajšia, alebo zapamätaná pred obnovením stránky (admin.js)
  const idKnihy = vybranaKniha ? vybranaKniha.id : spomen("kniha");
  vybranaKniha = knihy.find((k) => k.id === idKnihy) || null;

  if (vybranaKniha) await otvorKnihu(vybranaKniha);
  else ukazZoznamKnih();
}


// ===== Zoznam kníh =====
function ukazZoznamKnih() {
  $("zoznamKnihPohlad").classList.remove("skryty");
  $("detailKnihyPohlad").classList.add("skryty");

  const zoznam = $("zoznamKnih");
  zoznam.innerHTML = "";
  $("ziadneKnihy").classList.toggle("skryty", knihy.length > 0);

  for (const k of knihy) {
    const li = document.createElement("li");

    const nahlad = document.createElement("span");
    nahlad.className = "nahlad";
    const nazov = document.createElement("span");
    nazov.className = "nazov-textu";
    nazov.textContent = k.nazov;
    nahlad.appendChild(nazov);
    const pocet = k.kapitoly[0].count;
    nahlad.appendChild(document.createTextNode(
      [k.autor, `${pocet} ${pocet === 1 ? "kapitola" : pocet >= 2 && pocet <= 4 ? "kapitoly" : "kapitol"}`]
        .filter((x) => x).join(" · ")));

    const znacka = document.createElement("span");
    znacka.className = "znacka" + (k.trieda_id === null ? " vsetky" : "");
    znacka.textContent = k.trieda_id === null ? "všetky triedy" : "len " + vybranaTrieda.nazov;

    li.append(nahlad, znacka, tlacidlo("Otvoriť", "druhotne", () => otvorKnihu(k))); // tlacidlo je z admin.js
    zoznam.appendChild(li);
  }
}

$("pridatKnihu").addEventListener("click", () => {
  sTlacidlom($("pridatKnihu"), async () => {
    const nazov = riadokAleboNull($("nazovKnihy").value);
    if (!nazov) return ukazHlasku("Napíš názov knihy.", true);
    if (knihy.some((k) => k.nazov === nazov)) return ukazHlasku(`Kniha „${nazov}“ už existuje.`, true);

    const preVsetky = document.querySelector("input[name=komuKniha]:checked").value === "vsetky";
    const { data, error } = await db.from("knihy").insert({
      nazov,
      autor: riadokAleboNull($("autorKnihy").value),
      zdroj: riadokAleboNull($("zdrojKnihy").value),
      trieda_id: preVsetky ? null : vybranaTrieda.id,
    }).select().single();
    if (error) return ukazHlasku(popisChyby(error), true);

    for (const id of ["nazovKnihy", "autorKnihy", "zdrojKnihy"]) $(id).value = "";
    ukazHlasku(`Kniha „${nazov}“ je vytvorená. Teraz do nej pridaj kapitoly.`);
    vybranaKniha = data;
    await nacitajKnihy(); // otvorí novú knihu
  });
});


// ===== Otvorená kniha =====
async function otvorKnihu(kniha) {
  vybranaKniha = kniha;
  zapamataj("kniha", kniha.id); // admin.js

  const { data, error } = await db
    .from("kapitoly")
    .select("id, poradie, nazov, text, vytvorene")
    .eq("kniha_id", kniha.id)
    .order("poradie")
    .order("vytvorene");
  if (error) return ukazHlasku(popisChyby(error), true);
  kapitoly = data;

  $("zoznamKnihPohlad").classList.add("skryty");
  $("detailKnihyPohlad").classList.remove("skryty");
  $("nazovVybranejKnihy").textContent = kniha.nazov;
  const pre = kniha.trieda_id === null ? "pre všetky tvoje triedy" : "len pre " + vybranaTrieda.nazov;
  $("popisVybranejKnihy").textContent =
    [kniha.autor, kniha.zdroj ? "zdroj: " + kniha.zdroj : "zdroj nie je uvedený", pre].filter((x) => x).join(" · ");
  vykresliKapitoly();
}

function vykresliKapitoly() {
  const zoznam = $("zoznamKapitol");
  zoznam.innerHTML = "";
  $("ziadneKapitoly").classList.toggle("skryty", kapitoly.length > 0);

  kapitoly.forEach((kap, i) => {
    const li = document.createElement("li");

    const nahlad = document.createElement("span");
    nahlad.className = "nahlad";
    const nazov = document.createElement("span");
    nazov.className = "nazov-textu";
    nazov.textContent = `${i + 1}. ${kap.nazov || "Kapitola " + (i + 1)}`;
    nahlad.appendChild(nazov);
    nahlad.appendChild(document.createTextNode(`(${pocetSlov(kap.text)} slov)`)); // pocetSlov je z texty-admin.js
    nahlad.title = kap.text.slice(0, 1000);

    const hore = tlacidlo("↑", "druhotne", () => posunKapitolu(i, -1));
    const dole = tlacidlo("↓", "druhotne", () => posunKapitolu(i, +1));
    hore.disabled = i === 0;
    dole.disabled = i === kapitoly.length - 1;
    hore.title = "Posunúť vyššie";
    dole.title = "Posunúť nižšie";

    li.append(nahlad, hore, dole,
      tlacidlo("Premenovať", "druhotne", () => premenujKapitolu(kap)),
      tlacidlo("Zmazať", "nebezpecne", () => zmazKapitolu(kap)));
    zoznam.appendChild(li);
  });
}

$("spatNaKnihy").addEventListener("click", () => {
  vybranaKniha = null;
  zapamataj("kniha", null);
  nacitajKnihy();
});

$("upravitKnihu").addEventListener("click", async () => {
  const k = vybranaKniha;
  const nazov = prompt("Názov knihy:", k.nazov);
  if (nazov === null) return;
  if (!nazov.trim()) return ukazHlasku("Názov knihy nemôže byť prázdny.", true);
  const autor = prompt("Autor (nechaj prázdne, ak nie je):", k.autor || "");
  if (autor === null) return;
  const zdroj = prompt("Zdroj: kniha, vydanie alebo webová adresa:", k.zdroj || "");
  if (zdroj === null) return;

  const { error } = await db.from("knihy").update({
    nazov: riadokAleboNull(nazov).slice(0, 100),
    autor: (riadokAleboNull(autor) || "").slice(0, 100) || null,
    zdroj: (riadokAleboNull(zdroj) || "").slice(0, 300) || null,
  }).eq("id", k.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku("Kniha bola upravená.");
  await nacitajKnihy();
});

$("zmazatKnihu").addEventListener("click", async () => {
  const k = vybranaKniha;
  if (!confirm(`Zmazať knihu „${k.nazov}“ so všetkými kapitolami (${kapitoly.length})?\n` +
               "Zmaže sa aj postup žiakov v nej. Ich výsledky ostanú. Toto sa nedá vrátiť.")) return;

  const { error } = await db.from("knihy").delete().eq("id", k.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku(`Kniha „${k.nazov}“ bola zmazaná.`);
  vybranaKniha = null;
  zapamataj("kniha", null);
  await nacitajKnihy();
});


// ===== Kapitoly =====
$("pridatKapitolu").addEventListener("click", () => {
  sTlacidlom($("pridatKapitolu"), async () => {
    const text = vycistiText($("textKapitoly").value); // texty-admin.js

    if (text.length < MIN_DLZKA_TEXTU) {
      return ukazHlasku(`Kapitola je príliš krátka (aspoň ${MIN_DLZKA_TEXTU} znakov).`, true);
    }
    if (text.length > MAX_DLZKA_TEXTU) {
      return ukazHlasku(`Kapitola je príliš dlhá: má ${text.length} znakov, najviac môže mať ${MAX_DLZKA_TEXTU}. Rozdeľ ju na dve.`, true);
    }
    const zle = nepodporovaneZnaky(text); // texty-admin.js
    if (zle.length > 0) {
      return ukazHlasku(`Tieto znaky sa nedajú napísať na slovenskej klávesnici, oprav ich: ${zle.join("  ")}`, true);
    }

    // Nová kapitola ide na koniec knihy
    const poradie = kapitoly.length > 0 ? Math.max(...kapitoly.map((k) => k.poradie)) + 1 : 0;
    const { error } = await db.from("kapitoly").insert({
      kniha_id: vybranaKniha.id,
      poradie,
      nazov: riadokAleboNull($("nazovKapitoly").value),
      text,
    });
    if (error) return ukazHlasku(popisChyby(error), true);

    $("nazovKapitoly").value = "";
    $("textKapitoly").value = "";
    ukazHlasku(`Kapitola ${kapitoly.length + 1} bola pridaná.`);
    await otvorKnihu(vybranaKniha);
  });
});

// Posunie kapitolu vyššie (smer -1) alebo nižšie (+1) a prečísluje poradie 0, 1, 2…
async function posunKapitolu(index, smer) {
  const nove = [...kapitoly];
  const [kap] = nove.splice(index, 1);
  nove.splice(index + smer, 0, kap);

  for (let i = 0; i < nove.length; i++) {
    if (nove[i].poradie === i) continue; // túto netreba meniť
    const { error } = await db.from("kapitoly").update({ poradie: i }).eq("id", nove[i].id);
    if (error) return ukazHlasku(popisChyby(error), true);
  }
  await otvorKnihu(vybranaKniha);
}

async function premenujKapitolu(kap) {
  const nazov = prompt("Názov kapitoly (nechaj prázdne pre „Kapitola 1, 2…“):", kap.nazov || "");
  if (nazov === null) return;
  const { error } = await db.from("kapitoly")
    .update({ nazov: (riadokAleboNull(nazov) || "").slice(0, 100) || null })
    .eq("id", kap.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  await otvorKnihu(vybranaKniha);
}

async function zmazKapitolu(kap) {
  if (!confirm(`Zmazať kapitolu „${kap.nazov || "bez názvu"}“?\nZmaže sa aj postup žiakov v nej.`)) return;
  const { error } = await db.from("kapitoly").delete().eq("id", kap.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku("Kapitola bola zmazaná.");
  await otvorKnihu(vybranaKniha);
}
