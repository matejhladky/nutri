# Independent verification of the R4 audit (G1–G7)

Scope: every Safety & health item logged `corrected` / `disputed` / `could not verify`, every changed point with
`safety: true`, plus cross-bank consistency checks (vitamin D limits, caffeine, alcohol, iron and iodine in pregnancy,
liver/retinol, coeliac/oats, hypoglycaemia, warfarin, supervisory bodies). Sources were re-opened or re-searched
independently, not taken from the logs. Final `pnpm content:check` (full): 0 errors, 491 points, 1118 exercises
(72 page-range warnings only).

Format: point id · verdict · source · one line.

## G1 – úvod, sacharidy, tuky, bílkoviny, alkohol

- alk.tolerovatelna-davka · confirmed · https://www.who.int/europe/news/item/04-01-2023-no-level-of-alcohol-consumption-is-safe-for-our-health · "no safe level" correct; the Czech limits are given as examples ("např."); the MCQ still says "podle skript".
- alk.klient · confirmed · own calculation (0,5 l 12° ≈ 210 kcal × 8 × 52 ≈ 11 kg fat equivalent) · the "teoreticky" wording is accurate.
- uv.poradce-temata · confirmed · consistent with prx.hranice-kompetenci / nem.kompetence · the new key "lékař nebo nutriční terapeut" is correct practice, and the script's answer (NT) is part of it.
- sach.glykemie-norma · confirmed · https://www.diab.cz/wp-content/uploads/dokumenty/prediabetes_doporuceny_postup.pdf · fasting venous plasma: < 5,6 normal, 5,6–6,9 IFG, ≥ 7,0 suspected DM. Matches prx.hranice-kompetenci (6,5 = above normal) and nem.glykemie-hba1c.
- sach.laktozova-intolerance · confirmed · NIDDK / standard practice · the added step of confirming with a doctor and ruling out milk-protein allergy is correct; prevalence is labelled "podle skript".
- tuk.prijem · confirmed · EFSA 2010 fats DRV (RI 20–35 % E) · the course's 25–35 % falls inside the EFSA range.
- tuk.sfa · confirmed · https://www.ncbi.nlm.nih.gov/books/NBK594779/ (WHO 2023 SFA/TFA guideline) · SFA ≤ 10 % E, replaced by PUFA/MUFA or by carbohydrate from fibre-rich foods.
- tuk.cholesterol · confirmed · https://academic.oup.com/eurheartj/article/41/1/111/5556353 (ESC/EAS 2019) · "< 300 mg/day, especially with high plasma cholesterol". Framing it as an upper limit is correct; the v2 MCQ key still matches the explanation.
- tuk.n3-ucinky · confirmed · Reg. (EU) 432/2012 claims (EPA+DHA heart 250 mg, BP 3 g, TAG 2 g; DHA brain/vision); Cochrane CD003177.pub5 · reframing as course-disputed is accurate; the anticoagulant caution is kept.
- bil.prijem-zvyseny / bil.porce · confirmed · https://www.kidney-international.org/article/S0085-2538(23)00764-0/fulltext (KDIGO 2024: avoid > 1,3 g/kg in CKD) · the "kidney disease → doctor" rule is correct; no contradiction with kaz.senior or nem.dm2-strava.

## G2 – vitaminy, minerály, fytochemikálie

