// ===== Obsah lekcií =====
// 18 lekcií: každá pridá pár nových klávesov a precvičuje ich spolu so staršími.
// Slová a vety v lekcii smú obsahovať len znaky, ktoré žiak už pozná
// (z tejto a všetkých predchádzajúcich lekcií). Funkcia povoleneZnaky() nižšie
// vráti, ktoré znaky to sú – pri pridávaní slov na to treba dávať pozor.
//
// Polia lekcie:
//   nazov  – krátky názov na dlaždici (napr. "F J")
//   nove   – nové znaky (malé písmená, interpunkcia, číslice)
//   tip    – rada pre žiaka na úvodnej obrazovke lekcie
//   typ    – (nepovinné) "shift", "znamienka" alebo "cisla" pre špeciálne lekcie
//   slova  – skutočné slová pre cvičenie Slová (od 4. lekcie)
//   vety   – vety pre cvičenie Vety (od 13. lekcie)

const LEKCIE = [
  {
    nazov: "F J",
    nove: "fj",
    tip: "Polož ukazováky na F a J, nahmatáš na nich malé výstupky. Ostatné prsty polož vedľa: ľavá ruka A S D F, pravá J K L Ô. Medzerník stláčaj palcom.",
  },
  {
    nazov: "D K",
    nove: "dk",
    tip: "D a K stláčaš prostredníkmi. Ukazováky ostávajú na F a J.",
  },
  {
    nazov: "S L",
    nove: "sl",
    tip: "S a L stláčaš prstenníkmi. Pozeraj na obrazovku, nie na klávesnicu.",
  },
  {
    nazov: "A Ô",
    nove: "aô",
    tip: "A a Ô stláčaš malíčkami. Teraz máš pod prstami celý základný rad.",
    slova: ["a", "ja", "sa", "sad", "sada", "dal", "dala", "lak", "jas", "sklad", "skala", "kasa", "fajka", "slad", "klas"],
  },
  {
    nazov: "G H",
    nove: "gh",
    tip: "Na G sa natiahne ľavý ukazovák, na H pravý. Hneď potom ich vráť na F a J.",
    slova: ["had", "hada", "hlad", "hlas", "hlasa", "hala", "haf", "gajda", "jasa", "klas", "sklad"],
  },
  {
    nazov: "E I",
    nove: "ei",
    tip: "E stláča ľavý prostredník (z D hore), I pravý prostredník (z K hore).",
    slova: ["les", "lesa", "kde", "ide", "hej", "jej", "je", "si", "aj", "ale", "ak", "deda", "sila", "ihla", "kefa",
      "kefka", "fialka", "lieska", "lieh", "sieje", "leje", "keks", "diel", "jedle", "lesk", "jasle"],
  },
  {
    nazov: "R U",
    nove: "ru",
    tip: "R stláča ľavý ukazovák (z F hore), U pravý ukazovák (z J hore).",
    slova: ["ruka", "kura", "dar", "kruh", "druh", "hra", "hrad", "jar", "rada", "rieka", "uhlie", "ruksak", "sused",
      "suseda", "rak", "sud", "drak", "kus", "rad", "riasa", "hruda", "krieda", "kraj", "ukradla"],
  },
  {
    nazov: "T Z",
    nove: "tz",
    tip: "T stláča ľavý ukazovák, Z pravý ukazovák. Na slovenskej klávesnici je Z hore vedľa T.",
    slova: ["teta", "trh", "stred", "teraz", "zajtra", "test", "tri", "zrak", "sestra", "tu", "tuk",
      "tiger", "trieda", "stretla", "letia", "zas", "slza", "tetka"],
  },
  {
    nazov: "O P",
    nove: "op",
    tip: "O stláča pravý prstenník (z L hore), P pravý malíček (z Ô hore).",
    slova: ["pes", "potok", "pole", "oko", "lopta", "papier", "posol", "doska", "torta", "hora", "lopata", "podlaha",
      "pero", "kolo", "sklo", "jeho", "toto", "hotel", "auto", "pozor", "kosa", "koza", "koleso", "orol", "dole",
      "spolu", "okolo"],
  },
  {
    nazov: "V M",
    nove: "vm",
    tip: "V stláča ľavý ukazovák (z F dole), M pravý ukazovák (z J dole).",
    slova: ["mama", "voda", "more", "dom", "strom", "vietor", "slovo", "mesto", "vlak", "most", "hrom", "mlieko",
      "polievka", "mapa", "dvere", "med", "voz", "mrkva", "slama", "zima", "mak", "domov", "veselo", "kamera",
      "metla", "tma", "ovos", "hmla"],
  },
  {
    nazov: "C N",
    nove: "cn",
    tip: "C stláča ľavý prostredník (z D dole), N pravý ukazovák (z J dole doľava).",
    slova: ["noc", "slnko", "okno", "ovca", "otec", "ulica", "kino", "sneh", "nos", "koniec", "cena", "cesta",
      "mesiac", "kniha", "princ", "cukor", "hrnec", "pondelok", "vianoce", "konvica", "tanec", "zajac", "palica",
      "lienka", "cvikla", "nikto", "ani"],
  },
  {
    nazov: "B Y X",
    nove: "byx",
    tip: "B stláča ľavý ukazovák (z F dole doprava), Y ľavý malíček (z A dole), X ľavý prstenník (z S dole).",
    slova: ["byt", "my", "vy", "ty", "by", "ryba", "jablko", "obed", "zub", "bylina", "syr", "dym", "taxi", "box",
      "mlyn", "kytica", "text", "boxer", "dobre", "obloha", "bolo", "sobota", "chyba", "kocky", "motyka", "syn",
      "mixer"],
  },
  {
    nazov: "Shift . ,",
    nove: ".,",
    typ: "shift",
    tip: "Veľké písmeno: drž Shift na druhej ruke, než je písmeno. Pre M drž ľavý Shift, pre A pravý. Bodku stláča pravý prstenník, čiarku pravý prostredník.",
    slova: ["Peter", "Eva", "Ivan", "Karol", "Zuzka", "Jano", "Lucia", "Oto", "Martin", "Bratislava", "Nitra",
      "Trnava", "Senec", "Poprad", "Dunaj", "Tatry", "Slovensko"],
    vety: [
      "Mama ide do mesta.", "Otec nesie drevo.", "Peter je doma.", "Na stole je jablko.", "Deti sedia v triede.",
      "V lese je ticho.", "Babka upiekla buchty.", "Dedko sedel na lavici.", "Jano nesie vodu.",
      "Eva nesie kvety, Ivan nesie vodu.", "Mesiac svieti v noci.", "Zajac sedel pod kopcom.", "Vonku padal sneh.",
      "Lucia kreslila more.", "Otec opravil bicykel.", "Teta Zuzka upiekla tortu.", "Pes Dunco spal pod stolom.",
      "Na oblohe svieti slnko.", "Kniha je na polici.", "Dnes idem do kina.",
    ],
  },
  {
    nazov: "Ľ Š Č Ť Ž",
    nove: "ľščťž",
    tip: "Tieto písmená sú v hornom rade nad písmenami: Ľ prstenník, Š prostredník, Č a Ť ľavý ukazovák, Ž pravý ukazovák. Po stlačení vráť prst domov.",
    slova: ["škola", "čas", "žaba", "ľad", "ťava", "ešte", "šťastie", "život", "ľudia", "žiak", "človek", "šarkan",
      "mačka", "ruža", "taška", "čiapka", "košeľa", "žltok", "čierny", "čaj", "šach", "počasie", "zošit", "kôš",
      "ľavica", "pečivo", "šaty", "ježko", "žirafa", "šťuka", "ľahko", "Košice"],
    vety: [
      "Žiak ide do školy.", "Ježko nesie jablko.", "Na rieke je ľad.", "Šarkan letel vysoko.", "Mama ušila šaty.",
      "Šťastie je dar.", "Taška je čierna.", "Ľudia čakali na vlak.", "Žirafa je zviera.", "Ťava pije vodu.",
      "Mačka spala v koši.", "Ešte trochu počkaj.", "Zošit je na stole.",
      "Peter čakal pred školou.", "V Košiciach je pekne.",
    ],
  },
  {
    nazov: "Ý Á Í É",
    nove: "ýáíé",
    tip: "Ý, Á, Í a É sú v hornom rade vpravo: Ý pravý ukazovák, Á prostredník, Í prstenník, É malíček.",
    slova: ["mám", "dobrý", "pekný", "zelený", "kamarát", "písmeno", "jablká", "lístie", "malý", "veľký", "biely",
      "rýchly", "ráno", "tráva", "vták", "lekár", "pán", "hráč", "dievča", "počítač", "píše", "číta", "slnečný",
      "záhrada", "milý", "známka", "básnik", "obrázok", "mesiac", "zajtra"],
    vety: [
      "Ráno svieti slnko.", "Mám dobrého kamaráta.", "Malý vták sedí na strome.", "Lekár je milý.",
      "Dievča píše list.", "Chlapec číta knihu.", "Tráva je zelená.", "Hráč kopol loptu.",
      "V záhrade rastie veľký strom.", "Mama varí obed.", "Biely sneh pokryl zem.", "Počítač je na stole.",
      "Dnes máme v škole kreslenie.", "Babka mi dala jablká.",
    ],
  },
  {
    nazov: "Ú Ä Ň Ó Ď",
    nove: "úäňóďĺŕ",
    tip: "Ú a Ä stláča pravý malíček vpravo hore, Ň pravý malíček vpravo. Ó, Ĺ a Ŕ: najprv dĺžeň ´, potom písmeno. Ď: Shift + ´ (mäkčeň ˇ), potom D.",
    slova: ["kôň", "deň", "päť", "mäso", "ďakujem", "lúka", "údolie", "ďaleko", "jeseň", "báseň", "vŕba", "kĺb",
      "stĺp", "gól", "móda", "tón", "dážď", "hĺbka", "ďateľ", "dúha", "múka", "dlaň", "kŕdeľ", "Ďuro", "päta",
      "ňufák", "rádio", "tóny"],
    vety: [
      "Na lúke sa pasie kôň.", "Dnes je pekný deň.", "Ďakujem za pomoc.", "Mám päť jabĺk.", "Pri rieke rastie vŕba.",
      "Na jeseň padá lístie.", "Dážď bubnuje na okno.", "Hráč dal gól.", "Ďateľ ďobe do kôry.",
      "Babka piekla z múky koláč.", "Nad údolím sa klenula dúha.", "Kŕdeľ vtákov letí na juh.",
      "Ďuro má rád mäso.",
    ],
  },
  {
    nazov: "Q W ? ! : -",
    nove: "qw?!:-",
    typ: "znamienka",
    tip: "Q stláča ľavý malíček, W ľavý prstenník. Otáznik je Shift + čiarka, výkričník Shift + § a dvojbodka Shift + bodka. Pomlčka je vpravo dole.",
    slova: ["web", "wifi", "watt", "kiwi", "Wales", "aquapark", "squash", "Quido", "Walter"],
    vety: [
      "Kde je moja taška?", "Pozor, auto!", "Ahoj, ako sa máš?", "Kúpili sme: chlieb, mlieko a syr.",
      "Mačka je čierno-biela.", "Poď sa hrať!", "Čo budeme robiť zajtra?", "Hurá, prázdniny!",
      "Vo štvrtok ideme do aquaparku.", "Máš doma wifi?", "Na stole leží: pero, ceruzka a zošit.",
      "Kto vyhral zápas?", "Sever - juh - východ - západ.", "Prečo je obloha modrá?",
    ],
  },
  {
    nazov: "Čísla",
    nove: "0123456789",
    typ: "cisla",
    tip: "Číslice sú v hornom rade so Shiftom: drž Shift na druhej ruke a stlač kláves s číslom. Napríklad 5 = pravý Shift + ť.",
    slova: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12", "15", "20", "24", "30", "45", "50", "99", "100", "365", "2026"],
    vety: [
      "Mám 12 rokov.", "Trieda 5.A má 24 žiakov.", "Dnes je 23. novembra.", "Ján má 3 psy a 2 mačky.",
      "Autobus číslo 7 ide o 8:15.", "Do školy chodím 5 dní v týždni.", "Rok má 365 dní.",
      "Hodina má 60 minút.", "V triede je 28 lavíc.", "Na výlet ideme 14. mája.", "Z 10 jabĺk ostali 4.",
      "Babka má 70 rokov.",
    ],
  },
];

