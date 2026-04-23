import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, "..", "generated");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "topic-validation.json");
const PAGE_SIZE = 100;
const MAX_PAGES = 8;
const MIN_INCLUDED_TRIALS = 2;
const FULL_CTGOV_RESULTS_TOPIC_SLUGS = new Set([
  "angiotensin-ii-vasodilatory-shock",
  "arni-heart-failure",
  "caplacizumab-attp",
  "doac-antiplatelet-af-pci",
  "efgartigimod-itp",
  "factor-xi-acs",
  "finerenone-cardiorenal",
  "fostamatinib-itp",
  "glp1-cvot",
  "luspatercept-beta-thalassemia",
  "mitral-teer",
  "momelotinib-myelofibrosis",
  "omecamtiv-heart-failure",
  "pcsk9-ascvd",
  "pegcetacoplan-pnh",
  "pfa-af",
  "sglt2-cvot",
  "sglt2-heart-failure",
  "tavi-antithrombotic",
  "tricuspid-teer",
  "vericiguat-heart-failure"
]);

const CANDIDATES = [
  {
    slug: "short-dapt-pci",
    label: "Short DAPT After PCI",
    domain: "Coronary Artery Disease",
    baseQuery: '("dual antiplatelet therapy" OR DAPT) AND (short OR abbreviated OR shortened) AND (PCI OR stent OR coronary)',
    keywords: ["1 month", "3 months", "MASTER DAPT", "STOPDAPT", "SMART-CHOICE", "TICO", "TWILIGHT"]
  },
  {
    slug: "p2y12-deescalation",
    label: "P2Y12 De-escalation in ACS or PCI",
    domain: "Coronary Artery Disease",
    baseQuery: '("acute coronary syndrome" OR PCI OR coronary) AND (de-escalation OR deescalation OR switching) AND (ticagrelor OR prasugrel OR clopidogrel)',
    keywords: ["TROPICAL-ACS", "POPular Genetics", "TAILOR-PCI", "ANTARCTIC"]
  },
  {
    slug: "aspirin-free-pci",
    label: "Aspirin-Free or P2Y12 Monotherapy After PCI",
    domain: "Coronary Artery Disease",
    baseQuery: '(PCI OR coronary OR stent) AND ("P2Y12 monotherapy" OR "aspirin-free" OR "stop aspirin")',
    keywords: ["TWILIGHT", "GLOBAL LEADERS", "SMART-CHOICE", "TICO", "STOPDAPT-2"]
  },
  {
    slug: "ticagrelor-vs-prasugrel-acs",
    label: "Ticagrelor vs Prasugrel in ACS",
    domain: "Coronary Artery Disease",
    baseQuery: '("acute coronary syndrome" OR myocardial infarction OR NSTEMI OR STEMI) AND (ticagrelor AND prasugrel)',
    keywords: ["ISAR-REACT", "PRAGUE", "DUBIUS"]
  },
  {
    slug: "prasugrel-vs-clopidogrel",
    label: "Prasugrel vs Clopidogrel in ACS or PCI",
    domain: "Coronary Artery Disease",
    baseQuery: '(ACS OR PCI OR coronary) AND (prasugrel AND clopidogrel)',
    keywords: ["TRITON", "ACCOAST", "TRILOGY"]
  },
  {
    slug: "ticagrelor-vs-clopidogrel",
    label: "Ticagrelor vs Clopidogrel in ACS",
    domain: "Coronary Artery Disease",
    baseQuery: '("acute coronary syndrome" OR myocardial infarction OR NSTEMI OR STEMI) AND (ticagrelor AND clopidogrel)',
    keywords: ["PLATO", "PHILO", "POPular AGE"]
  },
  {
    slug: "cangrelor-pci",
    label: "Cangrelor in PCI",
    domain: "Coronary Artery Disease",
    baseQuery: '(PCI OR coronary intervention) AND cangrelor',
    keywords: ["CHAMPION", "BRIDGE"]
  },
  {
    slug: "gpiibiiia-pci",
    label: "GP IIb/IIIa Inhibitors in ACS or PCI",
    domain: "Coronary Artery Disease",
    baseQuery: '(ACS OR PCI OR coronary) AND ("glycoprotein IIb/IIIa" OR tirofiban OR abciximab OR eptifibatide)',
    keywords: ["EARLY ACS", "TARGET", "ADVANCE", "ON-TIME"]
  },
  {
    slug: "bivalirudin-vs-heparin",
    label: "Bivalirudin vs Heparin in ACS or PCI",
    domain: "Coronary Artery Disease",
    baseQuery: '(ACS OR PCI OR coronary) AND (bivalirudin AND heparin)',
    keywords: ["HORIZONS", "EUROMAX", "HEAT-PPCI", "BRIGHT"]
  },
  {
    slug: "doac-antiplatelet-af-pci",
    label: "DOAC Plus Antiplatelet Therapy in AF With PCI or ACS",
    domain: "Arrhythmia",
    baseQuery: '("atrial fibrillation" AND (PCI OR "acute coronary syndrome")) AND (rivaroxaban OR apixaban OR dabigatran OR edoxaban)',
    keywords: ["PIONEER AF-PCI", "RE-DUAL PCI", "AUGUSTUS", "ENTRUST-AF PCI"]
  },
  {
    slug: "triple-therapy-af-pci",
    label: "Triple vs Dual Antithrombotic Therapy in AF With PCI",
    domain: "Arrhythmia",
    baseQuery: '("atrial fibrillation" AND PCI) AND ("triple therapy" OR "dual therapy" OR antithrombotic)',
    keywords: ["WOEST", "ISAR-TRIPLE", "AUGUSTUS", "RE-DUAL"]
  },
  {
    slug: "early-invasive-nsteacs",
    label: "Early vs Delayed Invasive Strategy in NSTE-ACS",
    domain: "Coronary Artery Disease",
    baseQuery: '("non-ST elevation" OR NSTE-ACS OR NSTEMI) AND ("early invasive" OR "delayed invasive" OR "timing invasive")',
    keywords: ["TIMACS", "VERDICT", "RIDDLE-NSTEMI"]
  },
  {
    slug: "complete-revascularization-stemi",
    label: "Complete vs Culprit-Only Revascularization in STEMI",
    domain: "Coronary Artery Disease",
    baseQuery: '(STEMI OR "ST-elevation myocardial infarction") AND ("complete revascularization" OR "culprit-only" OR "multivessel PCI")',
    keywords: ["PRAMI", "CvLPRIT", "DANAMI-3-PRIMULTI", "COMPLETE"]
  },
  {
    slug: "staged-pci-stemi",
    label: "Staged PCI Timing After STEMI",
    domain: "Coronary Artery Disease",
    baseQuery: '(STEMI OR "ST-elevation myocardial infarction") AND ("staged PCI" OR "staged revascularization" OR "complete revascularization timing")',
    keywords: ["MULTISTARS AMI", "BIOVASC", "DANAMI-3"]
  },
  {
    slug: "thrombus-aspiration-stemi",
    label: "Thrombus Aspiration in STEMI",
    domain: "Coronary Artery Disease",
    baseQuery: '(STEMI OR myocardial infarction) AND ("thrombus aspiration" OR thrombectomy)',
    keywords: ["TASTE", "TOTAL", "TAPAS"]
  },
  {
    slug: "ivus-oct-guided-pci",
    label: "IVUS or OCT Guided PCI",
    domain: "Coronary Artery Disease",
    baseQuery: '(PCI OR coronary stent) AND (IVUS OR OCT OR "intravascular ultrasound" OR "optical coherence tomography")',
    keywords: ["ULTIMATE", "ILUMIEN", "OCTOBER", "RENOVATE-COMPLEX-PCI"]
  },
  {
    slug: "ffr-ifr-guided-pci",
    label: "FFR or iFR Guided PCI",
    domain: "Coronary Artery Disease",
    baseQuery: '(PCI OR coronary disease) AND (FFR OR iFR OR "fractional flow reserve" OR "instantaneous wave-free")',
    keywords: ["FAME", "DEFINE-FLAIR", "iFR-SWEDEHEART", "FUTURE"]
  },
  {
    slug: "radial-vs-femoral-pci",
    label: "Radial vs Femoral Access in ACS or PCI",
    domain: "Coronary Artery Disease",
    baseQuery: '(ACS OR PCI OR coronary angiography) AND (radial AND femoral)',
    keywords: ["MATRIX", "RIVAL", "RIFLE-STEACS", "SAFARI-STEMI"]
  },
  {
    slug: "mcs-cardiogenic-shock",
    label: "Mechanical Circulatory Support in Cardiogenic Shock",
    domain: "Heart Failure",
    baseQuery: '("cardiogenic shock") AND (Impella OR ECMO OR ECLS OR IABP OR "mechanical circulatory support")',
    keywords: ["IABP-SHOCK", "DanGer Shock", "ECLS-SHOCK", "ECMO-CS"]
  },
  {
    slug: "genotype-guided-antiplatelet",
    label: "Genotype-Guided Antiplatelet Therapy",
    domain: "Coronary Artery Disease",
    baseQuery: '(PCI OR ACS OR coronary) AND (CYP2C19 OR genotype OR pharmacogenomic)',
    keywords: ["TAILOR-PCI", "POPular Genetics", "PHARMCLO"]
  },
  {
    slug: "platelet-function-guided-antiplatelet",
    label: "Platelet Function Testing Guided Antiplatelet Therapy",
    domain: "Coronary Artery Disease",
    baseQuery: '(PCI OR ACS OR coronary) AND ("platelet function testing" OR VerifyNow OR "platelet reactivity")',
    keywords: ["ARCTIC", "ANTARCTIC", "TROPICAL-ACS"]
  },
  {
    slug: "high-bleeding-risk-pci",
    label: "High Bleeding Risk PCI Strategies",
    domain: "Coronary Artery Disease",
    baseQuery: '(PCI OR coronary stent) AND ("high bleeding risk" OR HBR)',
    keywords: ["LEADERS FREE", "ONYX ONE", "MASTER DAPT", "XIENCE 28", "XIENCE 90"]
  },
  {
    slug: "early-discharge-pci",
    label: "Early Discharge After PCI",
    domain: "Coronary Artery Disease",
    baseQuery: '(PCI OR coronary intervention) AND ("same-day discharge" OR "early discharge" OR "next-day discharge")',
    keywords: ["same day PCI", "outpatient PCI"]
  },
  {
    slug: "oxygen-acs",
    label: "Oxygen Strategy in ACS",
    domain: "Coronary Artery Disease",
    baseQuery: '("acute coronary syndrome" OR myocardial infarction OR STEMI) AND ("oxygen therapy" OR oxygen)',
    keywords: ["DETO2X", "AVOID", "SOCCER"]
  },
  {
    slug: "statin-intensity-acs",
    label: "High- vs Moderate-Intensity Statin Therapy in ACS",
    domain: "Lipid Disorders",
    baseQuery: '("acute coronary syndrome" OR myocardial infarction OR coronary disease) AND (statin OR atorvastatin OR rosuvastatin)',
    keywords: ["PROVE IT", "MIRACL", "SECURE-PCI", "ARMYDA-ACS"]
  },
  {
    slug: "colchicine-coronary",
    label: "Colchicine in Coronary Disease",
    domain: "Coronary Artery Disease",
    baseQuery: '(coronary OR myocardial infarction OR ACS) AND colchicine',
    keywords: ["COLCOT", "LoDoCo", "CLEAR SYNERGY"]
  },
  {
    slug: "factor-xi-acs",
    label: "Factor XI Inhibitors in ACS",
    domain: "Coronary Artery Disease",
    baseQuery: '("acute coronary syndrome" OR myocardial infarction) AND ("factor XI" OR FXI OR asundexian OR milvexian)',
    keywords: ["PACIFIC-AMI", "AXIOMATIC-ACS", "LIBREXIA"]
  },
  {
    slug: "pfa-af",
    label: "Pulsed Field vs Thermal Ablation for Atrial Fibrillation",
    domain: "Arrhythmia",
    baseQuery: '("atrial fibrillation") AND ("pulsed field ablation" OR electroporation)',
    keywords: ["ADVENT", "inspIRE", "PULSE-EU", "ECLIPSE-AF"]
  },
  {
    slug: "cryo-vs-rf-af",
    label: "Cryoballoon vs Radiofrequency Ablation for Atrial Fibrillation",
    domain: "Arrhythmia",
    baseQuery: '("atrial fibrillation") AND (cryoablation OR cryoballoon) AND (radiofrequency OR RF)',
    keywords: ["FIRE AND ICE", "CIRCA-DOSE", "Cryo-FIRST"]
  },
  {
    slug: "ablation-vs-drugs-af",
    label: "Catheter Ablation vs Drug Therapy for Atrial Fibrillation",
    domain: "Arrhythmia",
    baseQuery: '("atrial fibrillation") AND ("catheter ablation") AND ("antiarrhythmic drug" OR "drug therapy" OR medical)',
    keywords: ["CABANA", "EAST-AFNET", "STOP AF First", "EARLY-AF"]
  },
  {
    slug: "laao-af",
    label: "Left Atrial Appendage Occlusion vs Anticoagulation",
    domain: "Arrhythmia",
    baseQuery: '("atrial fibrillation") AND ("left atrial appendage" OR WATCHMAN OR Amulet)',
    keywords: ["PROTECT-AF", "PREVAIL", "Amulet IDE", "CHAMPION-AF", "OPTION"]
  },
  {
    slug: "tavi-vs-savr",
    label: "TAVI/TAVR vs Surgical AVR",
    domain: "Valvular Disease",
    baseQuery: '("aortic stenosis") AND (TAVR OR TAVI OR "transcatheter aortic valve") AND (surgery OR SAVR OR surgical)',
    keywords: ["PARTNER", "CoreValve", "SURTAVI", "Evolut", "NOTION"]
  },
  {
    slug: "mitral-teer",
    label: "Mitral TEER vs Medical Therapy",
    domain: "Valvular Disease",
    baseQuery: '("mitral regurgitation") AND (TEER OR MitraClip OR Pascal OR "edge-to-edge")',
    keywords: ["COAPT", "RESHAPE-HF", "CLASP IID"]
  },
  {
    slug: "tricuspid-teer",
    label: "Tricuspid TEER vs Medical Therapy",
    domain: "Valvular Disease",
    baseQuery: '("tricuspid regurgitation") AND (TEER OR TriClip OR PASCAL OR "edge-to-edge")',
    keywords: ["TRILUMINATE", "CLASP II TR"]
  },
  {
    slug: "pfo-closure",
    label: "Patent Foramen Ovale Closure vs Medical Therapy",
    domain: "Vascular Disease",
    baseQuery: '("patent foramen ovale") AND (closure OR device)',
    keywords: ["RESPECT", "REDUCE", "CLOSE", "DEFENSE-PFO"]
  },
  {
    slug: "sglt2-heart-failure",
    label: "SGLT2 Inhibitors in Heart Failure",
    domain: "Heart Failure",
    baseQuery: '("heart failure") AND (dapagliflozin OR empagliflozin OR sotagliflozin OR canagliflozin OR ertugliflozin)',
    keywords: ["DAPA-HF", "DELIVER", "EMPEROR", "SOLOIST", "EMPEROR-Preserved"]
  },
  {
    slug: "arni-heart-failure",
    label: "ARNI in Heart Failure",
    domain: "Heart Failure",
    baseQuery: '("heart failure") AND ("sacubitril valsartan" OR ARNI)',
    keywords: ["PARADIGM-HF", "PARAGON-HF", "PIONEER-HF", "LIFE"]
  },
  {
    slug: "iron-heart-failure",
    label: "Intravenous Iron in Heart Failure",
    domain: "Heart Failure",
    baseQuery: '("heart failure") AND ("ferric carboxymaltose" OR "intravenous iron" OR iron)',
    keywords: ["AFFIRM-AHF", "FAIR-HF", "CONFIRM-HF", "IRONMAN", "HEART-FID"]
  },
  {
    slug: "vericiguat-heart-failure",
    label: "Vericiguat in Heart Failure",
    domain: "Heart Failure",
    baseQuery: '("heart failure") AND vericiguat',
    keywords: ["VICTORIA", "SOCRATES"]
  },
  {
    slug: "pcsk9-ascvd",
    label: "PCSK9 Inhibition in Atherosclerotic Cardiovascular Disease",
    domain: "Lipid Disorders",
    baseQuery: '("cardiovascular disease" OR "acute coronary syndrome" OR coronary) AND (evolocumab OR alirocumab OR inclisiran OR PCSK9)',
    keywords: ["FOURIER", "ODYSSEY", "EVOPACS", "PACMAN-AMI"]
  },
  {
    slug: "doac-vs-warfarin-af",
    label: "Direct Oral Anticoagulants vs Warfarin in Atrial Fibrillation",
    domain: "Arrhythmia",
    baseQuery: '("atrial fibrillation") AND (apixaban OR rivaroxaban OR dabigatran OR edoxaban) AND (warfarin OR "vitamin K antagonist")',
    keywords: ["ARISTOTLE", "ROCKET AF", "RE-LY", "ENGAGE AF"]
  },
  {
    slug: "tavi-antithrombotic",
    label: "Antithrombotic Strategies After TAVI/TAVR",
    domain: "Valvular Disease",
    baseQuery: '("aortic stenosis" OR TAVI OR TAVR OR "transcatheter aortic valve") AND (anticoagulation OR antiplatelet OR apixaban OR edoxaban OR rivaroxaban)',
    keywords: ["ATLANTIS", "ENVISAGE-TAVI AF", "POPular TAVI", "GALILEO", "ADAPT-TAVR"]
  },
  {
    slug: "coronary-dcb-vs-des",
    label: "Drug-Coated Balloon vs Drug-Eluting Stent in Coronary Disease",
    domain: "Coronary Artery Disease",
    baseQuery: '(PCI OR coronary OR restenosis) AND ("drug-coated balloon" OR DCB OR paclitaxel) AND ("drug-eluting stent" OR DES)',
    keywords: ["BASKET-SMALL 2", "REVELATION", "DARE", "PICCOLETO", "AGENT IDE"]
  },
  {
    slug: "glp1-cvot",
    label: "GLP-1 Receptor Agonist Cardiovascular Outcome Trials",
    domain: "Lipid Disorders",
    baseQuery: '("type 2 diabetes") AND (liraglutide OR semaglutide OR dulaglutide OR exenatide OR albiglutide OR efpeglenatide)',
    keywords: ["LEADER", "SUSTAIN", "REWIND", "HARMONY", "AMPLITUDE-O"]
  },
  {
    slug: "sglt2-cvot",
    label: "SGLT2 Cardiovascular Outcome Trials",
    domain: "Lipid Disorders",
    baseQuery: '("type 2 diabetes") AND (empagliflozin OR canagliflozin OR dapagliflozin OR ertugliflozin OR sotagliflozin)',
    keywords: ["EMPA-REG", "CANVAS", "DECLARE", "VERTIS", "SCORED"]
  },
  {
    slug: "finerenone-cardiorenal",
    label: "Finerenone Cardiorenal Outcome Trials",
    domain: "Cardiorenal Disease",
    baseQuery: '("chronic kidney disease" AND "type 2 diabetes") AND finerenone',
    keywords: ["FIDELIO-DKD", "FIGARO-DKD", "FINEARTS"]
  },
  {
    slug: "ivabradine-heart-failure",
    label: "Ivabradine in Heart Failure or LV Dysfunction",
    domain: "Heart Failure",
    baseQuery: '("heart failure" OR "left ventricular dysfunction") AND ivabradine',
    keywords: ["SHIFT", "BEAUTIFUL", "EDIFY"]
  },
  {
    slug: "omecamtiv-heart-failure",
    label: "Omecamtiv Mecarbil in Heart Failure",
    domain: "Heart Failure",
    baseQuery: '("heart failure") AND ("omecamtiv mecarbil" OR omecamtiv)',
    keywords: ["GALACTIC-HF", "ATOMIC-AHF", "COSMIC-HF", "METEORIC-HF"]
  },
  {
    slug: "omega3-cvot",
    label: "Omega-3 Cardiovascular Outcome Trials",
    domain: "Lipid Disorders",
    baseQuery: '("cardiovascular disease" OR diabetes OR hypertriglyceridemia) AND (icosapent OR eicosapentaenoic OR omega-3 OR EPA)',
    keywords: ["REDUCE-IT", "STRENGTH", "OMEMI"]
  },
  {
    slug: "renal-denervation-hypertension",
    label: "Renal Denervation in Hypertension",
    domain: "Hypertension",
    baseQuery: '(hypertension OR "blood pressure") AND ("renal denervation" OR "catheter-based renal denervation")',
    keywords: ["SYMPLICITY", "SPYRAL", "RADIANCE", "TARGET BP"]
  },
  {
    slug: "fostamatinib-itp",
    label: "Fostamatinib in Immune Thrombocytopenia",
    domain: "Hematology",
    baseQuery: '("primary immune thrombocytopenia" OR "immune thrombocytopenic purpura" OR "idiopathic thrombocytopenic purpura") AND (fostamatinib OR R935788 OR R788)',
    keywords: ["thrombocytopenic purpura", "R935788", "adult refractory"]
  },
  {
    slug: "efgartigimod-itp",
    label: "Efgartigimod in Immune Thrombocytopenia",
    domain: "Hematology",
    baseQuery: '("primary immune thrombocytopenia" OR "immune thrombocytopenia" OR "immune thrombocytopenic purpura") AND (efgartigimod OR ARGX-113)',
    keywords: ["ADVANCE", "subcutaneous", "primary ITP"]
  },
  {
    slug: "momelotinib-myelofibrosis",
    label: "Momelotinib in Myelofibrosis",
    domain: "Hematology",
    baseQuery: '(myelofibrosis OR "post-polycythemia vera myelofibrosis" OR "post-essential thrombocythemia myelofibrosis") AND momelotinib',
    keywords: ["SIMPLIFY", "MOMENTUM", "danazol"]
  },
  {
    slug: "pegcetacoplan-pnh",
    label: "Pegcetacoplan in Paroxysmal Nocturnal Hemoglobinuria",
    domain: "Hematology",
    baseQuery: '("paroxysmal nocturnal hemoglobinuria" OR PNH) AND (pegcetacoplan OR APL-2)',
    keywords: ["PEGASUS", "PRINCE", "APL-2"]
  },
  {
    slug: "caplacizumab-attp",
    label: "Caplacizumab in Acquired TTP",
    domain: "Hematology",
    baseQuery: '("acquired thrombotic thrombocytopenic purpura" OR aTTP OR TTP) AND (caplacizumab OR ALX-0681)',
    keywords: ["HERCULES", "TITAN", "anti-von Willebrand factor"]
  },
  {
    slug: "luspatercept-beta-thalassemia",
    label: "Luspatercept in Beta-Thalassemia",
    domain: "Hematology",
    baseQuery: '("beta thalassemia" OR "transfusion-dependent beta thalassemia" OR "non transfusion dependent beta thalassemia") AND luspatercept',
    keywords: ["BELIEVE", "BEYOND", "ACE-536"]
  },
  {
    slug: "angiotensin-ii-vasodilatory-shock",
    label: "Angiotensin II in Vasodilatory Shock",
    domain: "Intensive Care",
    baseQuery: '("catecholamine-resistant hypotension" OR "high output shock" OR "vasodilatory shock") AND ("angiotensin II" OR LJPC-501 OR Giapreza)',
    keywords: ["ATHOS-3", "LJPC-501", "high output shock"]
  }
];