- vit.a · confirmed · EFSA 2024 UL retinol 3000 µg (incl. pregnancy) https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2024.8814 ; NHS foods to avoid · the new `tehotna-praxe` key (check retinol in supplements, no liver) is correct and matches dpl.tehotenstvi and obd.folat.
- vit.k · confirmed · https://www.nhs.uk/medicines/warfarin/ · stable intake, no sudden changes, discuss with the doctor. The new distractor ("střídat dny") is a plausible error with a correct explanation.
- vit.hypo-hyper · confirmed · NIH ODS Vitamin D fact sheet · sun exposure does not cause vitamin D toxicity.
- vit.d-prijem · confirmed · EFSA DRV summary (AI 15 µg); EFSA 2023 UL 100 µg · the UL distractor and its explanation are correct, and consistent with dpl.vitamin-d.
- vit.folat · confirmed · NHS foods to avoid (liver in pregnancy) · the explain answer no longer suggests liver; consistent with obd.folat.
- vit.c · confirmed · NIH ODS Vitamin C · the kidney-stone note is correctly labelled as an addition.
- min.zelezo-nedostatek · confirmed · https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2015.4254 · PRI 11/16 mg; pregnancy and lactation 16 mg; the hereditary haemochromatosis wording is correct.
- min.jod · confirmed · EFSA 2014 iodine DRV (AI 150, pregnancy/lactation 200 µg, UL 600 µg) · consistent with obd.tehotenstvi-mikro.
- dop.fytosteroly · confirmed · ESC/EAS 2019 (2 g/day → LDL −7–10 %); Reg. 1169/2011 Annex III 5.1 (not for people without a need to lower cholesterol; possibly unsuitable in pregnancy, lactation and children < 5) · correct.
- dop.karotenoidy / dop.zdrava13 · confirmed · ATBC/CARET; vyzivaspol.cz Zdravá 13 · the beer volumes in the distractors are proportional to Zdravá 13's own conversion (20 g ≈ 0,5 l).

## G3 – tělo, metabolismus

- telo.zlucove-kameny · confirmed · https://www.niddk.nih.gov/health-information/digestive-diseases/gallstones/symptoms-causes (+ NIDDK dieting page) · NIDDK does not list fluids or constipation; the new `rychle-hubnuti` key (gradual weight loss) is correct.
- telo.acidobaze · confirmed · Fenton et al. JBMR 2009 · the claim is attributed to the script and is not tested.

## G4 – potraviny (legislation)