const POCET_LEKCII = LEKCIE.length;
LEKCIE.forEach((l, i) => (l.cislo = i + 1));

// ----- Ktoré znaky už žiak pozná -----
// Malé písmená (a ô ľ š …) z nových znakov tejto a všetkých predchádzajúcich lekcií
function znamePismena(cislo) {
  const pismena = [];
  for (const l of LEKCIE.slice(0, cislo)) {
    for (const z of l.nove) if (/\p{L}/u.test(z)) pismena.push(z);
  }
  return pismena;
}

// Všetky znaky, ktoré smú byť v slovách a vetách lekcie (používa aj test)
function povoleneZnaky(cislo) {
  const znaky = new Set([" ", ...znamePismena(cislo)]);
  for (const l of LEKCIE.slice(0, cislo)) for (const z of l.nove) znaky.add(z);
  if (cislo >= 13) { // od lekcie Shift: aj veľké písmená
    for (const z of [...znaky]) if (/\p{Ll}/u.test(z)) znaky.add(z.toUpperCase());
  }
  return znaky;
}

// ----- Cvičenia lekcie -----
// Každé cvičenie má názov a funkciu, ktorá vytvorí text s približne n „slovami“.
// Text sa pri každom pokuse vytvorí nanovo (náhodne), aby si ho žiak nezapamätal.
function cviceniaLekcie(cislo) {
  const l = LEKCIE[cislo - 1];
  const nove = [...l.nove].filter((z) => /\p{L}/u.test(z));
  const zname = znamePismena(cislo);
  const cvicenia = [];

  if (l.typ === "shift") {
    cvicenia.push({ nazov: "Veľké písmená", text: (n) => slovaSVelkym(cislo, n) });
    cvicenia.push({ nazov: "Bodka a čiarka", text: (n) => slovaSoZnamienkami(cislo, n, [".", ","]) });
    cvicenia.push({ nazov: "Mená a mestá", text: (n) => vyberSlova(l.slova, [], n) });
    cvicenia.push({ nazov: "Vety", text: (n) => vyberVety(l.vety, n) });
    return cvicenia;
  }
  if (l.typ === "znamienka") {
    cvicenia.push({ nazov: "Q a W", text: (n) => skupiny(["q", "w", "q", "w", ...zname], n, 3, 5, ["q", "w"]) });
    cvicenia.push({ nazov: "Znamienka", text: (n) => slovaSoZnamienkami(cislo, n, ["?", "!", ":", "-"]) });
    cvicenia.push({ nazov: "Slová", text: (n) => vyberSlova(l.slova, slovaDoLekcie(cislo - 1), n) });
    cvicenia.push({ nazov: "Vety", text: (n) => vyberVety(l.vety, n) });
    return cvicenia;
  }
  if (l.typ === "cisla") {
    cvicenia.push({ nazov: "Číslice", text: (n) => skupiny([..."0123456789"], n, 1, 3) });
    cvicenia.push({ nazov: "Čísla a slová", text: (n) => cislaASlova(cislo, n) });
    cvicenia.push({ nazov: "Vety", text: (n) => vyberVety(l.vety, n) });
    return cvicenia;
  }

  // Bežná lekcia s písmenami
  cvicenia.push({ nazov: "Nové klávesy", text: (n) => skupiny(nove, n, 2, 4) });
  cvicenia.push({
    nazov: "Spolu so staršími",
    text: (n) => skupiny([...nove, ...nove, ...zname], n, 3, 5, cislo > 1 ? nove : null),
  });
  if (l.slova) cvicenia.push({ nazov: "Slová", text: (n) => vyberSlova(l.slova, slovaDoLekcie(cislo - 1), n) });
  else cvicenia.push({ nazov: "Opakovanie", text: (n) => skupiny(zname, n, 3, 5) });
  if (l.vety) cvicenia.push({ nazov: "Vety", text: (n) => vyberVety(l.vety, n) });
  return cvicenia;
}

