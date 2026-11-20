// ===== Graf rýchlosti a presnosti =====
// Graf kreslí knižnica Chart.js (súbor chart.umd.min.js).
// My jej len pripravíme dáta a povieme, ako má graf vyzerať.
// Návod a príklady: https://www.chartjs.org/docs/latest/

const POCET_V_GRAFE = 30;   // koľko posledných pokusov ukázať
const VYHLADENIE = 5;       // z koľkých pokusov počítať priemernú čiaru
const CIEL_PRESNOSTI = 95;  // čiara cieľa v grafe presnosti (%)

let graf = null;              // tu si pamätáme vytvorený graf
let zobrazenie = "rychlost";  // čo graf práve ukazuje: "rychlost" alebo "presnost"

// Nastavenia pre oba druhy grafu. Podľa premennej zobrazenie vyberieme jedno z nich.
// (Podobne ako slovník slovníkov v Pythone.)
const DRUHY_GRAFU = {
  rychlost: {
    nazov: "Rýchlosť",
    os: "slov za minútu",
    jednotka: " sl./min",
    farbaBodov: "#6b8fc2",
    farbaCiary: "#a9bcd6",
    // čiara rekordu: najvyššia rýchlosť zo všetkých pokusov
    vodorovnaCiara: (vsetky) => ({
      nazov: "Rekord",
      hodnota: Math.max(...vsetky.map((v) => v.rychlost)),
    }),
    // os Y od nuly
    rozsahY: () => ({ min: 0 }),
    // čo ešte ukázať v bubline
    doplnok: (v) => `Presnosť: ${v.presnost} %`,
  },
  presnost: {
    nazov: "Presnosť",
    os: "presnosť (%)",
    jednotka: " %",
    farbaBodov: "#b07acc",
    farbaCiary: "#d5bce3",
    vodorovnaCiara: () => ({ nazov: `Cieľ ${CIEL_PRESNOSTI} %`, hodnota: CIEL_PRESNOSTI }),
    // presnosť býva medzi 80 a 100 %, preto os nezačína od nuly,
    // inak by boli všetky body natlačené hore
    rozsahY: (hodnoty) => ({
      min: Math.max(0, Math.min(90, Math.floor((Math.min(...hodnoty) - 2) / 5) * 5)),
      max: 100,
    }),
    doplnok: (v) => `Rýchlosť: ${v.rychlost} sl./min`,
  },
};

// Kĺzavý priemer: pre každý bod priemer z neho a 4 predchádzajúcich
function klzavyPriemer(cisla, okno) {
  return cisla.map((_, i) => {
    const kusok = cisla.slice(Math.max(0, i - okno + 1), i + 1);
    const sucet = kusok.reduce((s, c) => s + c, 0);
    return Math.round((sucet / kusok.length) * 10) / 10; // na 1 desatinné miesto
  });
}

function vykresliGraf(vsetky) {
  const kontajner = document.getElementById("grafKontajner");

  // Graf má zmysel až od 2 pokusov (a len ak sa knižnica načítala)
  const zobrazit = vsetky.length >= 2 && typeof Chart !== "undefined";
  kontajner.classList.toggle("skryty", !zobrazit);
  if (!zobrazit) return;

  const druh = DRUHY_GRAFU[zobrazenie];
  const vysledky = vsetky.slice(-POCET_V_GRAFE);
  const posun = vsetky.length - vysledky.length;

  // Dáta pre graf
  const popisky = vysledky.map((_, i) => posun + i + 1);   // číslo pokusu
  const hodnoty = vysledky.map((v) => v[zobrazenie]);      // v["rychlost"] alebo v["presnost"]
  const priemer = klzavyPriemer(hodnoty, VYHLADENIE);
  const ciara = druh.vodorovnaCiara(vsetky);

  // Starý graf zrušíme a nakreslíme nový (najjednoduchšie)
  if (graf) graf.destroy();

  graf = new Chart(document.getElementById("graf"), {
    type: "line",
    data: {
      labels: popisky,
      datasets: [
        {
          label: druh.nazov,
          data: hodnoty,
          borderColor: druh.farbaCiary,
          backgroundColor: druh.farbaBodov,
          borderWidth: 1.5,
          pointRadius: 4,
        },
        {
          label: `Priemer posledných ${VYHLADENIE}`,
          data: priemer,
          borderColor: "#2a8a3e",
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.3, // zaoblenie čiary
        },
        {
          label: ciara.nazov,
          data: popisky.map(() => ciara.hodnota), // rovnaká hodnota všade = vodorovná čiara
          borderColor: "#d9443b",
          borderWidth: 1.5,
          borderDash: [6, 6],                     // prerušovaná čiara
          pointRadius: 0,
          pointHoverRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: "index", intersect: false }, // bublina pri prejdení myšou
      scales: {
        x: { title: { display: true, text: "pokus" } },
        y: { ...druh.rozsahY(hodnoty), title: { display: true, text: druh.os } },
      },
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          filter: (polozka) => polozka.datasetIndex !== 2, // vodorovnú čiaru v bubline netreba
          callbacks: {
            title: (polozky) => {
              const v = vysledky[polozky[0].dataIndex];
              return `Pokus ${polozky[0].label} – ${formatujDatum(v.datum)}`;
            },
            // 35.8 → "35,8" (slovenská desatinná čiarka)
            label: (polozka) =>
              `${polozka.dataset.label}: ${polozka.parsed.y.toLocaleString("sk-SK")}${druh.jednotka}`,
            afterBody: (polozky) => druh.doplnok(vysledky[polozky[0].dataIndex]),
          },
        },
      },
    },
  });
}

// ===== Prepínač Rýchlosť / Presnosť =====
// Každé tlačidlo má v HTML atribút data-zobrazenie="rychlost" alebo "presnost".
for (const tlacidlo of document.querySelectorAll(".prepinac button")) {
  tlacidlo.addEventListener("click", () => {
    zobrazenie = tlacidlo.dataset.zobrazenie;

    // Aktívne tlačidlo zvýrazníme, ostatné nie
    for (const t of document.querySelectorAll(".prepinac button")) {
      t.classList.toggle("aktivny", t === tlacidlo);
    }
    vykresliGraf(nacitajVysledky());
  });
}