function buildQuery(baseQuery, keywords) {
  const parts = [baseQuery.trim()];
  const cleanedKeywords = keywords
    .map(keyword => String(keyword || "").trim())
    .filter(Boolean);
  if (cleanedKeywords.length > 0) {
    parts.push(`(${cleanedKeywords.map(keyword => `"${keyword}"`).join(" OR ")})`);
  }
  return parts.join(" AND ");
}

function extractDate(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  return raw.date || raw.value || null;
}

function isRandomized(design) {
  const studyType = String(design.studyType || "").toUpperCase();
  if (!studyType.includes("INTERVENTIONAL")) return false;
  const allocation = String(design.allocation || design.designInfo?.allocation || "").toUpperCase();
  const randomization = String(design.designInfo?.randomization || "").toUpperCase();
  return /\bRANDOMIZED\b/.test(allocation) || /\bRANDOMIZED\b/.test(randomization);
}

function extractArms(protocol) {
  const armsModule = protocol.armsInterventionsModule || {};
  const rawArms =
    armsModule.armGroupList?.armGroup ||
    armsModule.armGroups ||
    armsModule.armGroup ||
    [];
  const arms = Array.isArray(rawArms) ? rawArms : [rawArms];
  return arms
    .filter(Boolean)
    .map((arm, index) => ({
      id: arm.armGroupId || arm.groupId || arm.id || `${index + 1}`,
      title:
        arm.armGroupLabel ||
        arm.armGroupTitle ||
        arm.title ||
        arm.description ||
        `Arm ${index + 1}`
    }));
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "");
    const match = normalized.match(/-?\d+(\.\d+)?/);
    if (match) return Number.parseFloat(match[0]);
  }
  return null;
}