// ----- Generovanie textov -----
const nahodny = (zoznam) => zoznam[Math.floor(Math.random() * zoznam.length)];
const nahodneCislo = (od, po) => od + Math.floor(Math.random() * (po - od + 1));

// Pre istotu: náhodné skupiny písmen nesmú vytvoriť hrubé slovo
const ZAKAZANE = /kurv|jeb|chuj|kokot|pič|srač|hovn|debil|buzn|cig[aá]n|zmrd|kret[eé]n/i;

// Skupiny náhodných písmen ("fjf jjf fj …"). Ak je zadané "povinne",
// každá skupina obsahuje aspoň jedno z týchto písmen (nové klávesy lekcie).
function skupiny(pismena, n, minDlzka, maxDlzka, povinne = null) {
  const vysledok = [];
  while (vysledok.length < n) {
    let s = "";
    const dlzka = nahodneCislo(minDlzka, maxDlzka);
    for (let i = 0; i < dlzka; i++) s += nahodny(pismena);
    if (povinne && ![...s].some((z) => povinne.includes(z))) continue;
    if (ZAKAZANE.test(s)) continue;
    if (vysledok.length > 0 && vysledok[vysledok.length - 1] === s) continue; // nie dvakrát za sebou
    vysledok.push(s);
  }
  return vysledok.join(" ");
}

