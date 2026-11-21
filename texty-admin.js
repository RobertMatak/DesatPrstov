// ===== Texty pre triedy (učiteľ) =====
// Text môže byť pre jednu triedu (trieda_id = id triedy)
// alebo pre všetky triedy učiteľa (trieda_id = null).
// Pravidlá v databáze zaručujú, že učiteľ vidí a mení len svoje texty.

const MIN_DLZKA_TEXTU = 20;    // kratší text nemá na precvičovanie zmysel
const MAX_DLZKA_TEXTU = 1500;  // dlhší by sa písal príliš dlho

let textyTriedy = []; // texty, ktoré vidí vybraná trieda

// Upraví vložený text tak, aby sa dal písať na klávesnici:
// typografické úvodzovky a pomlčky z kníh a webu nahradí obyčajnými,
// nové riadky a viac medzier za sebou nahradí jednou medzerou.
function vycistiText(text) {
  return text
    .normalize("NFC")
    .replace(/[„“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")  // \s = medzera, tabulátor, nový riadok…
    .trim();
}

// Vráti znaky, ktoré sa na slovenskej klávesnici nedajú napísať
function nepodporovaneZnaky(text) {
  const zle = Array.from(text).filter((znak) => krokyPreZnak(znak).length === 0); // klavesnica.js
  return [...new Set(zle)]; // Set odstráni duplikáty, ako set() v Pythone
}

async function nacitajTexty() {
  $("nazovTriedyTexty").textContent = vybranaTrieda.nazov;

  // Všetky texty učiteľa; pre túto triedu vyberieme jej vlastné a tie „pre všetky“
  const { data, error } = await db.from("texty").select("id, trieda_id, text, vytvorene").order("vytvorene");
  if (error) return ukazHlasku(popisChyby(error), true);

  textyTriedy = data.filter((t) => t.trieda_id === null || t.trieda_id === vybranaTrieda.id);
  vykresliTexty();
}

function vykresliTexty() {
  const zoznam = $("zoznamTextov");
  zoznam.innerHTML = "";
  $("ziadneTexty").classList.toggle("skryty", textyTriedy.length > 0);
  $("pocetTextov").textContent = textyTriedy.length > 0 ? `(${textyTriedy.length})` : "";

  for (const t of textyTriedy) {
    const li = document.createElement("li");

    const nahlad = document.createElement("span");
    nahlad.className = "nahlad";
    nahlad.textContent = t.text.length > 110 ? t.text.slice(0, 110) + "…" : t.text;
    nahlad.title = t.text; // celý text po prejdení myšou

    const znacka = document.createElement("span");
    znacka.className = "znacka" + (t.trieda_id === null ? " vsetky" : "");
    znacka.textContent = t.trieda_id === null ? "všetky triedy" : "len " + vybranaTrieda.nazov;

    li.append(nahlad, znacka, tlacidlo("Zmazať", "nebezpecne", () => zmazText(t))); // tlacidlo je z admin.js
    zoznam.appendChild(li);
  }
}

$("pridatText").addEventListener("click", () => {
  sTlacidlom($("pridatText"), async () => {
    const text = vycistiText($("novyText").value);

    if (text.length < MIN_DLZKA_TEXTU) {
      return ukazHlasku(`Text je príliš krátky (aspoň ${MIN_DLZKA_TEXTU} znakov).`, true);
    }
    if (text.length > MAX_DLZKA_TEXTU) {
      return ukazHlasku(`Text je príliš dlhý: má ${text.length} znakov, najviac môže mať ${MAX_DLZKA_TEXTU}.`, true);
    }
    const zle = nepodporovaneZnaky(text);
    if (zle.length > 0) {
      return ukazHlasku(`Tieto znaky sa nedajú napísať na slovenskej klávesnici, oprav ich: ${zle.join("  ")}`, true);
    }
    if (textyTriedy.some((t) => t.text === text)) {
      return ukazHlasku("Tento text už trieda má.", true);
    }

    const preVsetky = document.querySelector("input[name=komuText]:checked").value === "vsetky";
    const { error } = await db.from("texty").insert({
      text,
      trieda_id: preVsetky ? null : vybranaTrieda.id,
    });
    if (error) return ukazHlasku(popisChyby(error), true);

    $("novyText").value = "";
    ukazHlasku(preVsetky ? "Text bol pridaný pre všetky tvoje triedy." : `Text bol pridaný pre triedu ${vybranaTrieda.nazov}.`);
    await nacitajTexty();
  });
});

async function zmazText(t) {
  const upozornenie = t.trieda_id === null
    ? "Tento text je pre VŠETKY tvoje triedy, zmizne zo všetkých."
    : `Text zmizne z triedy ${vybranaTrieda.nazov}.`;
  if (!confirm(`Zmazať text „${t.text.slice(0, 60)}…“?\n${upozornenie}\nVýsledky žiakov ostanú.`)) return;

  const { error } = await db.from("texty").delete().eq("id", t.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku("Text bol zmazaný.");
  await nacitajTexty();
}
