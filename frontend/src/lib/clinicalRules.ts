export interface ClinicalRule {
  id: string;
  category: (t?: any) => string;
  matchers: string[];
  tipTitle: (medName: string, t?: any) => string;
  tipBody: (medName: string, t?: any) => string;
  badgeColor: string;
  iconName: string;
}

export const CLINICAL_RULES: ClinicalRule[] = [
  {
    id: "ppi_antacid",
    category: (t) => t ? t("clinical.ppi.category", "Proton Pump Inhibitors / Antacids") : "Proton Pump Inhibitors / Antacids",
    matchers: ["pan", "pantop", "omepra", "rabe", "esomep", "gelusil", "digene", "sucraflate", "antacid"],
    tipTitle: (med, t) => t ? t("clinical.ppi.title", `Clinical Timing Tip: ${med}`, { med }) : `Clinical Timing Tip: ${med}`,
    tipBody: (med, t) => t ? t("clinical.ppi.body", `${med} works 3x better when taken 30 minutes BEFORE breakfast on an empty stomach to maximize proton pump inhibition.`, { med }) : `${med} works 3x better when taken 30 minutes BEFORE breakfast on an empty stomach to maximize proton pump inhibition.`,
    badgeColor: "#38bdf8",
    iconName: "medical-outline"
  },
  {
    id: "thyroid",
    category: (t) => t ? t("clinical.thyroid.category", "Thyroid Therapy") : "Thyroid Therapy",
    matchers: ["thyro", "thyrox", "levo", "eltroxin"],
    tipTitle: (med, t) => t ? t("clinical.thyroid.title", `Empty Stomach Protocol: ${med}`, { med }) : `Empty Stomach Protocol: ${med}`,
    tipBody: (med, t) => t ? t("clinical.thyroid.body", `Take ${med} first thing in the morning with a full glass of water, at least 45-60 minutes before breakfast or coffee.`, { med }) : `Take ${med} first thing in the morning with a full glass of water, at least 45-60 minutes before breakfast or coffee.`,
    badgeColor: "#a78bfa",
    iconName: "time-outline"
  },
  {
    id: "antidiabetic",
    category: (t) => t ? t("clinical.antidiabetic.category", "Diabetes & Blood Sugar Management") : "Diabetes & Blood Sugar Management",
    matchers: ["metformin", "glycomet", "teneli", "glime", "janumet", "vilda", "dapa", "empagli", "insulin"],
    tipTitle: (med, t) => t ? t("clinical.antidiabetic.title", `Meal Correlation Tip: ${med}`, { med }) : `Meal Correlation Tip: ${med}`,
    tipBody: (med, t) => t ? t("clinical.antidiabetic.body", `Take ${med} WITH or immediately AFTER meals to minimize gastrointestinal discomfort and ensure smooth glycemic control.`, { med }) : `Take ${med} WITH or immediately AFTER meals to minimize gastrointestinal discomfort and ensure smooth glycemic control.`,
    badgeColor: "#4ade80",
    iconName: "restaurant-outline"
  },
  {
    id: "antihypertensive",
    category: (t) => t ? t("clinical.antihypertensive.category", "Cardiovascular & BP Care") : "Cardiovascular & BP Care",
    matchers: ["amlo", "telmi", "enala", "losar", "metoprolol", "ciplar", "ateno", "ramipril"],
    tipTitle: (med, t) => t ? t("clinical.antihypertensive.title", `Dosing Consistency: ${med}`, { med }) : `Dosing Consistency: ${med}`,
    tipBody: (med, t) => t ? t("clinical.antihypertensive.body", `Maintain fixed daily timing for ${med}. Evening dosing of BP medications helps maintain natural nocturnal blood pressure dipping.`, { med }) : `Maintain fixed daily timing for ${med}. Evening dosing of BP medications helps maintain natural nocturnal blood pressure dipping.`,
    badgeColor: "#f87171",
    iconName: "heart-outline"
  },
  {
    id: "statin",
    category: (t) => t ? t("clinical.statin.category", "Lipid & Cholesterol Optimization") : "Lipid & Cholesterol Optimization",
    matchers: ["atorva", "rosuva", "simva", "lipa", "pravastatin"],
    tipTitle: (med, t) => t ? t("clinical.statin.title", `Chronotherapy Tip: ${med}`, { med }) : `Chronotherapy Tip: ${med}`,
    tipBody: (med, t) => t ? t("clinical.statin.body", `${med} is most effective when taken in the EVENING or at BEDTIME because hepatic cholesterol synthesis peaks overnight.`, { med }) : `${med} is most effective when taken in the EVENING or at BEDTIME because hepatic cholesterol synthesis peaks overnight.`,
    badgeColor: "#fbbf24",
    iconName: "moon-outline"
  },
  {
    id: "nsaid",
    category: (t) => t ? t("clinical.nsaid.category", "Analgesics & Anti-Inflammatory") : "Analgesics & Anti-Inflammatory",
    matchers: ["parac", "crocin", "dolo", "ibup", "combi", "diclo", "naprox", "aceclo"],
    tipTitle: (med, t) => t ? t("clinical.nsaid.title", `Stomach Protection: ${med}`, { med }) : `Stomach Protection: ${med}`,
    tipBody: (med, t) => t ? t("clinical.nsaid.body", `Always take ${med} after food or with milk to prevent gastric irritation and protect stomach mucosa.`, { med }) : `Always take ${med} after food or with milk to prevent gastric irritation and protect stomach mucosa.`,
    badgeColor: "#f472b6",
    iconName: "shield-checkmark-outline"
  },
  {
    id: "antibiotic",
    category: (t) => t ? t("clinical.antibiotic.category", "Antibacterial Course") : "Antibacterial Course",
    matchers: ["amox", "azithro", "cipro", "augmentin", "oflox", "cefix", "doxy"],
    tipTitle: (med, t) => t ? t("clinical.antibiotic.title", `Full Course Compliance: ${med}`, { med }) : `Full Course Compliance: ${med}`,
    tipBody: (med, t) => t ? t("clinical.antibiotic.body", `Complete the full prescribed duration of ${med} at even intervals, even if symptoms subside early.`, { med }) : `Complete the full prescribed duration of ${med} at even intervals, even if symptoms subside early.`,
    badgeColor: "#c084fc",
    iconName: "ribbon-outline"
  },
  {
    id: "supplement",
    category: (t) => t ? t("clinical.supplement.category", "Vitamins & Mineral Supplements") : "Vitamins & Mineral Supplements",
    matchers: ["shelcal", "evion", "supra", "calc", "vit", "zinc", "ferro", "autrin", "urisee"],
    tipTitle: (med, t) => t ? t("clinical.supplement.title", `Absorption Tip: ${med}`, { med }) : `Absorption Tip: ${med}`,
    tipBody: (med, t) => t ? t("clinical.supplement.body", `Take ${med} with main meals containing healthy fats for superior fat-soluble nutrient bioavailability.`, { med }) : `Take ${med} with main meals containing healthy fats for superior fat-soluble nutrient bioavailability.`,
    badgeColor: "#2dd4bf",
    iconName: "sparkles-outline"
  }
];