// Slová zo všetkých lekcií po zadanú (vrátane), bez mien s veľkým písmenom
function slovaDoLekcie(cislo) {
  return LEKCIE.slice(0, cislo).flatMap((l) => l.slova || []).filter((s) => !/\p{Lu}/u.test(s[0]) && !/\d/.test(s));
}

// n slov: aspoň polovica z nových (tejto lekcie), zvyšok aj zo starších
function vyberSlova(nove, starsie, n) {
  const vysledok = [];
  while (vysledok.length < n) {
    const zoznam = starsie.length > 0 && Math.random() < 0.4 ? starsie : nove;
    const slovo = nahodny(zoznam);
    if (vysledok[vysledok.length - 1] === slovo) continue;
    vysledok.push(slovo);
  }
  return vysledok.join(" ");
}

// Vety, kým nie je spolu aspoň n slov (každá veta najviac raz)
function vyberVety(vety, n) {
  const zamiesane = [...vety].sort(() => Math.random() - 0.5);
  const vysledok = [];
  let slov = 0;
  for (const veta of zamiesane) {
    if (slov >= n) break;
    vysledok.push(veta);
    slov += veta.split(" ").length;
  }
  return vysledok.join(" ");
}

// Známe slová s veľkým začiatočným písmenom: "Mama Les Dom"
function slovaSVelkym(cislo, n) {
  const slova = slovaDoLekcie(cislo);
  const vysledok = [];
  while (vysledok.length < n) {
    const s = nahodny(slova);
    vysledok.push(s[0].toUpperCase() + s.slice(1));
  }
  return vysledok.join(" ");
}

