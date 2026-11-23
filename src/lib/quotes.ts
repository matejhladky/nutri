/** Deadpan quotes under the greeting on Dnes. One is picked per app load (refresh / reopen), not per render. */
export const QUOTES = [
  "V životě nemůžeš mít všechno. Zejména ne všechny esenciální aminokyseliny z každého zdroje.",
  "Nejde o to vědět všechno. Jde o to vědět, co dělá slinivka.",
  "Moudrost přichází s věkem. Energie s ATP.",
  "Všechno má svůj čas. I vstřebávání železa.",
  "Nejdůležitější věci v životě jsou neviditelné. Například inzulin.",
  "Skutečná síla není v tom nikdy neselhat. Je v tom vědět, co je glukoneogeneze.",
  "Když nevíš, co dělat, dělej to, co jsi dělala předtím, ale lépe.",
  "Úspěch se nedostaví sám. Někdy se nedostaví vůbec.",
  "Život není soutěž. Přesto někteří prohrávají.",
  "Poznat sám sebe znamená přijmout i své tenké střevo.",
  "I Sisyfos by to bez glykogenu dal jen těžko.",
  "Na cestě k osvícení se nelze vyhnout Krebsovu cyklu.",
  "Kdo ovládne svou mysl, je teprve na začátku. Zbývá ještě endokrinní systém.",
  "Ne všechny životní krize jsou existenciální. Některé jsou metabolické.",
  "Velké civilizace vznikaly a zanikaly. Slinivka pracovala dál.",
  "Aristoteles o glukoneogenezi mlčel. Dodnes nevíme proč.",
  "Řekni mi, jak funguje tvůj metabolismus, a já ti řeknu, kdo jsi.",
  "Někteří lidé hledají odpovědi v knihách, jiní v sobě. Obojí je při studiu fyziologie přijatelné.",
  "Člověk míní, pankreas mění.",
  "Do téže řeky dvakrát nevstoupíš. Do Krebsova cyklu ano.",
  "Myslím, tedy jsem. Trávím, tedy ještě chvíli budu.",
  "Kdo hledí příliš dlouho do propasti, zjistí, že má hlad.",
  "Všechno plyne, ale ne všechno se vstřebá.",
  "Nesnaž se zastavit řeku ani peristaltiku.",
  "Před osvícením: štípat dříví, nosit vodu. Po osvícení: štípat dříví, nosit vodu, rozumět metabolismu.",
  "Nezáviděj bližnímu svému jeho bazální metabolismus.",
  "Blahoslavení, kdo nezaměňují glykogen za glukagon.",
  "A Bůh viděl, že je to dobré. O glykemickém indexu se nezmínil.",
  "Jako v nebi, tak i v cytoplazmě.",
  "Člověk nežije jen chlebem. Tato skutečnost je podrobně rozvedena v kapitole o makroživinách.",
  "Z prachu jsi povstal a v prach se obrátíš. Mezitím probíhá buněčné dýchání.",
  "Ve jménu Otce i Syna i střevního mikrobiomu.",
];

// Module state lives for the whole client session: navigation keeps the quote, a reload picks a new one.
let picked: string | undefined;
export const pickQuote = () => (picked ??= QUOTES[Math.floor(Math.random() * QUOTES.length)]);