function parseDisplayedDecimals(value) {
  const normalized = String(value ?? "").replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.(\d+))?/);
  return match?.[1]?.length || 0;
}

function buildDenominatorMap(...sources) {
  const countsByGroup = new Map();
  sources.forEach(source => {
    asArray(source).forEach(denom => {
      asArray(denom?.counts).forEach((count, index) => {
        const groupId = count.groupId || count.group || count.id || `${index + 1}`;
        const value = parseNumber(count.value || count.count || count.numParticipants || count.n);
        if (groupId && value != null) {
          countsByGroup.set(groupId, value);
        }
      });
    });
  });
  return countsByGroup;
}

function classifyOutcomeMetric({ title = "", paramType = "", unitOfMeasure = "", classTitle = "" }) {
  const normalizedTitle = `${title} ${classTitle}`.toLowerCase();
  const normalizedParamType = String(paramType || "").toUpperCase();
  const normalizedUnit = String(unitOfMeasure || "").toLowerCase();

  if (
    normalizedParamType.includes("MEAN") ||
    normalizedParamType.includes("GEOMETRIC_MEAN") ||
    normalizedParamType.includes("LEAST_SQUARES_MEAN")
  ) {
    return "continuous";
  }

  const percentUnit = /percent|percentage/.test(normalizedUnit);
  const rateUnit =
    /per\s*100|patient-yrs|patient years|part-yrs|participant-yrs|participant years|person-yrs|person years|person-years/.test(
      normalizedUnit
    ) || /event\/100/.test(normalizedUnit);
  const timeToEventSignal =
    /\btime to\b|\bfirst occurrence\b|\bkaplan\b|\bkm estimate\b|\bhazard\b|\bwins? of clinical benefit\b|\bpairwise comparisons\b/.test(
      normalizedTitle
    );

  if (percentUnit) {
    if (rateUnit || timeToEventSignal) return "rate";
    return "proportion";
  }

  if (rateUnit || timeToEventSignal) return "rate";

  const countParamType =
    normalizedParamType.includes("COUNT") ||
    normalizedParamType.includes("PARTICIPANT") ||
    normalizedParamType.includes("EVENT");
  const participantSignal =
    /\bparticipants?\b|\bsubjects?\b|\bcases?\b/.test(normalizedUnit) ||
    /\bparticipants?\s+with\b|\bsubjects?\s+with\b|\bcases?\s+with\b/.test(normalizedTitle) ||
    /\bnumber of participants\b|\bnumber of subjects\b|\bnumber of cases\b/.test(normalizedTitle);
  const repeatedEventSignal =
    /\badverse events?\b|\bteaes?\b|\bsaes?\b|\bevents?\b|\bhospitalizations?\b|\bvisits?\b|\bepisodes?\b/.test(normalizedUnit) ||
    /\bnumber of adverse events\b|\bcumulative number of\b|\btotal events?\b/.test(normalizedTitle);

  if (countParamType || participantSignal || repeatedEventSignal) {
    if (participantSignal) return "count";
    if (repeatedEventSignal) return "raw-number";
    return "count";
  }
  if (normalizedParamType.includes("NUMBER")) return "raw-number";
  return "raw-number";
}

