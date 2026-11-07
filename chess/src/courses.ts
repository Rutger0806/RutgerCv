/**
 * Geleide openingscursussen. Elke cursus heeft een hoofdlijn (beide kleuren, vanaf de
 * beginstelling) en varianten: "als je tegenstander hier iets anders speelt, doe dan dit".
 * Zetten zijn SAN. Een zet is een string of [zet, uitleg].
 */
export type Mv = string | [string, string];

export interface Branch {
  /** aantal halve zetten van de hoofdlijn dat gespeeld is voordat de tegenstander afwijkt */
  from: number;
  title: string;
  /** true = een alternatieve keuze van jezelf (geen afwijking van de tegenstander) */
  own?: boolean;
  steps: Mv[];
}

export interface Course {
  id: string;
  name: string;
  side: 'white' | 'black';
  /** eerste zet van de tegenstander waartegen dit werkt, of eigen eerste zet bij wit */
  vs: '1.e4' | '1.d4' | '1.c4' | '1.Nf3';
  eco: string;
  tagline: string;
  level: 1 | 2 | 3;
  ideas: string[];
  pitfalls: string[];
  /** aantal halve zetten van de hoofdlijn voor het voorbeeldbord op de kaart */
  thumb: number;
  line: Mv[];
  branches: Branch[];
}