export function getClinicalTipsForMedications(medications: any[], t?: any) {
  const tips: Array<{ medName: string; rule: ClinicalRule }> = [];
  const seenMeds = new Set<string>();

  for (const med of medications) {
    const medName = med.name || med.genericName || "Medication";
    const nameLower = medName.toLowerCase();
    if (seenMeds.has(nameLower)) continue;

    let matchedRule = CLINICAL_RULES.find((rule) =>
      rule.matchers.some((m) => nameLower.includes(m))
    );

    if (!matchedRule) {
      matchedRule = {
        id: "general",
        category: (tFn) => tFn ? tFn("clinical.general.category", "Routine Medication Management") : "Routine Medication Management",
        matchers: [],
        tipTitle: (m, tFn) => tFn ? tFn("clinical.general.title", `Timing Guidance: ${m}`, { med: m }) : `Timing Guidance: ${m}`,
        tipBody: (m, tFn) => tFn ? tFn("clinical.general.body", `Take ${m} consistently at your scheduled time each day to maintain therapeutic plasma concentrations.`, { med: m }) : `Take ${m} consistently at your scheduled time each day to maintain therapeutic plasma concentrations.`,
        badgeColor: "#8b5cf6",
        iconName: "fitness-outline"
      };
    }

    seenMeds.add(nameLower);
    tips.push({ medName, rule: matchedRule });
  }

  return tips;
}