function deriveEventsFromPercent(rawValue, rawText, n) {
  if (rawValue == null || n == null || n <= 0) return null;
  const estimatedEvents = (rawValue / 100) * n;
  const roundedEvents = Math.round(estimatedEvents);
  if (!Number.isFinite(roundedEvents) || roundedEvents < 0 || roundedEvents > n) return null;

  const displayedTolerance = 0.5 * 10 ** -parseDisplayedDecimals(rawText);
  const roundedPercent = (roundedEvents / n) * 100;
  if (Math.abs(roundedPercent - rawValue) > displayedTolerance + 1e-9) return null;

  return {
    events: roundedEvents,
    derivation:
      Math.abs(estimatedEvents - roundedEvents) < 1e-9
        ? "exact_from_ctgov_percent"
        : "reconstructed_from_ctgov_percent",
    displayPercent: rawValue
  };
}

function outcomeAnalysisReason(metricKind) {
  if (metricKind === "rate") {
    return "ctgov_metric_recorded_as_rate_or_time_to_event_estimate";
  }
  if (metricKind === "proportion") {
    return "ctgov_percent_recorded_without_reliable_count_reconstruction";
  }
  return "ctgov_numeric_metric_recorded_but_not_reducible_to_counts_or_means";
}

function outcomeTitle(measure) {
  return measure.outcomeMeasureTitle || measure.title || "";
}