export const COURSES: Course[] = [
  /* ================= ZWART TEGEN 1.e4 ================= */
  {
    id: 'french',
    name: 'Franse Verdediging',
    side: 'black',
    vs: '1.e4',
    eco: 'C11',
    tagline: 'Een stevige pionnenketen en een tegenaanval op het centrum.',
    level: 2,
    thumb: 8,
    ideas: [
      'Je zet pionnen op e6 en d5 en bouwt een solide keten. Je valt de kop van wit (d4) aan met ...c5.',
      'Je loper op c8 is je lastige stuk: zoek een actieve plek voor hem, of ruil hem af.',
      'Als wit e5 speelt, krijg je een ruimtetekort, maar ook doelwitten: de pion op d4 en op e5.',
    ],
    pitfalls: [
      'Laat je loper op c8 niet de hele partij opgesloten staan.',
      'Reageer niet te passief: speel op tijd ...c5 of ...f6 om het centrum te ondermijnen.',
    ],
    line: [
      ['e4', 'Wit pakt het centrum met de koningspion.'],
      ['e6', 'Het begin van de Franse Verdediging. Je bereidt ...d5 voor en houdt de stelling compact.'],
      ['d4', 'Wit bouwt een groot pionnencentrum op.'],
      ['d5', 'Nu val je dat centrum meteen aan. Wit moet een keuze maken over de pion op e4.'],
      ['Nc3', 'De hoofdzet: wit verdedigt e4 met een stuk.'],
      ['Nf6', 'Je valt e4 opnieuw aan en ontwikkelt een stuk.'],
      ['e5', 'Wit duwt door en jaagt je paard weg. Dit is de Steinitz-variant.'],
      ['Nfd7', 'Het paard moet weg. Vanaf d7 helpt het straks je tegenaanval op e5.'],
      ['f4', 'Wit steunt e5 met een pion en krijgt veel ruimte.'],
      ['c5', 'De kernzet van de Franse: je valt het steunpunt d4 aan.'],
      ['Nf3', 'Wit ontwikkelt en dekt d4.'],
      ['Nc6', 'Nog een aanvaller op d4. Zo bouw je druk op.'],
      ['Be3', 'Wit dekt d4 nog een keer.'],
      ['cxd4', 'Je ruilt een pion om de pion op e5 te ontdoen van zijn steun.'],
      ['Nxd4', 'Wit slaat terug met het paard.'],
      ['Bc5', 'Je loper komt actief en zet druk op het paard op d4. Alles staat in jouw voordeel qua activiteit.'],
      ['Qd2', 'Wit bereidt lange rokade voor.'],
      ['O-O', 'Je zet je koning veilig. Daarna kun je met ...a6 en ...Qb6 verder.'],
      ['O-O-O', 'Wit rokeert lang. Beide koningen staan op verschillende vleugels: dat belooft een scherpe strijd.'],
      ['a6', 'Een nuttige zet: je bereidt ...Qb6 en ...b5 voor.'],
    ],
    branches: [
      {
        from: 4,
        title: 'Wit ruilt: 3.exd5 (Ruilvariant)',
        steps: [
          ['exd5', 'Wit ruilt direct. De stelling wordt symmetrisch en rustig.'],
          ['exd5', 'Je slaat terug met de pion. Je hebt nu geen opgesloten loper meer: de c8-loper kan naar f5 of g4.'],
          ['Nf3', 'Wit ontwikkelt.'],
          ['Nf6', 'Jij ook. Houd het simpel en ontwikkel snel.'],
          ['Bd3', 'Een natuurlijke plek voor de loper.'],
          ['Bd6', 'Spiegel je tegenstander. Daarna rokeer je en speel je gewoon schaak.'],
          'O-O',
          'O-O',
        ],
      },
      {
        from: 4,
        title: 'Wit duwt door: 3.e5 (Voorwaartse variant)',
        steps: [
          ['e5', 'Wit sluit het centrum en wint ruimte. Dat is een duidelijk plan, maar het geeft je doelwitten.'],
          ['c5', 'Meteen de aanval op de pionnenketen: je wilt d4 ondermijnen.'],
          ['c3', 'Wit steunt d4 met een pion.'],
          ['Nc6', 'Je zet nog meer druk op d4.'],
          ['Nf3', 'Wit ontwikkelt en dekt d4.'],
          ['Qb6', 'De dame valt d4 en ook b2 aan. Dit is de standaardstructuur van de Voorwaartse variant.'],
          ['a3', 'Wit bereidt b4 voor en houdt de pion op b2 veilig.'],
          ['c4', 'Je sluit de damevleugel en maakt ruimte. Op de koningsvleugel mag wit proberen te slaan, maar jij staat solide.'],
        ],
      },
      {
        from: 4,
        title: 'Wit speelt 3.Nd2 (Tarrasch-variant)',
        steps: [
          ['Nd2', 'Wit houdt zijn pion op e4 verdedigd zonder dat zijn paard vastgepind kan worden.'],
          ['Nf6', 'De natuurlijke zet. Je valt e4 aan.'],
          ['e5', 'Wit duwt door.'],
          ['Nfd7', 'Hetzelfde plan als in de hoofdlijn.'],
          ['Bd3', 'Wit ontwikkelt de loper naar een actieve plek.'],
          ['c5', 'Je valt het centrum aan, zoals altijd in de Franse.'],
          ['c3', 'Wit dekt d4.'],
          ['Nc6', 'Je zet druk op d4.'],
          ['Ne2', 'Wit ontwikkelt naar e2.'],
          ['cxd4', 'Je opent de c-lijn.'],
          ['cxd4', 'Wit herstelt het centrum.'],
          ['f6', 'Een belangrijke zet: je valt de pion op e5 aan met een pion.'],
        ],
      },
      {
        from: 6,
        title: 'Wit pend je paard vast: 4.Bg5 (Klassieke variant)',
        steps: [
          ['Bg5', 'Wit pend je paard vast tegen de dame.'],
          ['Be7', 'Je geeft een extra verdediging aan het paard en bereidt rokade voor.'],
          ['e5', 'Wit duwt, het paard moet weg.'],
          ['Nfd7', 'De bekende uitweg.'],
          ['Bxe7', 'Wit ruilt de lopers.'],
          ['Qxe7', 'Je slaat terug met de dame. De druk op de pion e5 en d4 blijft.'],
          ['Qd2', 'Wit ontwikkelt de dame.'],
          ['O-O', 'Rokade. Nu kun je ...c5 spelen om het centrum aan te vallen.'],
        ],
      },
    ],
  },
  {
    id: 'caro-kann',
    name: 'Caro-Kann',
    side: 'black',
    vs: '1.e4',
    eco: 'B18',
    tagline: 'Rotsvast, met een vrije loper en weinig zwakke plekken.',
    level: 1,
    thumb: 10,
    ideas: [
      'Je speelt ...c6 en ...d5: net zo solide als de Franse, maar je loper op c8 kan eerst naar buiten.',
      'Haal die loper naar f5 of g4 voordat je e6 speelt. Dat is de kern van de opening.',
      'Je krijgt vaak een gezonde pionnenstructuur en een rustig eindspel zonder grote zwakheden.',
    ],
    pitfalls: [
      'Speel niet ...e6 voordat je loper uit is, anders sluit je hem op.',
      'Wees alert op aanvallen met h4-h5 tegen je loper: weet waar hij heen kan.',
    ],
    line: [
      ['e4', 'Wit pakt het centrum.'],
      ['c6', 'De Caro-Kann. Je bereidt ...d5 voor met pionsteun en houdt de diagonaal van de loper op c8 open.'],
      ['d4', 'Wit bouwt een sterk centrum.'],
      ['d5', 'Je valt e4 aan. Wit moet kiezen: verdedigen, ruilen of vooruitduwen.'],
      ['Nc3', 'De hoofdzet: wit verdedigt de e-pion met een stuk.'],
      ['dxe4', 'Je ruilt het centrum open en wint de pion even, zodat wit moet terugslaan.'],
      ['Nxe4', 'Wit herovert de pion met zijn paard.'],
      ['Bf5', 'De sleutelzet. Je loper komt vrij voordat je ...e6 speelt. Dat is het hele idee van de Caro-Kann.'],
      ['Ng3', 'Het paard valt de loper aan.'],
      ['Bg6', 'Je loper trekt zich terug naar een veilige, goede diagonaal.'],
      ['h4', 'Wit dreigt h5 om je loper te vangen. Een scherp plan, maar het kost veel tijd.'],
      ['h6', 'Je neemt het veld g5 weg van het paard. Zo is er geen scherpe dreiging meer.'],
      ['Nf3', 'Wit ontwikkelt.'],
      ['Nd7', 'Je maakt de weg vrij voor ...Ngf6 en ...e6.'],
      ['h5', 'Wit valt je loper aan.'],
      ['Bh7', 'De loper is veilig op h7 en kijkt nog steeds naar de diagonaal.'],
      ['Bd3', 'Wit wil de lopers ruilen.'],
      ['Bxd3', 'Je ruilt zonder moeite. Dat is prima: je loper was je enige echte zorg.'],
      ['Qxd3', 'Wit slaat terug met de dame.'],
      ['e6', 'Nu mag je e6 spelen: je stelling is solide en alles is ontwikkeld.'],
    ],
    branches: [
      {
        from: 4,
        title: 'Wit duwt door: 3.e5 (Voorwaartse variant)',
        steps: [
          ['e5', 'Wit wint ruimte en sluit het centrum.'],
          ['Bf5', 'Je loper komt weer actief, buiten de pionnenketen. Dat is hier ook de sleutelzet.'],
          ['Nf3', 'Wit ontwikkelt.'],
          ['e6', 'Nu kan e6, want je loper staat al buiten de ketens.'],
          ['Be2', 'Wit ontwikkelt rustig.'],
          ['c5', 'Je valt het centrum aan, net als in de Franse.'],
        ],
      },
      {
        from: 4,
        title: 'Wit ruilt: 3.exd5 (Ruilvariant)',
        steps: [
          ['exd5', 'Wit ruilt en geeft je een gelijke structuur.'],
          ['cxd5', 'Je slaat terug met de c-pion. Zo opent de c-lijn voor je tegenspel.'],
          ['Bd3', 'Wit ontwikkelt de loper naar een actieve plek.'],
          ['Nc6', 'Je ontwikkelt en zet druk op d4.'],
          ['c3', 'Wit dekt d4 en bereidt Qc2 voor.'],
          ['Nf6', 'Een natuurlijke zet.'],
          ['Bf4', 'Wit ontwikkelt de loper buiten de pionnen.'],
          ['Bg4', 'Je speelt de eigen loper actief uit voordat je e6 speelt.'],
        ],
      },
    ],
  },
  {
    id: 'najdorf',
    name: 'Siciliaans: Najdorf',
    side: 'black',
    vs: '1.e4',
    eco: 'B90',
    tagline: 'De scherpste en meest gespeelde verdediging tegen 1.e4.',
    level: 3,
    thumb: 12,
    ideas: [
      'Met ...c5 vecht je niet voor symmetrie: je wisselt een vleugelpion voor een centrumpion en krijgt tegenspel.',
      'De zet ...a6 neemt b5 weg en bereidt ...e5 of ...b5 voor. Je blijft flexibel.',
      'Je stelling is flexibel, maar je moet de theorie van de varianten (6.Bg5, 6.Be3, 6.Bc4) kennen.',
    ],
    pitfalls: [
      'Rokade te lang uitstellen kan gevaarlijk zijn tegen aanvallende opstellingen.',
      'Geen losse pionnenzetten: elke zet in de Najdorf heeft een reden.',
    ],
    line: [
      ['e4', 'Wit pakt het centrum.'],
      ['c5', 'Het Siciliaans. Je wisselt een vleugelpion voor een centrumpion en speelt voor winst.'],
      ['Nf3', 'Wit ontwikkelt en bereidt d4 voor.'],
      ['d6', 'Je bereidt ...Nf6 voor en steunt het centrum.'],
      ['d4', 'Wit opent het centrum.'],
      ['cxd4', 'Je ruilt je c-pion tegen wits d-pion. Dat is het hele idee van het Siciliaans.'],
      ['Nxd4', 'Wit herstelt het materiaal.'],
      ['Nf6', 'Je valt de e4-pion aan en ontwikkelt.'],
      ['Nc3', 'Wit verdedigt e4.'],
      ['a6', 'De Najdorf. Je neemt b5 weg van de witte stukken en bereidt ...e5 of ...b5 voor.'],
      ['Be3', 'De Engelse aanval: wit gaat naar f3, Qd2 en lange rokade.'],
      ['e5', 'Je jaagt het paard weg van d4 en wint ruimte in het centrum.'],
      ['Nb3', 'Het paard trekt zich terug.'],
      ['Be6', 'Je loper dekt d5 en bereidt rokade voor.'],
      ['f3', 'Wit steunt e4 en bereidt g4.'],
      ['Be7', 'Je ontwikkelt en bereidt rokade voor.'],
      ['Qd2', 'Wit bereidt lange rokade en een pionstorm voor.'],
      ['O-O', 'Je koning is veilig.'],
      ['O-O-O', 'Wit rokeert lang. Tegengestelde rokades: een scherp gevecht.'],
      ['Nbd7', 'Je ontwikkelt je laatste stuk en bereidt ...b5 voor.'],
    ],
    branches: [
      {
        from: 10,
        title: 'Wit speelt 6.Bg5 (de scherpste lijn)',
        steps: [
          ['Bg5', 'Wit pend je paard en bereidt Qd2 of f4 voor.'],
          ['e6', 'Je dekt d5 en ontwikkelt de loper.'],
          ['f4', 'Wit steunt e5 met een pion.'],
          ['Be7', 'Je ontwikkelt en bereidt rokade voor.'],
          ['Qf3', 'Wit zet druk op de f-lijn en e6.'],
          ['Qc7', 'Je bereidt ...Nbd7 voor en dekt de pion.'],
          ['O-O-O', 'Lange rokade, klaar voor een aanval.'],
          ['Nbd7', 'Je ontwikkelt zonder risico.'],
        ],
      },
      {
        from: 10,
        title: 'Wit speelt 6.Be2 (rustige lijn)',
        steps: [
          ['Be2', 'Een rustige ontwikkeling zonder scherpe plannen.'],
          ['e5', 'Je jaagt het paard weg en krijgt een gezonde stelling.'],
          ['Nb3', 'Het paard trekt zich terug.'],
          ['Be7', 'Je ontwikkelt.'],
          'O-O',
          'O-O',
        ],
      },
      {
        from: 10,
        title: 'Wit speelt 6.Bc4 (Fischer-Sozin)',
        steps: [
          ['Bc4', 'De loper valt f7 aan. Let op de zwakke plek op f7.'],
          ['e6', 'Je dekt f7 en bereidt ...b5 voor.'],
          ['Bb3', 'De loper trekt zich terug naar b3.'],
          ['b5', 'Je neemt ruimte op de damevleugel.'],
          'O-O',
          ['Be7', 'Je ontwikkelt.'],
        ],
      },
      {
        from: 2,
        title: 'Wit speelt 2.c3 (Alapin)',
        steps: [
          ['c3', 'Wit wil met d4 een groot centrum bouwen zonder in een open Siciliaan te komen.'],
          ['d5', 'De beste reactie: je valt het centrum direct aan.'],
          ['exd5', 'Wit slaat.'],
          ['Qxd5', 'Je haalt de dame snel naar buiten en blijft actief.'],
          ['d4', 'Wit wil het centrum volbouwen.'],
          ['Nf6', 'Je ontwikkelt en zet druk op d4.'],
          ['Nf3', 'Wit ontwikkelt.'],
          ['Bg4', 'Je speelt de loper naar een actieve plek.'],
        ],
      },
    ],
  },
  {
    id: 'scandinavian',
    name: 'Scandinavische Verdediging',
    side: 'black',
    vs: '1.e4',
    eco: 'B01',
    tagline: 'Direct het centrum aanvallen met een eenvoudig plan.',
    level: 1,
    thumb: 12,
    ideas: [
      'Je slaat meteen terug op e4 met ...d5. Weinig theorie, duidelijk plan.',
      'Je dame komt vroeg naar buiten (Qxd5). Daarom kost wit tempo als hij de dame aanvalt.',
      'Na ...Qa5 en ...c6 heb je een veilige, flexibele stelling met ...Bf5 en ...e6.',
    ],
    pitfalls: [
      'Zet je dame niet te vaak om; ontwikkel eerst je stukken.',
      'Let op de snelle aanval op je koning als je te laat rokeert.',
    ],
    line: [
      ['e4', 'Wit pakt het centrum.'],
      ['d5', 'De Scandinavische Verdediging. Je valt het centrum meteen aan.'],
      ['exd5', 'Wit wint een pion, maar je gaat die direct terugwinnen.'],
      ['Qxd5', 'Je slaat terug met de dame. Zo staat het materiaal weer gelijk.'],
      ['Nc3', 'Wit ontwikkelt met tempo: hij valt je dame aan.'],
      ['Qa5', 'Een veilige plek voor de dame. Vanaf a5 pend je het paard en blijft ze ver van gevaar.'],
      ['d4', 'Wit bouwt een sterk centrum op.'],
      ['Nf6', 'Je ontwikkelt en zet druk op d4 en e4.'],
      ['Nf3', 'Wit ontwikkelt.'],
      ['c6', 'Je steunt je dame en bereidt ...Bf5 voor. Een heel solide structuur.'],
      ['Bc4', 'Wit ontwikkelt de loper naar een actieve plek.'],
      ['Bf5', 'Je ontwikkelt je loper buiten de pionnen. Dat is ook hier de sleutel.'],
      ['Bd2', 'Wit bereidt Qe2 of rokade voor.'],
      ['e6', 'Nu kun je e6 spelen: je loper staat buiten de pionnenketen.'],
    ],
    branches: [
      {
        from: 3,
        title: 'Alternatief voor jou: 2...Nf6 (Moderne Scandinavische)',
        own: true,
        steps: [
          ['Nf6', 'Je geeft de pion nog niet terug en dwingt wit een keuze.'],
          ['d4', 'Wit bouwt een groot centrum.'],
          ['Nxd5', 'Je haalt de pion terug en blijft ontwikkelen.'],
          ['Nf3', 'Wit ontwikkelt.'],
          ['g6', 'Je fianchetteert de loper voor druk op het centrum.'],
          ['Be2', 'Wit ontwikkelt rustig.'],
          ['Bg7', 'De loper kijkt naar het hele bord.'],
          'O-O',
          'O-O',
        ],
      },
    ],
  },

  /* ================= ZWART TEGEN 1.d4 ================= */
  {
    id: 'qgd',
    name: 'Geweigerd Damegambiet',
    side: 'black',
    vs: '1.d4',
    eco: 'D37',
    tagline: 'Klassiek, solide en rijk aan strategische ideeen.',
    level: 2,
    thumb: 10,
    ideas: [
      'Je houdt je pion op d5 vast met ...e6 en laat wit niet makkelijk in het centrum binnenkomen.',
      'Je stelling is solide, maar je loper op c8 staat opgesloten. Los dat op met ...b6 en ...Bb7, of ruil af.',
      'Ruilen helpt: het geeft je loper meer lucht.',
    ],
    pitfalls: [
      'Speel niet te passief. Zoek tegenspel met ...c5 of ...c6 op het juiste moment.',
      'Let op de Minderheidsaanval (b4-b5) in de Ruilvariant.',
    ],
    line: [
      ['d4', 'Wit pakt het centrum met de damepion.'],
      ['d5', 'Je antwoordt symmetrisch en pakt ook het centrum.'],
      ['c4', 'Het Damegambiet: wit biedt een pion aan om het centrum te veroveren.'],
      ['e6', 'Je weigert het gambiet en steunt d5. Een heel solide keuze.'],
      ['Nc3', 'Wit ontwikkelt en zet druk op d5.'],
      ['Nf6', 'Je ontwikkelt en verdedigt d5 een tweede keer.'],
      ['Bg5', 'Wit pend je paard en verhoogt de druk op d5.'],
      ['Be7', 'Je ontwikkelt en breekt de pin op.'],
      ['e3', 'Wit steunt zijn centrum.'],
      ['O-O', 'Je zet je koning veilig.'],
      ['Nf3', 'Wit ontwikkelt.'],
      ['h6', 'Je vraagt de loper wat hij van plan is. Hij moet nu kiezen.'],
      ['Bh4', 'De loper blijft de pin handhaven.'],
      ['b6', 'De Tartakower-opstelling: je bereidt ...Bb7 voor en lost het probleem van je loper op.'],
      ['cxd5', 'Wit ruilt en probeert de spanning op te lossen.'],
      ['Nxd5', 'Je slaat terug en ruilt het pinnende stuk af.'],
      ['Bxe7', 'Wit ruilt de lopers.'],
      ['Qxe7', 'Je slaat terug met de dame.'],
      ['Nxd5', 'Wit ruilt het paard.'],
      ['exd5', 'Je slaat terug. Je bent meer ontwikkeld en hebt een gezonde stelling.'],
    ],
    branches: [
      {
        from: 6,
        title: 'Wit ruilt: 4.cxd5 (Ruilvariant)',
        steps: [
          ['cxd5', 'Wit lost de spanning direct op.'],
          ['exd5', 'Je slaat terug en opent de lijn voor je loper.'],
          ['Bg5', 'Wit pend je paard.'],
          ['Be7', 'Je ontwikkelt.'],
          ['e3', 'Wit steunt het centrum.'],
          'O-O',
          ['Bd3', 'Wit ontwikkelt. Hij mikt vaak op de Minderheidsaanval.'],
          ['Nbd7', 'Je ontwikkelt het laatste stuk.'],
        ],
      },
      {
        from: 2,
        title: 'Wit speelt de London: 2.Bf4',
        steps: [
          ['Bf4', 'De London Systeem. Een rustige opstelling met een actieve loper.'],
          ['Nf6', 'Je ontwikkelt en houdt je opties open.'],
          ['e3', 'Wit steunt de loper en opent de diagonaal.'],
          ['c5', 'Je valt het centrum aan. Dit is de beste plek om tegenspel te zoeken.'],
          ['c3', 'Wit steunt d4.'],
          ['Nc6', 'Je zet druk op d4.'],
          ['Nd2', 'Wit ontwikkelt.'],
          ['e6', 'Je steunt het centrum.'],
          ['Ngf3', 'Wit ontwikkelt.'],
          ['Bd6', 'Je ontwikkelt de loper naar een actieve plek en ruilt de witte loper af.'],
        ],
      },
    ],
  },
  {
    id: 'slav',
    name: 'Slavische Verdediging',
    side: 'black',
    vs: '1.d4',
    eco: 'D17',
    tagline: 'Net zo solide als QGD, maar je loper blijft vrij.',
    level: 2,
    thumb: 12,
    ideas: [
      'Met ...c6 steun je d5 zonder je loper op c8 op te sluiten.',
      'Je kunt vaak een pion op c4 winnen en je loper naar f5 halen.',
      'Je krijgt een stevige stelling met goed tegenspel via ...e5 of ...c5.',
    ],
    pitfalls: [
      'Houd de pion op c4 niet koste wat het kost vast: ontwikkel je stukken.',
      'Let op wits centrumopbouw met e4 als je te passief speelt.',
    ],
    line: [
      ['d4', 'Wit pakt het centrum.'],
      ['d5', 'Je antwoordt symmetrisch.'],
      ['c4', 'Het Damegambiet.'],
      ['c6', 'De Slavische Verdediging. Je steunt d5 met een pion en laat de diagonaal van je loper open.'],
      ['Nf3', 'Wit ontwikkelt.'],
      ['Nf6', 'Je ontwikkelt.'],
      ['Nc3', 'Wit zet druk op d5.'],
      ['dxc4', 'Je pakt de pion en geeft het centrum op, maar wit moet moeite doen om hem terug te winnen.'],
      ['a4', 'Wit voorkomt dat je de pion met ...b5 behoudt.'],
      ['Bf5', 'Je loper komt buiten de pionnenketen. Dat is het hele voordeel van de Slav.'],
      ['e3', 'Wit bereidt de herovering van c4 voor.'],
      ['e6', 'Nu kan e6, want je loper staat vrij.'],
      ['Bxc4', 'Wit wint de pion terug.'],
      ['Bb4', 'Je pend het paard en zet druk op e4.'],
      ['O-O', 'Wit rokeert.'],
      ['Nbd7', 'Je ontwikkelt je laatste stuk en bereidt ...O-O voor.'],
    ],
    branches: [
      {
        from: 4,
        title: 'Wit speelt 3.Nc3 en later e3 (Meran-structuur)',
        steps: [
          ['Nc3', 'Wit ontwikkelt het paard eerst.'],
          ['Nf6', 'Je ontwikkelt.'],
          ['e3', 'Wit steunt het centrum.'],
          ['e6', 'Je bereidt ...Nbd7 voor. Dit is de Semi-Slav.'],
          ['Nf3', 'Wit ontwikkelt.'],
          ['Nbd7', 'Je ontwikkelt het laatste stuk.'],
          ['Bd3', 'Wit ontwikkelt de loper.'],
          ['dxc4', 'Je wint tijd: de loper moet terug.'],
          ['Bxc4', 'Wit slaat terug.'],
          ['b5', 'De Meran: je neemt ruimte en jaagt de loper weg.'],
        ],
      },
      {
        from: 4,
        title: 'Wit ruilt: 3.cxd5 (Ruilvariant)',
        steps: [
          ['cxd5', 'Wit ruilt de pionnen.'],
          ['cxd5', 'Je slaat terug en krijgt een symmetrische stelling.'],
          ['Nc3', 'Wit ontwikkelt.'],
          ['Nf6', 'Je ontwikkelt.'],
          ['Bf4', 'Wit ontwikkelt de loper buiten de pionnen.'],
          ['Nc6', 'Je ontwikkelt het paard naar een actieve plek.'],
          ['e3', 'Wit steunt het centrum.'],
          ['Bf5', 'Je speelt de loper actief uit.'],
        ],
      },
    ],
  },
  {
    id: 'kid',
    name: 'Koningsindiase Verdediging',
    side: 'black',
    vs: '1.d4',
    eco: 'E92',
    tagline: 'Laat wit het centrum bouwen en val het daarna aan.',
    level: 3,
    thumb: 14,
    ideas: [
      'Je fianchetteert de loper naar g7 en laat wit een groot centrum opbouwen. Daarna vecht je terug met ...e5 of ...c5.',
      'De loper op g7 is je sterkste stuk. Hij kijkt langs de lange diagonaal.',
      'Vaak komt er een pionnenstorm tegen elkaars koning: jij gaat op de koningsvleugel met ...f5.',
    ],
    pitfalls: [
      'Je hebt weinig ruimte: wacht niet te lang met je tegenaanval.',
      'Een rustige aanpak van wit (zoals de Fianchetto) vraagt een ander plan dan de hoofdlijn.',
    ],
    line: [
      ['d4', 'Wit pakt het centrum.'],
      ['Nf6', 'Je valt het centrum indirect aan met een stuk in plaats van een pion.'],
      ['c4', 'Wit neemt nog meer ruimte.'],
      ['g6', 'Je bereidt het fianchetto van de loper voor.'],
      ['Nc3', 'Wit ontwikkelt.'],
      ['Bg7', 'De sterke loper op de lange diagonaal. Dat is het hart van je opstelling.'],
      ['e4', 'Wit bouwt een groot pionnencentrum. Dat is precies wat je wilt: je kunt het straks aanvallen.'],
      ['d6', 'Je bereidt ...e5 voor en steunt het centrum.'],
      ['Nf3', 'Wit ontwikkelt.'],
      ['O-O', 'Je zet je koning veilig. Wit heeft nog niet gerokeerd.'],
      ['Be2', 'Wit ontwikkelt en bereidt rokade voor.'],
      ['e5', 'Je valt het centrum aan. Dit is de hoofdzet van de Koningsindiase.'],
      ['O-O', 'Wit rokeert.'],
      ['Nc6', 'Je zet druk op d4 en bereidt ...Ne7 voor.'],
      ['d5', 'Wit sluit het centrum en wint ruimte.'],
      ['Ne7', 'Het paard gaat naar de koningsvleugel, waar jouw tegenaanval met ...f5 begint.'],
      ['Ne1', 'Wit gaat voor de damevleugel met c5.'],
      ['Nd7', 'Je bereidt ...f5 voor en maakt plaats voor de pionstorm.'],
      ['Be3', 'Wit ontwikkelt.'],
      ['f5', 'Je pionstorm begint. Beide partijen vallen aan op verschillende vleugels.'],
    ],
    branches: [
      {
        from: 8,
        title: 'Wit speelt 5.f3 (Sämisch)',
        steps: [
          ['f3', 'Wit steunt e4 en bereidt lange rokade en een pionstorm voor.'],
          ['O-O', 'Je zet je koning veilig.'],
          ['Be3', 'Wit ontwikkelt.'],
          ['e5', 'Je valt het centrum aan.'],
          ['Nge2', 'Wit ontwikkelt zonder de loper te blokkeren.'],
          ['c6', 'Je steunt d5 en bereidt ...a6 en ...b5 voor.'],
        ],
      },
      {
        from: 4,
        title: 'Wit speelt de Fianchetto: 3.g3',
        steps: [
          ['g3', 'Wit kiest een rustige opstelling met een eigen fianchetto.'],
          ['Bg7', 'Je ontwikkelt de loper.'],
          ['Bg2', 'Wit ontwikkelt zijn eigen loper.'],
          ['O-O', 'Je zet je koning veilig.'],
          ['Nc3', 'Wit ontwikkelt.'],
          ['d6', 'Je steunt het centrum.'],
          ['Nf3', 'Wit ontwikkelt.'],
          ['Nbd7', 'Je bereidt ...e5 voor.'],
          'O-O',
          ['e5', 'Je pakt het centrum alsnog.'],
        ],
      },
    ],
  },

  /* ================= ZWART TEGEN 1.c4 / 1.Nf3 ================= */
  {
    id: 'english-e5',
    name: 'Engels: gespiegeld Siciliaans',
    side: 'black',
    vs: '1.c4',
    eco: 'A20',
    tagline: 'Tegen 1.c4 pak je direct het centrum met ...e5.',
    level: 1,
    thumb: 10,
    ideas: [
      'Je speelt ...e5 en bouwt een groot centrum. Het is een Siciliaans met omgekeerde kleuren, waarin jij de extra tempo-vrije kant speelt.',
      'Ontwikkel natuurlijk: ...Nf6, ...Nc6, ...d5. Wit moet jou steeds aanpassen.',
      'Wit speelt vaak rustig: jij kunt kiezen tussen een stevige of actieve opzet.',
    ],
    pitfalls: [
      'Wees voorzichtig met te vroeg ...d5 zonder je stukken te ontwikkelen.',
      'Kijk uit voor het gevaarlijke veld d5-d4 en zwakke velden op g8-a2.',
    ],
    line: [
      ['c4', 'De Engelse Opening. Wit pakt het centrum van de zijkant.'],
      ['e5', 'Je pakt direct het centrum met een pion en krijgt veel ruimte.'],
      ['Nc3', 'Wit ontwikkelt en bereidt een druk op d5 voor.'],
      ['Nf6', 'Je ontwikkelt en controleert e4 en d5.'],
      ['Nf3', 'Wit valt e5 aan.'],
      ['Nc6', 'Je verdedigt de pion en ontwikkelt.'],
      ['g3', 'Wit fianchetteert zijn loper.'],
      ['d5', 'Je pakt het centrum. Dit is de scherpste reactie.'],
      ['cxd5', 'Wit ruilt.'],
      ['Nxd5', 'Je slaat terug met het paard, dat centraal staat.'],
      ['Bg2', 'Wit ontwikkelt de loper.'],
      ['Nb6', 'Het paard trekt zich terug naar een veilige plek, voordat wit het kan aanvallen.'],
      'O-O',
      ['Be7', 'Je ontwikkelt en bereidt rokade voor.'],
      ['a3', 'Wit bereidt b4 voor.'],
      ['O-O', 'Je koning is veilig.'],
    ],
    branches: [
      {
        from: 2,
        title: 'Wit speelt 2.g3 direct',
        steps: [
          ['g3', 'Wit fianchetteert direct.'],
          ['Nf6', 'Je ontwikkelt.'],
          ['Bg2', 'Wit ontwikkelt de loper.'],
          ['d5', 'Je pakt het centrum.'],
          ['cxd5', 'Wit ruilt.'],
          ['Nxd5', 'Je slaat terug.'],
          ['Nf3', 'Wit ontwikkelt.'],
          ['Nc6', 'Jij ook.'],
          'O-O',
          ['Be7', 'Je ontwikkelt de loper.'],
        ],
      },
    ],
  },
  {
    id: 'reti-d5',
    name: 'Reti: ...d5 en ...Nf6',
    side: 'black',
    vs: '1.Nf3',
    eco: 'A09',
    tagline: 'Tegen 1.Nf3 speel je gewoon klassiek met ...d5.',
    level: 1,
    thumb: 12,
    ideas: [
      'Je pakt het centrum met ...d5 en ontwikkelt je stukken naar natuurlijke velden.',
      'Wit speelt vaak flexibel (g3, Bg2, d3): jij blijft solide met ...e6 en ...c5.',
      'Waak voor tijdverlies: je hoeft geen pionnen te forceren.',
    ],
    pitfalls: [
      'Laat je niet verleiden tot een zet als ...e5 voordat je ontwikkeld bent.',
      'Vergeet de zwakke plek op c5 niet na wits fianchetto.',
    ],
    line: [
      ['Nf3', 'De Reti-opening: wit houdt zijn opties open.'],
      ['d5', 'Je pakt het centrum direct.'],
      ['g3', 'Wit fianchetteert zijn loper.'],
      ['Nf6', 'Je ontwikkelt.'],
      ['Bg2', 'Wit ontwikkelt de loper.'],
      ['e6', 'Je steunt d5 en maakt de loper van c8 los via d7.'],
      'O-O',
      ['Be7', 'Je ontwikkelt.'],
      ['d3', 'Wit steunt het centrum.'],
      ['O-O', 'Je zet je koning veilig.'],
      ['Nbd2', 'Wit ontwikkelt.'],
      ['c5', 'Je pakt ruimte en bouwt een compact centrum.'],
      ['e4', 'Wit pakt het centrum.'],
      ['Nc6', 'Je ontwikkelt en zet druk op d4.'],
    ],
    branches: [
      {
        from: 2,
        title: 'Wit speelt 2.d4',
        steps: [
          ['d4', 'Wit bouwt het centrum.'],
          ['Nf6', 'Je ontwikkelt.'],
          ['c4', 'Wit speelt het gambiet.'],
          ['e6', 'Je steunt d5 en transponeert naar een Geweigerd Damegambiet.'],
          ['Nc3', 'Wit ontwikkelt.'],
          ['Be7', 'Je ontwikkelt.'],
          ['Bg5', 'Wit pend je paard.'],
          ['h6', 'Je vraagt de loper wat hij van plan is.'],
        ],
      },
    ],
  },

  /* ================= WIT ================= */
  {
    id: 'italian',
    name: 'Italiaans (Giuoco Pianissimo)',
    side: 'white',
    vs: '1.e4',
    eco: 'C54',
    tagline: 'De klassieke manier om met wit rustig en slim te beginnen.',
    level: 1,
    thumb: 11,
    ideas: [
      'Je ontwikkelt snel, mikt op f7 en bouwt langzaam een sterk centrum met c3 en d3.',
      'De rustige opzet (Pianissimo) vraagt weinig theorie en geeft toch een goede stelling.',
      'Het plan: rokeer, speel Re1, Nbd2-f1-g3 en maak ruimte voor d4 of een aanval op de koningsvleugel.',
    ],
    pitfalls: [
      'Speel niet te snel d4 als je stukken nog niet klaar zijn.',
      'Let op de zet ...d5 van zwart: die kan je centrum snel verstoren.',
    ],
    line: [
      ['e4', 'Je pakt het centrum en opent lijnen voor loper en dame.'],
      ['e5', 'Zwart antwoordt symmetrisch.'],
      ['Nf3', 'Je ontwikkelt met tempo: je valt de pion op e5 aan.'],
      ['Nc6', 'Zwart verdedigt de pion.'],
      ['Bc4', 'De Italiaanse loper. Hij mikt op de zwakke plek f7.'],
      ['Bc5', 'Zwart spiegelt: de Giuoco Piano.'],
      ['c3', 'Je bereidt d4 voor om het centrum te veroveren.'],
      ['Nf6', 'Zwart ontwikkelt en valt e4 aan.'],
      ['d3', 'De rustige route: je dekt e4 en houdt de stelling gesloten. Dat is het Pianissimo-plan.'],
      ['d6', 'Zwart steunt het centrum.'],
      ['O-O', 'Je koning is veilig.'],
      ['O-O', 'Zwart doet hetzelfde.'],
      ['Re1', 'De toren steunt de pion op e4.'],
      ['a6', 'Zwart wil ...Ba7 spelen om de loper veilig te houden.'],
      ['Bb3', 'Je loper trekt zich terug en blijft op de diagonaal.'],
      ['Ba7', 'Zwart zet zijn loper veilig.'],
      ['h3', 'Je neemt g4 weg van zwarts loper en bereidt Nbd2 voor.'],
      ['h6', 'Zwart doet hetzelfde.'],
      ['Nbd2', 'Je ontwikkelt je laatste stuk naar f1 en g3.'],
      ['Re8', 'Zwart steunt de e-pion.'],
    ],
    branches: [
      {
        from: 5,
        title: 'Zwart speelt 3...Nf6 (Twee Paarden)',
        steps: [
          ['Nf6', 'Zwart speelt de Twee Paarden-verdediging. Hij valt e4 aan.'],
          ['d3', 'Je speelt rustig en voorkomt scherpe complicaties.'],
          ['Be7', 'Zwart ontwikkelt.'],
          'O-O',
          'O-O',
          ['c3', 'Je bereidt d4 voor.'],
          ['d6', 'Zwart steunt het centrum.'],
        ],
      },
      {
        from: 5,
        title: 'Zwart speelt 3...Be7 (Hongaarse verdediging)',
        steps: [
          ['Be7', 'Een passieve zet. Je kunt het centrum meteen innemen.'],
          ['d4', 'Je pakt het centrum.'],
          ['exd4', 'Zwart slaat.'],
          ['Nxd4', 'Je slaat terug en staat actief.'],
          ['Nf6', 'Zwart ontwikkelt.'],
          ['Nxc6', 'Je ruilt het paard af.'],
          ['bxc6', 'Zwart slaat terug.'],
          ['e5', 'Je jaagt het paard weg met winst van tijd.'],
          ['Nd5', 'Het paard komt centraal.'],
          'O-O',
          'O-O',
        ],
      },
    ],
  },
  {
    id: 'ruy-lopez',
    name: 'Spaans (Ruy Lopez)',
    side: 'white',
    vs: '1.e4',
    eco: 'C92',
    tagline: 'De meest klassieke opening: langzame druk op het centrum.',
    level: 2,
    thumb: 14,
    ideas: [
      'Je loper valt het paard op c6 aan dat e5 verdedigt. Dat levert druk op e5 op.',
      'Je bouwt rustig een sterk centrum met c3, d4 en h3.',
      'Het plan: rokeer, speel Re1, c3, d4 en een langdurige druk op het centrum.',
    ],
    pitfalls: [
      'Ruil het paard op c6 niet te vroeg zonder een reden.',
      'In de Berlijnse verdediging is het spel positioneel; wees geduldig in het eindspel.',
    ],
    line: [
      ['e4', 'Je pakt het centrum.'],
      ['e5', 'Zwart antwoordt symmetrisch.'],
      ['Nf3', 'Je ontwikkelt en valt e5 aan.'],
      ['Nc6', 'Zwart verdedigt de pion.'],
      ['Bb5', 'De Spaanse loper. Hij valt het paard aan dat e5 verdedigt.'],
      ['a6', 'De Morphy-verdediging. Zwart vraagt je loper wat hij wil.'],
      ['Ba4', 'Je behoudt de spanning en de pin op het paard.'],
      ['Nf6', 'Zwart ontwikkelt en valt e4 aan.'],
      ['O-O', 'Je zet je koning veilig.'],
      ['Be7', 'Zwart ontwikkelt en bereidt rokade voor.'],
      ['Re1', 'De toren steunt de e-pion, zodat je het paard op f6 niet hoeft te vrezen.'],
      ['b5', 'Zwart jaagt de loper weg.'],
      ['Bb3', 'Je loper trekt zich terug naar een goede diagonaal.'],
      ['d6', 'Zwart steunt het centrum.'],
      ['c3', 'Je bereidt d4 voor.'],
      ['O-O', 'Zwart zet zijn koning veilig.'],
      ['h3', 'Een belangrijke wachtzet: je neemt g4 weg van een loper en bereidt d4 voor.'],
      ['Nb8', 'De Breyer-verdediging: het paard hergroepeert via d7.'],
      ['d4', 'Je zet je centrum in beweging.'],
      ['Nbd7', 'Zwart ontwikkelt het paard naar een betere plek.'],
    ],
    branches: [
      {
        from: 5,
        title: 'Zwart speelt 3...Nf6 (Berlijnse verdediging)',
        steps: [
          ['Nf6', 'De Berlijnse Muur: een rotsvaste opzet van zwart.'],
          ['O-O', 'Je rokeert en laat zwart de pion e4 pakken.'],
          ['Nxe4', 'Zwart pakt de pion.'],
          ['d4', 'Je opent het centrum.'],
          ['Nd6', 'Het paard trekt zich terug.'],
          ['Bxc6', 'Je ruilt het paard af.'],
          ['dxc6', 'Zwart slaat terug.'],
          ['dxe5', 'Je slaat de pion.'],
          ['Nf5', 'Zwart pakt actief.'],
          ['Qxd8+', 'Je ruilt de dames. Dit is het beroemde Berlijnse eindspel.'],
          ['Kxd8', 'Zwart slaat terug. Zwart heeft zijn rokaderecht kwijt, maar de stelling is solide.'],
        ],
      },
      {
        from: 9,
        title: 'Zwart pakt direct de pion: 5...Nxe4 (Open Spaans)',
        steps: [
          ['Nxe4', 'Zwart pakt de pion en kiest voor een open spel.'],
          ['d4', 'Je opent het centrum.'],
          ['b5', 'Zwart jaagt de loper weg.'],
          ['Bb3', 'Je loper trekt zich terug.'],
          ['d5', 'Zwart pakt het centrum.'],
          ['dxe5', 'Je slaat de pion.'],
          ['Be6', 'Zwart ontwikkelt de loper en dekt d5.'],
          ['c3', 'Je bereidt Nbd2 voor.'],
          ['Bc5', 'Zwart ontwikkelt.'],
          ['Nbd2', 'Je ontwikkelt het paard.'],
          'O-O',
          ['Bc2', 'Je loper blijft op de diagonaal.'],
          ['Bf5', 'Zwart ontwikkelt actief.'],
        ],
      },
    ],
  },
  {
    id: 'london',
    name: 'London Systeem',
    side: 'white',
    vs: '1.d4',
    eco: 'D02',
    tagline: 'Een opstelling die je bijna altijd kunt spelen, zonder veel theorie.',
    level: 1,
    thumb: 12,
    ideas: [
      'Je speelt vrijwel altijd dezelfde zetten: d4, Bf4, e3, Nf3, Bd3, c3, Nbd2.',
      'Je loper komt buiten de pionnenketen, voor e3. Dat is de kern van het systeem.',
      'Je kunt tegen veel verschillende openingen van zwart dezelfde opzet gebruiken.',
    ],
    pitfalls: [
      'Let op de aanval ...c5 en ...Qb6 op je pion b2.',
      'Speel niet te automatisch: kijk wat zwart doet en pas je plan aan.',
    ],
    line: [
      ['d4', 'Je pakt het centrum met de damepion.'],
      ['d5', 'Zwart antwoordt symmetrisch.'],
      ['Bf4', 'De London. Je loper komt buiten de pionnenketen, voordat je e3 speelt.'],
      ['Nf6', 'Zwart ontwikkelt.'],
      ['e3', 'Je steunt het centrum en opent de diagonaal van je loper.'],
      ['e6', 'Zwart steunt d5.'],
      ['Nf3', 'Je ontwikkelt.'],
      ['Bd6', 'Zwart wil je loper ruilen.'],
      ['Bg3', 'Je ontwijkt de ruil en houdt je loper op de diagonaal.'],
      ['O-O', 'Zwart rokeert.'],
      ['Nbd2', 'Je ontwikkelt het laatste stuk en bereidt c3 voor.'],
      ['c5', 'Zwart valt je centrum aan.'],
      ['c3', 'Je steunt d4. Je stelling is solide.'],
      ['Nc6', 'Zwart ontwikkelt en zet druk op d4.'],
      ['Bd3', 'Je loper komt naar een mooie diagonaal.'],
      ['b6', 'Zwart ontwikkelt de loper naar b7.'],
      ['Qe2', 'Je dame bereidt e4 voor.'],
      ['Bb7', 'Zwart ontwikkelt zijn loper.'],
    ],
    branches: [
      {
        from: 3,
        title: 'Zwart speelt 2...c5',
        steps: [
          ['c5', 'Zwart valt je centrum meteen aan.'],
          ['e3', 'Je steunt het centrum.'],
          ['Nc6', 'Zwart ontwikkelt.'],
          ['c3', 'Je steunt d4 en bereidt Nd2 voor.'],
          ['Nf6', 'Zwart ontwikkelt.'],
          ['Nd2', 'Je ontwikkelt.'],
          ['e6', 'Zwart steunt d5.'],
          ['Ngf3', 'Je ontwikkelt.'],
          ['Bd6', 'Zwart ontwikkelt de loper.'],
          'Bg3',
          'O-O',
        ],
      },
      {
        from: 1,
        title: 'Zwart speelt 1...Nf6',
        steps: [
          ['Nf6', 'Zwart ontwikkelt en houdt zijn opties open.'],
          ['Bf4', 'Je speelt dezelfde opzet.'],
          ['g6', 'Zwart kiest voor een Koningsindiase opzet.'],
          ['e3', 'Je steunt het centrum.'],
          ['Bg7', 'Zwart ontwikkelt de loper.'],
          ['Nf3', 'Je ontwikkelt.'],
          'O-O',
          ['h3', 'Je neemt g4 weg van zwarts paard of loper.'],
          ['d6', 'Zwart steunt het centrum.'],
          ['Be2', 'Je ontwikkelt de loper.'],
          ['Nbd7', 'Zwart ontwikkelt.'],
          'O-O',
        ],
      },
    ],
  },
  {
    id: 'queens-gambit',
    name: 'Damegambiet',
    side: 'white',
    vs: '1.d4',
    eco: 'D35',
    tagline: 'Strijd om het centrum met een pionoffer dat je terugkrijgt.',
    level: 2,
    thumb: 10,
    ideas: [
      'Je biedt de c-pion aan om de d-pion van zwart af te lokken en het centrum te veroveren.',
      'Als zwart op c4 pakt, kun je de pion bijna altijd terugwinnen terwijl je stukken ontwikkelt.',
      'Je krijgt een ruim centrum en veel kansen op initiatief.',
    ],
    pitfalls: [
      'Speel niet te vroeg e4 zonder stukken: zwart kan je centrum aanvallen.',
      'Haast je niet om de pion terug te winnen: ontwikkel eerst.',
    ],
    line: [
      ['d4', 'Je pakt het centrum.'],
      ['d5', 'Zwart antwoordt symmetrisch.'],
      ['c4', 'Het Damegambiet. Je valt het centrum van zwart aan.'],
      ['e6', 'Zwart weigert het gambiet en steunt d5.'],
      ['Nc3', 'Je ontwikkelt en zet druk op d5.'],
      ['Nf6', 'Zwart ontwikkelt.'],
      ['Bg5', 'Je pend het paard en verhoogt de druk op d5.'],
      ['Be7', 'Zwart ontwikkelt.'],
      ['e3', 'Je steunt het centrum.'],
      ['O-O', 'Zwart rokeert.'],
      ['Nf3', 'Je ontwikkelt.'],
      ['h6', 'Zwart vraagt je loper wat hij wil.'],
      ['Bh4', 'Je behoudt de pin.'],
      ['b6', 'Zwart bereidt ...Bb7 voor.'],
      ['cxd5', 'Je ruilt de spanning.'],
      ['Nxd5', 'Zwart slaat terug.'],
      ['Bxe7', 'Je ruilt de lopers.'],
      ['Qxe7', 'Zwart slaat terug.'],
      ['Nxd5', 'Je ruilt het paard.'],
      ['exd5', 'Zwart slaat terug. Daarna speel je Rc1 en zoek je druk op de c-lijn.'],
    ],
    branches: [
      {
        from: 3,
        title: 'Zwart speelt 2...c6 (Slavisch)',
        steps: [
          ['c6', 'De Slavische Verdediging.'],
          ['Nf3', 'Je ontwikkelt.'],
          ['Nf6', 'Zwart ontwikkelt.'],
          ['Nc3', 'Je zet druk op d5.'],
          ['dxc4', 'Zwart pakt de pion.'],
          ['a4', 'Je voorkomt ...b5.'],
          ['Bf5', 'Zwart ontwikkelt zijn loper.'],
          ['e3', 'Je bereidt de herovering voor.'],
          ['e6', 'Zwart steunt het centrum.'],
          ['Bxc4', 'Je wint de pion terug.'],
          ['Bb4', 'Zwart zet druk op e4.'],
          'O-O',
          ['Nbd7', 'Zwart ontwikkelt.'],
        ],
      },
      {
        from: 3,
        title: 'Zwart pakt de pion: 2...dxc4',
        steps: [
          ['dxc4', 'Zwart pakt de pion. Je krijgt hem terug.'],
          ['Nf3', 'Je ontwikkelt en bereidt e3 voor.'],
          ['Nf6', 'Zwart ontwikkelt.'],
          ['e3', 'Je bereidt Bxc4 voor.'],
          ['e6', 'Zwart steunt het centrum.'],
          ['Bxc4', 'Je wint de pion terug.'],
          ['c5', 'Zwart valt het centrum aan.'],
          'O-O',
          ['a6', 'Zwart bereidt ...b5 voor.'],
          ['Qe2', 'Je bereidt Rd1 en Bb3 voor.'],
          ['b5', 'Zwart jaagt de loper weg.'],
          ['Bb3', 'Je loper trekt zich terug.'],
          ['Nc6', 'Zwart ontwikkelt.'],
        ],
      },
    ],
  },
];

