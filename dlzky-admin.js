// ===== Dĺžky úryvkov podľa ročníkov =====
// Pre každý ročník 1–9 počet slov, ktorý žiak napíše v jednom úryvku.
// Ukladá sa do tabuľky dlzky_rocnikov (každý učiteľ má vlastné).
// Keď ročník nemá uloženú hodnotu, platí predvolená (rovnaká ako v databáze).

const PREDVOLENE_DLZKY = [6, 8, 10, 15, 20, 25, 30, 40, 50]; // ročníky 1. až 9.
const MIN_SLOV = 3;
const MAX_SLOV = 200;

let dlzky = [...PREDVOLENE_DLZKY]; // dlzky[0] = 1. ročník … dlzky[8] = 9. ročník

async function nacitajDlzky() {
  const { data, error } = await db.from("dlzky_rocnikov").select("rocnik, slov");
  if (error) return ukazHlasku(popisChyby(error), true);

  dlzky = [...PREDVOLENE_DLZKY];
  for (const riadok of data) dlzky[riadok.rocnik - 1] = riadok.slov;
  vykresliDlzky();
}

function vykresliDlzky() {
  const mriezka = $("dlzkyRocnikov");
  mriezka.innerHTML = "";
  dlzky.forEach((slov, i) => {
    const label = document.createElement("label");
    label.textContent = `${i + 1}.`;
    const pole = document.createElement("input");
    pole.type = "number";
    pole.min = MIN_SLOV;
    pole.max = MAX_SLOV;
    pole.value = slov;
    pole.dataset.rocnik = i + 1;
    label.appendChild(pole);
    mriezka.appendChild(label);
  });
}

// Text v záložke Texty: koľko slov píše vybraná trieda
function popisDlzkyTriedy() {
  if (!vybranaTrieda || !vybranaTrieda.rocnik) return "";
  return `Trieda ${vybranaTrieda.nazov} píše úryvky po približne ${dlzky[vybranaTrieda.rocnik - 1]} slovách.`;
}

$("ulozitDlzky").addEventListener("click", () => {
  sTlacidlom($("ulozitDlzky"), async () => {
    const polia = [...document.querySelectorAll("#dlzkyRocnikov input")];
    const nove = polia.map((p) => Number(p.value));

    if (nove.some((n) => !Number.isInteger(n) || n < MIN_SLOV || n > MAX_SLOV)) {
      return ukazHlasku(`Každá dĺžka musí byť celé číslo od ${MIN_SLOV} do ${MAX_SLOV}.`, true);
    }

    // upsert = vlož nový riadok, alebo uprav existujúci (ak už ročník má hodnotu)
    const { data: prihlasenie } = await db.auth.getSession();
    const riadky = nove.map((slov, i) => ({
      ucitel_id: prihlasenie.session.user.id,
      rocnik: i + 1,
      slov,
    }));
    const { error } = await db.from("dlzky_rocnikov").upsert(riadky);
    if (error) return ukazHlasku(popisChyby(error), true);

    dlzky = nove;
    $("dlzkaPreTriedu").textContent = popisDlzkyTriedy();
    ukazHlasku("Dĺžky úryvkov sú uložené. Žiaci ich dostanú pri ďalšom prihlásení alebo obnovení stránky.");
  });
});