function outcomeUnit(measure) {
  return measure.unitOfMeasure || measure.units || "";
}

function finalizeOutcome(measure, groups, metricKind) {
  const type = inferOutcomeType(groups);
  return {
    type: type || "recorded",
    title: outcomeTitle(measure),
    unitOfMeasure: cleanText(outcomeUnit(measure), 120),
    paramType: cleanText(measure.paramType || "", 80),
    metricKind,
    analysisEligible: Boolean(type),
    analysisReason: type ? "ctgov_numeric_contrast_ready" : outcomeAnalysisReason(metricKind),
    groups
  };
}

function cleanText(value, maxLength = null) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatGroupLookup(groups) {
  return new Map(
    asArray(groups)
      .filter(Boolean)
      .map((group, index) => [
        group.id || group.groupId || `${index + 1}`,
        {
          id: group.id || group.groupId || `${index + 1}`,
          title: cleanText(group.title || group.groupTitle || group.description || `Group ${index + 1}`, 220),
          description: cleanText(group.description || "", 280)
        }
      ])
  );
}

function extractProtocolOutcomes(outcomes, limit = 3) {
  return asArray(outcomes)
    .filter(Boolean)
    .slice(0, limit)
    .map(item => ({
      measure: cleanText(item.measure || item.title || "", 260),
      description: cleanText(item.description || "", 700),
      timeFrame: cleanText(item.timeFrame || "", 260)
    }))
    .filter(item => item.measure || item.description || item.timeFrame);
}

function extractDocumentLinks(study, limit = 4) {
  const largeDocs = study.documentSection?.largeDocumentModule?.largeDocs || [];
  return asArray(largeDocs)
    .filter(Boolean)
    .slice(0, limit)
    .map(doc => ({
      label: cleanText(doc.label || doc.typeAbbrev || doc.filename || doc.fileName || "Document", 160),
      filename: cleanText(doc.filename || doc.fileName || "", 180),
      date: extractDate(doc.date || doc.uploadDate || doc.dateStruct),
      hasSap: Boolean(doc.hasSap),
      hasIcf: Boolean(doc.hasIcf),
      hasProtocol: Boolean(doc.hasProtocol),
      url: doc.url || doc.largeDocUrl || ""
    }));
}

function summarizeMeasureCategories(categories, groupLookup, categoryLimit = 4, measurementLimit = 4) {
  return asArray(categories)
    .filter(Boolean)
    .slice(0, categoryLimit)
    .map(category => ({
      title: cleanText(category.title || category.categoryTitle || "Value", 140),
      measurements: asArray(category.measurements || category.measurementList?.measurement)
        .filter(Boolean)
        .slice(0, measurementLimit)
        .map(item => {
          const groupId = item.groupId || item.baselineGroupId || item.id || "";
          return {
            groupId,
            groupTitle: groupLookup.get(groupId)?.title || groupId || "Group",
            value: cleanText(item.value ?? "", 80),
            spread: cleanText(item.spread ?? "", 80)
          };
        })
    }))
    .filter(category => category.measurements.length);
}

function summarizeBaselineMeasure(measure, groupLookup) {
  const classes = asArray(measure?.classes);
  const categoryBlocks = classes.flatMap(item => summarizeMeasureCategories(item?.categories, groupLookup));
  return {
    title: cleanText(measure?.title || "Untitled measure", 180),
    paramType: cleanText(measure?.paramType || "", 80),
    unit: cleanText(measure?.unitOfMeasure || "", 80),
    categories: categoryBlocks.slice(0, 4)
  };
}

function extractContinuousMeasure(measure, groupLookup) {
  if (!measure) return [];
  const classes = asArray(measure.classes);
  const measurements = classes.flatMap(item =>
    asArray(item?.categories)
      .filter(Boolean)
      .flatMap(category => asArray(category.measurements || category.measurementList?.measurement))
  );
  return measurements
    .filter(Boolean)
    .slice(0, 6)
    .map(item => {
      const groupId = item.groupId || item.baselineGroupId || item.id || "";
      return {
        groupId,
        groupTitle: groupLookup.get(groupId)?.title || groupId || "Group",
        value: cleanText(item.value ?? "", 80),
        spread: cleanText(item.spread ?? "", 80),
        unit: cleanText(measure.unitOfMeasure || "", 60)
      };
    });
}

function extractSexBreakdown(measure, groupLookup) {
  if (!measure) return [];
  const sexByGroup = new Map();
  const classes = asArray(measure.classes);
  for (const classBlock of classes) {
    for (const category of asArray(classBlock?.categories)) {
      const label = cleanText(category?.title || category?.categoryTitle || "", 80).toLowerCase();
      if (!label) continue;
      for (const item of asArray(category.measurements || category.measurementList?.measurement)) {
        const groupId = item.groupId || item.baselineGroupId || item.id || "";
        if (!groupId) continue;
        const entry = sexByGroup.get(groupId) || {
          groupId,
          groupTitle: groupLookup.get(groupId)?.title || groupId || "Group",
          female: null,
          male: null
        };
        const parsed = parseNumber(item.value);
        if (label.includes("female")) entry.female = parsed ?? cleanText(item.value ?? "", 80);
        if (label.includes("male")) entry.male = parsed ?? cleanText(item.value ?? "", 80);
        sexByGroup.set(groupId, entry);
      }
    }
  }
  return Array.from(sexByGroup.values()).slice(0, 6);
}