export const byId = (id: string) => COURSES.find((c) => c.id === id);

/* ---------- boom ---------- */
export interface TNode {
  san: string;
  note?: string;
  /** titel van de variant waarmee deze zet begint */
  label?: string;
  main: boolean;
  /** halve zet nummer (1 = eerste zet van wit) */
  ply: number;
  kids: TNode[];
}

const text = (m: Mv) => (typeof m === 'string' ? { san: m } : { san: m[0], note: m[1] });

export function buildTree(c: Course): TNode {
  const root: TNode = { san: '', main: true, ply: 0, kids: [] };
  const add = (parent: TNode, m: Mv, main: boolean, label?: string): TNode => {
    const { san, note } = text(m);
    let n = parent.kids.find((k) => k.san === san);
    if (!n) {
      n = { san, note, main, ply: parent.ply + 1, kids: [] };
      if (label) n.label = label;
      parent.kids.push(n);
    } else {
      if (!n.note && note) n.note = note;
      if (label && !n.label) n.label = label;
    }
    return n;
  };
  let cur = root;
  const mainNodes: TNode[] = [root];
  for (const m of c.line) {
    cur = add(cur, m, true);
    mainNodes.push(cur);
  }
  for (const b of c.branches) {
    if (!b.steps.length) continue;
    let p = mainNodes[b.from];
    b.steps.forEach((m, i) => {
      p = add(p, m, false, i === 0 ? b.title : undefined);
    });
  }
  return root;
}

export const LEVEL = ['', 'Beginner', 'Gemiddeld', 'Gevorderd'];
