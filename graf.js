// ===== Graf rýchlosti =====
// Graf kreslí knižnica Chart.js (súbor chart.umd.min.js).
// My jej len pripravíme dáta a povieme, ako má graf vyzerať.
// Návod a príklady: https://www.chartjs.org/docs/latest/

const POCET_V_GRAFE = 30;   // koľko posledných pokusov ukázať
const VYHLADENIE = 5;       // z koľkých pokusov počítať priemernú čiaru
let graf = null;            // tu si pamätáme vytvorený graf

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

  const vysledky = vsetky.slice(-POCET_V_GRAFE);
  const posun = vsetky.length - vysledky.length;

  // Dáta pre graf
  const popisky = vysledky.map((_, i) => posun + i + 1);   // číslo pokusu
  const rychlosti = vysledky.map((v) => v.rychlost);
  const priemer = klzavyPriemer(rychlosti, VYHLADENIE);
  const rekord = Math.max(...vsetky.map((v) => v.rychlost));

  // Starý graf zrušíme a nakreslíme nový (najjednoduchšie)
  if (graf) graf.destroy();

  graf = new Chart(document.getElementById("graf"), {
    type: "line",
    data: {
      labels: popisky,
      datasets: [
        {
          label: "Rýchlosť",
          data: rychlosti,
          borderColor: "#a9bcd6",
          backgroundColor: "#6b8fc2",
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
          label: "Rekord",
          data: popisky.map(() => rekord), // rovnaká hodnota všade = vodorovná čiara
          borderColor: "#d9443b",
          borderWidth: 1.5,
          borderDash: [6, 6],             // prerušovaná čiara
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
        y: { beginAtZero: true, title: { display: true, text: "slov za minútu" } },
      },
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          filter: (polozka) => polozka.datasetIndex !== 2, // rekord v bubline netreba
          callbacks: {
            title: (polozky) => {
              const v = vysledky[polozky[0].dataIndex];
              return `Pokus ${polozky[0].label} – ${formatujDatum(v.datum)}`;
            },
            // 35.8 → "35,8" (slovenská desatinná čiarka)
            label: (polozka) =>
              `${polozka.dataset.label}: ${polozka.parsed.y.toLocaleString("sk-SK")}`,
            afterBody: (polozky) => {
              const v = vysledky[polozky[0].dataIndex];
              return `Presnosť: ${v.presnost} %`;
            },
          },
        },
      },
    },
  });
}