- pot.datum-spotreby-dmt · confirmed · https://www.zakonyprolidi.cz/cs/1997-110 (§ 10 odst. 2: after DMT only if labelled, kept separate and safe) · the added "jen je-li stále bezpečná" is verbatim law content.
- pot.etiketa-povinne · confirmed · Reg. 1169/2011 Art. 9, 22, 26 · QUID, country of origin and special storage conditions are stated correctly.
- pot.slozeni-poradi · confirmed · 1169/2011 Annex VII · < 2 % in any order.
- pot.pridana-voda · confirmed · 1169/2011 Annex VII A1, VI A6, IX · 5 % rule, with the meat and unprocessed fish exception.
- pot.alergeny · confirmed · 1169/2011 Art. 21 · emphasis within the ingredients list; "contains" only without a list; "may contain" is voluntary. Oats listed as a gluten cereal matches Annex II (no conflict with nem.celiakie, which deals with diet).
- pot.aditiva-legislativa · confirmed · Reg. 1331/2008, 1333/2008; efsa.europa.eu Food additives · the Commission and Member States authorise, EFSA assesses.
- pot.aditiva-oznaceni · confirmed · 1169/2011 Annex VII C/D; 1334/2008 Art. 16 · "aroma", and "přírodní" only under Art. 16.
- pot.aditiva-upozorneni · confirmed · 1169/2011 Annex III (sweeteners, aspartame, polyols > 10 %); 1333/2008 Annex V (E102, E104, E110, E122, E124, E129) · correct.
- pot.aditiva-co-neni-e · confirmed · 1169/2011 Annex VII C footnote · modified starch may be declared without an E number.
- pot.aromata · confirmed · Reg. 2018/848 Annex II Part IV · organic food may use only natural flavourings.
- pot.tvrzeni-cukry · confirmed · Reg. 1924/2006 Annex · "bez cukrů" ≤ 0,5 g/100 g; "bez přídavku cukrů" plus the naturally-occurring-sugars statement. "neslazeno" is kept as "podle skript".
- pot.razitko-puvod-masa · confirmed · Reg. 853/2004 Annex II; Reg. 1337/2013 Art. 5 · oval mark; "původ" only when born, reared and slaughtered in one country.
- pot.chranene-nazvy · confirmed · 1333/2008 Annex II cat. 02.2.1 · butter may contain E160a and E500.
- pot.dozor-cr / pot.dozor-khs-coi · confirmed · zákon 110/1997 § 14 odst. 1 (KHS, MO, MV; SVS; SZPI — law text checked); zákon 321/2024 Sb. moving restaurant supervision to SZPI from 1 Jan 2025 (https://www.vitalia.cz/clanky/krajske-hygieny-prisly-o-kompetence-uz-nebudou-kontrolovat-hospody-a-bistra/, svet-potravin.cz) · ČOI correctly removed as a food supervisory body. Consistent with dpl.notifikace.
- pot.haccp-codex · confirmed · Reg. 852/2004 Art. 5; FAO/WHO Codex · correct.
- pot.bio-co-je · confirmed · Reg. 2018/848 Art. 9(4) · ionising radiation ban; the remaining claims are kept as "podle skript".
- pot.bio-logo · confirmed · https://www.zakonyprolidi.cz/cs/2000-242 § 23 (version of 1 Oct 2022) · biozebra mandatory only on packaged organic food certified in CZ and not intended for foreign markets.
- pot.bio-rizika · softened · Barański et al., Br J Nutr 2014; EFSA 2010 nitrates · the explanation still stated the script's "more nitrates in BIO" as fact. It is now attributed to the script and adds that studies find less nitrate in BIO.
- pot.gmo-eu · confirmed · https://food.ec.europa.eu/plants/genetically-modified-organisms/traceability-and-labelling_en · GMO always labelled; 0,9 % only for adventitious presence, per ingredient; products from GM-fed animals are not labelled.

## G5 – doplňky, pitný režim, přizpůsobení, alternativní směry

- dpl.definice · confirmed · https://sukl.gov.cz/dulezite-informace/zmena-rozhodovaci-praxe-v-pripadech-vyrobku-s-obsahem-vitaminu-d-2/ (≤ 4000 IU not a medicine, 2024; 2000 IU in 2022; 1000 IU before) · the v2 MCQ ("dávka rozhoduje") is valid under both readings.
- dpl.notifikace · confirmed · https://mze.gov.cz/public/portal/mze/potraviny/doplnky-stravy ; vyhláška 368/2024 Sb. in force 1 Jul 2025 · correct.
- dpl.zakazane-latky · confirmed · https://www.kmvs.cz/newsroom/farmacie/novela-vyhlasky-o-doplncich-stravy-ucinna-od-01072025 ; ALS summary · melatonin (≤ 0,5 mg/day), DHEA and 5-HTP removed from the national ban list (DHEA and 5-HTP fall under EU novel-food rules). The MCQ is correctly labelled "stav před novelou".
- dpl.rizika (safety) · confirmed · EFSA ULs: B6 12 mg (2023), retinol 3000 µg (2024), D 100 µg (2023) · correct.
- dpl.rozhodovaci-ramec / dpl.red-flags / dpl.interakce (safety) · confirmed · NHS warfarin; standard referral practice · unchanged and safe.
- dpl.tehotenstvi (safety) · fixed · EFSA 2014 iodine (pregnancy 200 µg); WHO 250 µg · the explanation gave "až 220–250 µg" as the only figure. It now reads "skripta 220–250 µg, EFSA 200 µg", consistent with min.jod and obd.tehotenstvi-mikro. NICE CG62 (avoid retinol supplements and liver) confirmed.
- dpl.zelezo (safety) · confirmed · WHO ANC 2016 (30–60 mg); CDC 30 mg · "the doctor decides the dose" is correct; does not conflict with the EFSA 16 mg intake figure (different concept, both labelled).
- dpl.vitamin-d · confirmed · SÚKL (above); EFSA 2023 UL · the 4000 IU key point is correct.
- dpl.deti · confirmed · ČPS/OSPDL 2019; EFSA 2023 UL children 1–10 y 50 µg · correct.
- dpl.omega3 · confirmed · EFSA 2012 (up to 5 g/day supplemental EPA+DHA safe); FDA (≤ 3 g/day total, ≤ 2 g from supplements) · correct.
- dpl.spalovace · confirmed · Reg. (EU) 2022/2340 (< 800 mg EGCG per daily portion, warnings) · correct.
- dpl.protein-davka · confirmed · Morton et al. BJSM 2018; ISSN 2017 · 1,8 g/kg correctly framed as a script value, not a recognised safety limit.
- pit.kofein-limity (safety) · confirmed · EFSA 2015 caffeine opinion (400 mg/day, 200 mg single dose, 200 mg pregnancy and lactation, children 3 mg/kg) · the v2 key "nejvýš 400 mg" is consistent with dpl.kofein, spo.kofein and obd.tehotenstvi-rizika.
- pit.nestandardni · confirmed · ESPEN 2019 geriatrics (1,6 / 2,0 l) · correct.
- alt.veganstvi-rizika · confirmed · https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12580465/ (Verduci et al., ESPGHAN 2025); https://www.jandonline.org/article/S2212-2672(25)00042-5/abstract (AND 2025: adults, non-pregnant, non-lactating) · the correction about the misattributed AND scope is right.
- obd.veganstvi-deti · confirmed · ESPGHAN 2025 (above) · the "could not verify year" item is now verified: published 2025, JPGN 81:1318.
- alt.carnivore · confirmed · no guideline support · the note is appropriately cautious.
- alt.prerusovany-pust · confirmed · the AND statement is marked as unverified; the safety core (insulin or sulfonylurea → hypoglycaemia → doctor) is correct.
- alt.keto · confirmed · EMA/FDA SGLT2i DKA warnings · correct.

## G6 – poradenství, energetická bilance, praxe, kazuistiky

- por.bia-kontraindikace (safety) · confirmed · manufacturer and clinical protocols · correct and conservative.
- por.obvod-pasu / kaz.diagnosticky-zaver · confirmed · WHO 2008 expert consultation (F > 80 / > 88, M > 94 / > 102) · the case parameters (waist 90–96) give the same verdict under both readings.
- por.deti-percentily · softened · SZÚ growth charts (0–18 y); ČPS 2025 classification · two distractor explanations stated "percentily se používají až do 20 let" as fact. They now say "Skripta uvádějí…"; the key stays the script answer and the prompt already says "podle skript".
- en.energeticka-dostupnost / kaz.energeticka-dostupnost (safety) · confirmed · IOC 2023 REDs consensus (Mountjoy et al., BJSM 2023) · no fixed thresholds, so 45/40 is correctly attributed to the script. Recomputed parameter extremes: max ED = (2000 − 520) / 38,48 = 38,5 < 40, so the key holds.
- prx.ppp-podezreni (safety) · confirmed · https://www.nice.org.uk/guidance/ng69 · specialist referral plus prompt GP review of physical risk.
- prx.hranice-kompetenci / prx.red-flags-lekar / prx.red-flags-psychika / prx.agresivni (safety) · confirmed · WHO/IDF 2006; NICE NG12; Czech emergency numbers 155/112/158 (HZS ČR) · no invented crisis-line number.
- kaz.red-flags / kaz.ppp (safety) · confirmed · ADA hyperglycaemic crisis; NICE NG69 · keys and explanations agree.
- kaz.senior · confirmed · ESPEN 2019; PROT-AGE 2013 · the CKD exception is correct.

## G7 – sport, období života, nemoci

- spo.red-s (safety) · confirmed · IOC 2023 · correct.
- obd.folat · confirmed · WHO periconceptional folic acid 400 µg; NHS (no liver) · consistent with vit.folat and dpl.tehotenstvi.
- obd.tehotenstvi-mikro (safety) · confirmed · EFSA iodine 2014, iron 2015 · correct.
- obd.tehotenstvi-rizika (safety) · confirmed · EFSA 2015 caffeine; NHS foods to avoid · correct. (Minor: albacore "bílý tuňák" is a script example; NHS limits tuna rather than banning it. Left as is, not tested as a key.)
- obd.prikrmy · confirmed · ESPGHAN 2017 (17–26 weeks; no honey < 12 months); EAACI 2020 (egg and peanut with complementary feeding) · correct.
- obd.anorexie / obd.bulimie / obd.ppp-znaky / obd.ppp-role-poradce (safety) · confirmed · ICD-10 F50.0 (BMI ≤ 17,5); ICD-11 6B80 (< 18,5) · correct.
- nem.dm2-strava (safety) · confirmed · ADA 2019 nutrition consensus; EMA PRAC / FDA SGLT2i DKA · correct.
- nem.dm-akutni-stavy (safety) · confirmed · ADA Standards of Care ch. 6 (15–20 g glucose, recheck at 15 min) · correct; "nothing by mouth when unconscious, call 155" is standard first aid.
- nem.warfarin (safety) · fixed · https://www.nhs.uk/medicines/warfarin/ ("do not drink grapefruit juice", "do not have cranberry juice", "do not take St John's wort or vitamin K supplements") · the explanation and key point said "jen po poradě s lékařem", which is weaker than the source. Now aligned with NHS. `vysvetli` → version 2. The why-text of the supplement distractor is aligned too.
- nem.celiakie · confirmed · Reg. (EU) 828/2014 (oats in "gluten-free" ≤ 20 mg/kg, specially produced) · consistent with nem.bezlepkova-dieta (oats only "bez lepku", in remission, under a doctor).
- nem.celiakie-diagnostika (safety) · confirmed · ESPGHAN 2020 · test only while gluten is still eaten.
- nem.kompetence (safety) · confirmed · script p. 238 · correct.
- nem.dietni-system · confirmed · WikiSkripta "Výživa nemocných"; bezpecnostpotravin.cz · numbering 0–11 correct.
- nem.lipidovy-panel / nem.hypertenze · confirmed · ESC/EAS 2019 (LDL < 1,8 / < 1,4 at high risk); ESC 2024 (elevated BP 120–139/70–89) · correct.

## Counts

Confirmed 93 · fixed 2 (dpl.tehotenstvi, nem.warfarin) · softened 2 (pot.bio-rizika, por.deti-percentily).
(Grouped lines count each id separately.)

## Overall assessment

The audit is sound. Every number, legal reference and date I re-checked held up, including SÚKL 4000 IU, novela
368/2024 Sb., the SZPI restaurant takeover on 1 Jan 2025, the biozebra rule, § 10 odst. 2 and § 14 of zákon 110/1997,
ESPGHAN 2025 and AND 2025. Safety-critical practice is consistent across the bank:
- vitamin D: UL 4000 IU everywhere
- caffeine: 400 / 200 mg
- liver and retinol in pregnancy: avoid, in vit.a, vit.folat, obd.folat and dpl.tehotenstvi
- iodine: EFSA 200 / WHO 250
- oats: "bez lepku" only, in remission
- hypoglycaemia first aid
- warfarin: now including the NHS "avoid" items
- supervisory bodies: no ČOI

Nowhere did I find an invented phone line or legal clause.

Remaining risk:
1. Several course-disputed keys still test script-only answers ("podle skript"). That is intentional, but it relies on
   the learner reading the stem.
2. Old, unchanged wording "seznam SZPI" (dpl.tvrzeni-typy) follows the script: SZPI publishes guidance, while the
   legally binding list is the EU Register / Reg. 432/2012. It is not wrong enough to change.
3. Legal content (supplement ban list, vitamin D borderline, supervision split) changed in 2024–2025 and may change
   again before the exam. The notes say so.
4. The verification relied on summaries of fetched pages. EUR-Lex itself was not opened (the auditors used the
   legislation.gov.uk "as adopted" texts). Annex-level details were checked from knowledge of the regulations rather
   than the consolidated texts.