// Známe slová so znamienkami: "Mama, les. Dom: voda?" Po bodke, ? a ! veľké písmeno.
function slovaSoZnamienkami(cislo, n, znamienka) {
  const slova = slovaDoLekcie(cislo);
  const vysledok = [];
  let velke = true;
  while (vysledok.length < n) {
    let s = nahodny(slova);
    if (velke) s = s[0].toUpperCase() + s.slice(1);
    const posledne = vysledok.length === n - 1;
    const z = posledne ? (znamienka.includes(".") ? "." : nahodny(["?", "!"])) : nahodny([...znamienka, "", ""]);
    if (z === "-" && !posledne) {
      // pomlčka spája dve slová: "čierno-biely"
      s += "-" + nahodny(slova);
      velke = false;
    } else {
      s += z;
      velke = [".", "?", "!"].includes(z);
    }
    vysledok.push(s);
  }
  return vysledok.join(" ");
}

// "3 domov 12 lesa 7 …": striedanie čísel a známych slov
function cislaASlova(cislo, n) {
  const slova = slovaDoLekcie(cislo);
  const vysledok = [];
  while (vysledok.length < n) {
    vysledok.push(String(nahodneCislo(0, Math.random() < 0.5 ? 9 : 999)));
    if (vysledok.length < n) vysledok.push(nahodny(slova));
  }
  return vysledok.join(" ");
}

// ----- Hviezdičky -----
// Pod potrebnou presnosťou 0 hviezd (cvičenie nesplnené).
// Od potrebnej presnosti po 100 % je 9 stupňov: 1, 1½, 2 … 5 hviezd.
// Príklad pri 90 %: 90 % = 1, 95 % = 3, 100 % = 5 hviezd.
function hviezdyZaPresnost(presnost, potrebna) {
  if (presnost === undefined || presnost === null || presnost < potrebna) return 0;
  if (potrebna >= 100) return 5;
  const krok = (100 - potrebna) / 8; // 8 polovičných krokov medzi 1 a 5 hviezdami
  return Math.min(5, 1 + Math.floor((presnost - potrebna) / krok + 1e-9) / 2);
}