function extractDemographics(study) {
  const baseline = study.resultsSection?.baselineCharacteristicsModule || {};
  const groups = asArray(baseline.groups)
    .filter(Boolean)
    .map((group, index) => ({
      id: group.id || group.groupId || `${index + 1}`,
      title: cleanText(group.title || group.groupTitle || `Group ${index + 1}`, 180),
      description: cleanText(group.description || "", 280)
    }));
  const groupLookup = formatGroupLookup(groups);
  const denom = asArray(baseline.denoms)[0] || null;
  const participantCounts = asArray(denom?.counts)
    .filter(Boolean)
    .slice(0, 8)
    .map(item => {
      const groupId = item.groupId || item.baselineGroupId || item.id || "";
      return {
        groupId,
        groupTitle: groupLookup.get(groupId)?.title || groupId || "Group",
        value: parseNumber(item.value) ?? cleanText(item.value ?? "", 80),
        unit: cleanText(denom?.units || "", 40)
      };
    });

  const measures = asArray(baseline.measures);
  const ageMeasure = measures.find(measure => {
    const title = cleanText(measure?.title || "", 120).toLowerCase();
    return title.includes("age") && cleanText(measure?.paramType || "", 80).toLowerCase().includes("mean");
  });
  const sexMeasure = measures.find(measure => {
    const title = cleanText(measure?.title || "", 120).toLowerCase();
    const categories = asArray(measure?.classes).flatMap(item => asArray(item?.categories));
    return title.includes("sex") || categories.some(category => /female|male/i.test(category?.title || category?.categoryTitle || ""));
  });

  const keyMeasures = measures
    .slice(0, 4)
    .map(measure => summarizeBaselineMeasure(measure, groupLookup))
    .filter(measure => measure.categories.length);

  if (!groups.length && !participantCounts.length && !keyMeasures.length) {
    return null;
  }

  return {
    populationDescription: cleanText(baseline.populationDescription || "", 400),
    groups,
    participantCounts,
    ageMean: extractContinuousMeasure(ageMeasure, groupLookup),
    sexBreakdown: extractSexBreakdown(sexMeasure, groupLookup),
    keyMeasures
  };
}

function inferOutcomeType(groups) {
  const withEvents = groups.filter(group => group.events != null && group.n != null);
  if (withEvents.length >= 2) return "binary";
  const withMean = groups.filter(group => group.mean != null && group.sd != null && group.n != null);
  if (withMean.length >= 2) return "continuous";
  return null;
}

function mergeOutcomeGroups(groups, entries, measure) {
  if (!entries.length) return null;
  const metricKind = classifyOutcomeMetric({
    title: outcomeTitle(measure),
    paramType: measure.paramType,
    unitOfMeasure: outcomeUnit(measure)
  });
  const groupMap = new Map(groups.map(group => [group.id, { ...group }]));
  const merged = [];
  entries.forEach((entry, index) => {
    const groupId =
      entry.outcomeMeasureGroupId ||
      entry.groupId ||
      entry.group ||
      entry.groupTitle ||
      `${index + 1}`;
    const base =
      groupMap.get(groupId) || {
        id: groupId,
        title: entry.groupTitle || `Group ${index + 1}`
      };
    const n = parseNumber(entry.numParticipants || entry.participants || entry.sampleSize);
    const rawText =
      entry.count ||
      entry.events ||
      entry.eventCount ||
      entry.mean ||
      entry.value ||
      entry.measure;
    const rawValue = parseNumber(rawText);
    const row = {
      ...base,
      rawValue,
      rawUnit: cleanText(outcomeUnit(measure), 120),
      n
    };

    if (metricKind === "continuous") {
      row.mean = rawValue;
      row.sd = parseNumber(entry.sd || entry.standardDeviation || entry.dispersion);
    } else if (metricKind === "count") {
      row.events = rawValue;
      row.derivation = rawValue != null ? "posted_count" : null;
    } else if (metricKind === "proportion") {
      const derived = deriveEventsFromPercent(rawValue, rawText, n);
      if (derived) {
        row.events = derived.events;
        row.displayPercent = derived.displayPercent;
        row.derivation = derived.derivation;
      }
    }

    if (row.derivation == null) {
      delete row.derivation;
    }

    merged.push(row);
  });
  return { groups: merged, metricKind };
}

function extractOutcomeFromClasses(measure) {
  if (!measure || (!measure.groups && !measure.denoms && !measure.classes)) return null;
  const paramType = String(measure.paramType || "").toUpperCase();
  const dispersionType = String(measure.dispersionType || "").toUpperCase();
  const groups = asArray(measure.groups);
  const classes = asArray(measure.classes);
  if (!classes.length) return null;

  const groupMap = new Map();
  groups.forEach((group, index) => {
    const id = group.id || group.groupId || group.group || group.title || `${index + 1}`;
    const title =
      group.title || group.groupTitle || group.name || group.description || `Group ${index + 1}`;
      groupMap.set(id, { id, title });
  });

  const targetClass = classes.find(cls => asArray(cls.categories).length) || classes[0];
  if (!targetClass) return null;
  const metricKind = classifyOutcomeMetric({
    title: outcomeTitle(measure),
    paramType,
    unitOfMeasure: outcomeUnit(measure),
    classTitle: targetClass.title || ""
  });
  const nByGroup = buildDenominatorMap(measure.denoms, targetClass.denoms);
  const rawByGroup = new Map();
  const categories = asArray(targetClass.categories);
  const chosenCategory = pickCategory(categories);
  const categoryList = chosenCategory ? [chosenCategory] : categories;
  categoryList.forEach(category => {
    asArray(category.measurements).forEach(measurement => {
      const groupId = measurement.groupId || measurement.group || measurement.id;
      const rawText = measurement.value || measurement.count || measurement.numParticipants;
      const rawValue = parseNumber(rawText);
      if (!groupId || rawValue == null) return;

      if (metricKind === "count" && rawByGroup.has(groupId)) {
        const previous = rawByGroup.get(groupId);
        rawByGroup.set(groupId, {
          ...previous,
          rawValue: (previous?.rawValue || 0) + rawValue,
          rawText: null
        });
        return;
      }

      rawByGroup.set(groupId, {
        rawValue,
        rawText,
        rawUnit: cleanText(outcomeUnit(measure), 120),
        lowerLimit:
          parseNumber(measurement.lowerLimit) ??
          parseNumber(measurement.ciLower) ??
          parseNumber(measurement.lowerBound),
        upperLimit:
          parseNumber(measurement.upperLimit) ??
          parseNumber(measurement.ciUpper) ??
          parseNumber(measurement.upperBound)
      });
    });
  });

  const groupIds = new Set([...groupMap.keys(), ...nByGroup.keys(), ...rawByGroup.keys()]);
  const merged = [];
  let index = 0;
  groupIds.forEach(id => {
    index += 1;
    const base = groupMap.get(id) || { id, title: `Group ${index}` };
    const row = { ...base };
    if (nByGroup.has(id)) row.n = nByGroup.get(id);
    if (rawByGroup.has(id)) {
      const measurement = rawByGroup.get(id);
      row.rawValue = measurement.rawValue;
      row.rawUnit = measurement.rawUnit;
      if (measurement.lowerLimit != null) row.lowerLimit = measurement.lowerLimit;
      if (measurement.upperLimit != null) row.upperLimit = measurement.upperLimit;

      if (metricKind === "continuous") {
        row.mean = measurement.rawValue;
        const dispersion = extractDispersionForGroup(categoryList, id, dispersionType, row.n);
        if (dispersion != null) row.sd = dispersion;
      } else if (metricKind === "count") {
        row.events = measurement.rawValue;
        row.derivation = "posted_count";
      } else if (metricKind === "proportion") {
        const derived = deriveEventsFromPercent(measurement.rawValue, measurement.rawText, row.n);
        if (derived) {
          row.events = derived.events;
          row.displayPercent = derived.displayPercent;
          row.derivation = derived.derivation;
        }
      }
    }
    merged.push(row);
  });
  return { groups: merged, metricKind };
}

function pickCategory(categories) {
  if (!categories.length) return null;
  if (categories.length === 1) return categories[0];
  const normalized = categories.map(category => ({
    raw: category,
    title: String(category.title || category.categoryTitle || "").toLowerCase()
  }));
  const preferred = normalized.find(category =>
    /(participant|event|events|case|cases|yes|positive)/.test(category.title)
  );
  if (preferred) return preferred.raw;
  const negative = normalized.find(category => /\bno\b|negative|none/.test(category.title));
  if (negative && normalized.length === 2) {
    return normalized.find(category => category !== negative)?.raw || categories[0];
  }
  return categories[0];
}

function extractDispersionForGroup(categories, groupId, dispersionType, nValue) {
  for (const category of categories) {
    for (const measurement of asArray(category.measurements)) {
      const measurementGroupId = measurement.groupId || measurement.group || measurement.id;
      if (measurementGroupId !== groupId) continue;

      const directSd =
        parseNumber(measurement.sd) ??
        parseNumber(measurement.standardDeviation);
      if (directSd != null) return directSd;

      const spread =
        parseNumber(measurement.spread) ??
        parseNumber(measurement.dispersion);

      if (spread != null) {
        if (dispersionType.includes("STANDARD ERROR") || dispersionType.includes("SE")) {
          if (nValue) return spread * Math.sqrt(nValue);
          return spread * 4;
        }
        if (dispersionType.includes("STANDARD DEVIATION") || dispersionType.includes("SD")) {
          return spread;
        }
        if (dispersionType.includes("INTER-QUARTILE") || dispersionType.includes("IQR")) {
          return spread / 1.35;
        }
        if (dispersionType.includes("FULL RANGE") || dispersionType.includes("RANGE")) {
          return spread / 4;
        }
      }

      const lower =
        parseNumber(measurement.lowerLimit) ??
        parseNumber(measurement.ciLower) ??
        parseNumber(measurement.lowerBound);
      const upper =
        parseNumber(measurement.upperLimit) ??
        parseNumber(measurement.ciUpper) ??
        parseNumber(measurement.upperBound);
      if (lower != null && upper != null && upper > lower) {
        let zMultiplier = 1.96;
        if (dispersionType.includes("90%") || dispersionType.includes("90 PERCENT")) {
          zMultiplier = 1.645;
        } else if (dispersionType.includes("99%") || dispersionType.includes("99 PERCENT")) {
          zMultiplier = 2.576;
        } else if (dispersionType.includes("80%") || dispersionType.includes("80 PERCENT")) {
          zMultiplier = 1.282;
        }
        const se = (upper - lower) / (2 * zMultiplier);
        if (nValue && nValue > 1) return se * Math.sqrt(nValue);
        return se * Math.sqrt(50);
      }
    }
  }
  return null;
}

function extractOutcome(study) {
  const results = study.resultsSection || {};
  const module = results.outcomeMeasuresModule || {};
  const rawMeasures =
    module.outcomeMeasures ||
    module.outcomeMeasureList ||
    module.outcomeMeasure ||
    [];
  const measures = Array.isArray(rawMeasures) ? rawMeasures : [rawMeasures];

  let recordedFallback = null;

  for (const measure of measures) {
    const grouped = extractOutcomeFromClasses(measure);
    if (grouped?.groups?.length) {
      const outcome = finalizeOutcome(measure, grouped.groups, grouped.metricKind);
      if (outcome.analysisEligible) return outcome;
      if (!recordedFallback) recordedFallback = outcome;
    }

    const rawGroups =
      measure.outcomeMeasureGroupList?.outcomeMeasureGroup ||
      measure.outcomeMeasureGroupList ||
      measure.outcomeMeasureGroups ||
      [];
    const groups = asArray(rawGroups).map((group, index) => ({
      id: group.outcomeMeasureGroupId || group.groupId || group.id || `${index + 1}`,
      title:
        group.outcomeMeasureGroupTitle ||
        group.groupTitle ||
        group.title ||
        group.description ||
        `Group ${index + 1}`
    }));

    const rawEntries =
      measure.outcomeMeasureResultList?.outcomeMeasureResult ||
      measure.outcomeMeasureResults ||
      measure.outcomeMeasureResult ||
      measure.outcomeMeasureData ||
      measure.outcomeMeasureDataPoints ||
      [];
    const merged = mergeOutcomeGroups(groups, asArray(rawEntries), measure);
    if (merged?.groups?.length) {
      const outcome = finalizeOutcome(measure, merged.groups, merged.metricKind);
      if (outcome.analysisEligible) return outcome;
      if (!recordedFallback) recordedFallback = outcome;
    }
  }
  return recordedFallback;
}

function normalizeStudy(study) {
  const protocol = study.protocolSection || {};
  const identification = protocol.identificationModule || {};
  const status = protocol.statusModule || {};
  const design = protocol.designModule || {};
  const description = protocol.descriptionModule || {};
  const eligibility = protocol.eligibilityModule || {};
  const sponsor = protocol.sponsorCollaboratorsModule?.leadSponsor || {};
  const conditions = protocol.conditionsModule || {};
  const outcomesModule = protocol.outcomesModule || {};
  const nctId = identification.nctId || study.nctId || null;
  const title = identification.briefTitle || identification.officialTitle || "";
  const arms = extractArms(protocol);
  const outcome = extractOutcome(study);
  const analysisEligible = Boolean(outcome?.analysisEligible);
  const hasPostedResults = Boolean(study.hasResults || study.resultsSection);
  const completed = status.overallStatus === "COMPLETED";
  const randomized = isRandomized(design);
  const reasons = [];

  if (!completed) reasons.push("not_completed");
  if (!hasPostedResults) reasons.push("no_results_posted");
  if (!randomized) reasons.push("not_randomized_interventional");
  if (arms.length < 2) reasons.push("fewer_than_two_arms");
  if (!outcome) reasons.push("no_recorded_numeric_outcome");

  return {
    nctId,
    title,
    status: status.overallStatus || "",
    startDate: extractDate(status.startDateStruct || status.startDate),
    completionDate: extractDate(status.completionDateStruct || status.completionDate),
    studyType: design.studyType || "",
    allocation: design.allocation || design.designInfo?.allocation || "",
    officialTitle: cleanText(identification.officialTitle || "", 400),
    acronym: cleanText(identification.acronym || study.derivedSection?.miscInfoModule?.acronym || "", 120),
    briefSummary: cleanText(description.briefSummary || "", 1500),
    detailedDescription: cleanText(description.detailedDescription || "", 2000),
    sponsor: {
      name: cleanText(sponsor.name || "", 180),
      class: cleanText(sponsor.class || "", 80)
    },
    phases: asArray(design.phases).map(phase => cleanText(phase, 40)).filter(Boolean),
    enrollment: {
      count: parseNumber(design.enrollmentInfo?.count),
      type: cleanText(design.enrollmentInfo?.type || "", 40)
    },
    conditions: asArray(conditions.conditions).map(condition => cleanText(condition, 120)).filter(Boolean).slice(0, 6),
    eligibility: {
      sex: cleanText(eligibility.sex || "", 40),
      minimumAge: cleanText(eligibility.minimumAge || "", 40),
      maximumAge: cleanText(eligibility.maximumAge || "", 40),
      healthyVolunteers:
        typeof eligibility.healthyVolunteers === "boolean" ? eligibility.healthyVolunteers : null,
      criteria: cleanText(eligibility.eligibilityCriteria || "", 1500)
    },
    primaryOutcomes: extractProtocolOutcomes(outcomesModule.primaryOutcomes, 3),
    secondaryOutcomes: extractProtocolOutcomes(outcomesModule.secondaryOutcomes, 3),
    documents: extractDocumentLinks(study, 4),
    demographics: extractDemographics(study),
    arms,
    outcome,
    analysisEligible,
    hasPostedResults,
    randomized,
    completed,
    reasons,
    eligible: reasons.length === 0
  };
}

async function fetchStudies(query) {
  const studies = [];
  let nextPageToken = null;
  let pagesFetched = 0;

  do {
    const url = new URL("https://clinicaltrials.gov/api/v2/studies");
    url.searchParams.set("query.term", query);
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ClinicalTrials.gov request failed: ${response.status}`);
    }

    const payload = await response.json();
    studies.push(...asArray(payload.studies));
    nextPageToken = payload.nextPageToken || null;
    pagesFetched += 1;
  } while (nextPageToken && pagesFetched < MAX_PAGES);

  return { studies, pagesFetched, truncated: Boolean(nextPageToken) };
}

function countReasons(items) {
  const counts = {};
  for (const item of items) {
    for (const reason of item.reasons) {
      counts[reason] = (counts[reason] || 0) + 1;
    }
  }
  return counts;
}

function assignPriorityTier(result) {
  if (!result.ctgovFullCoverage) return "coverage-excluded";
  if (result.includedCount >= 5) return "build-now";
  if (result.includedCount >= 3) return "promising";
  if (result.includedCount >= 2) return "early";
  return "insufficient";
}

async function scanCandidate(candidate) {
  const query = buildQuery(candidate.baseQuery, candidate.keywords || []);
  const fetched = await fetchStudies(query);
  const normalized = fetched.studies.map(normalizeStudy);
  const included = normalized.filter(study => study.eligible);
  const excluded = normalized.filter(study => !study.eligible);
  const ctgovFullCoverage = FULL_CTGOV_RESULTS_TOPIC_SLUGS.has(candidate.slug);
  const ctgovCoverageNote = ctgovFullCoverage
    ? "Curated as a modern topic where the randomized evidence base is expected to be fully representable from CT.gov records with posted results."
    : "Excluded from the portfolio because full randomized evidence coverage cannot be guaranteed from CT.gov results for this legacy or mixed-era topic.";
  const portfolioExclusionReasons = [];
  if (included.length < MIN_INCLUDED_TRIALS) {
    portfolioExclusionReasons.push("insufficient_result_reporting_rcts");
  }
  if (!ctgovFullCoverage) {
    portfolioExclusionReasons.push("full_ctgov_results_coverage_not_confirmed");
  }
  const portfolioEligible = portfolioExclusionReasons.length === 0;
  const portfolioEligibilityMode = portfolioEligible ? "full-ctgov-threshold" : "excluded";
  const portfolioEligibilityReason = portfolioEligible
    ? `Included because ${included.length} randomized trial(s) met the standard >=${MIN_INCLUDED_TRIALS} CT.gov-results threshold and the topic is curated as full-coverage.`
    : `Excluded because ${portfolioExclusionReasons
        .map(reason => reason.replace(/_/g, " "))
        .join(" + ")}.`;
  const result = {
    ...candidate,
    query,
    scannedRecords: normalized.length,
    pagesFetched: fetched.pagesFetched,
    truncated: fetched.truncated,
    includedCount: included.length,
    analysisEligibleCount: included.filter(study => study.analysisEligible).length,
    excludedCount: excluded.length,
    includedStudies: included,
    excludedStudies: excluded.slice(0, 50),
    exclusionReasons: countReasons(excluded),
    ctgovFullCoverage,
    ctgovCoverageNote,
    portfolioEligible,
    portfolioEligibilityMode,
    portfolioEligibilityReason,
    portfolioExclusionReasons
  };
  result.priorityTier = assignPriorityTier(result);
  return result;
}

async function run() {
  const startedAt = new Date().toISOString();
  const results = [];

  for (const candidate of CANDIDATES) {
    process.stdout.write(`Scanning ${candidate.slug}...\n`);
    try {
      const result = await scanCandidate(candidate);
      results.push(result);
      process.stdout.write(
        `  included=${result.includedCount} scanned=${result.scannedRecords} tier=${result.priorityTier}${result.truncated ? " truncated" : ""}\n`
      );
    } catch (error) {
      results.push({
        ...candidate,
        query: buildQuery(candidate.baseQuery, candidate.keywords || []),
        error: error.message,
        scannedRecords: 0,
        includedCount: 0,
        excludedCount: 0,
        includedStudies: [],
        excludedStudies: [],
        exclusionReasons: {},
        ctgovFullCoverage: FULL_CTGOV_RESULTS_TOPIC_SLUGS.has(candidate.slug),
        ctgovCoverageNote: FULL_CTGOV_RESULTS_TOPIC_SLUGS.has(candidate.slug)
          ? "Curated as a modern topic where the randomized evidence base is expected to be fully representable from CT.gov records with posted results."
          : "Excluded from the portfolio because full randomized evidence coverage cannot be guaranteed from CT.gov results for this legacy or mixed-era topic.",
        portfolioEligible: false,
        portfolioEligibilityMode: "error",
        portfolioEligibilityReason: error.message,
        portfolioExclusionReasons: ["scan_error"],
        priorityTier: "error"
      });
      process.stdout.write(`  error=${error.message}\n`);
    }
  }

  const eligible = results
    .filter(result => result.portfolioEligible)
    .sort((a, b) => b.includedCount - a.includedCount || a.label.localeCompare(b.label));

  const payload = {
    generatedAt: new Date().toISOString(),
    startedAt,
    minIncludedTrials: MIN_INCLUDED_TRIALS,
    fullCtgovResultsTopicSlugs: Array.from(FULL_CTGOV_RESULTS_TOPIC_SLUGS),
    pageSize: PAGE_SIZE,
    maxPages: MAX_PAGES,
    totalCandidates: results.length,
    eligibleCount: eligible.length,
    eligibleSlugs: eligible.map(result => result.slug),
    fullCtgovEligibleCount: results.filter(result => result.portfolioEligible && result.ctgovFullCoverage).length,
    coverageExcludedCount: results.filter(result => !result.ctgovFullCoverage).length,
    topics: results
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2));

  process.stdout.write(`\nEligible topics (${eligible.length}/${results.length}):\n`);
  for (const topic of eligible) {
    process.stdout.write(`- ${topic.slug}: ${topic.includedCount} included (${topic.priorityTier})\n`);
  }
  process.stdout.write(`\nSaved ${OUTPUT_PATH}\n`);
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
