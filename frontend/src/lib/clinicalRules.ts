export interface ClinicalRule {
  id: string;
  category: string;
  matchers: string[];
  tipTitle: (medName: string) => string;
  tipBody: (medName: string) => string;
  badgeColor: string;
  iconName: string;
}

export const CLINICAL_RULES: ClinicalRule[] = [
  {
    id: "ppi_antacid",
    category: "Proton Pump Inhibitors / Antacids",
    matchers: ["pan", "pantop", "omepra", "rabe", "esomep", "gelusil", "digene", "sucraflate", "antacid"],
    tipTitle: (med) => `Clinical Timing Tip: ${med}`,
    tipBody: (med) => `${med} works 3x better when taken 30 minutes BEFORE breakfast on an empty stomach to maximize proton pump inhibition.`,
    badgeColor: "#38bdf8",
    iconName: "medical-outline"
  },
  {
    id: "thyroid",
    category: "Thyroid Therapy",
    matchers: ["thyro", "thyrox", "levo", "eltroxin"],
    tipTitle: (med) => `Empty Stomach Protocol: ${med}`,
    tipBody: (med) => `Take ${med} first thing in the morning with a full glass of water, at least 45-60 minutes before breakfast or coffee.`,
    badgeColor: "#a78bfa",
    iconName: "time-outline"
  },
  {
    id: "antidiabetic",
    category: "Diabetes & Blood Sugar Management",
    matchers: ["metformin", "glycomet", "teneli", "glime", "janumet", "vilda", "dapa", "empagli", "insulin"],
    tipTitle: (med) => `Meal Correlation Tip: ${med}`,
    tipBody: (med) => `Take ${med} WITH or immediately AFTER meals to minimize gastrointestinal discomfort and ensure smooth glycemic control.`,
    badgeColor: "#4ade80",
    iconName: "restaurant-outline"
  },
  {
    id: "antihypertensive",
    category: "Cardiovascular & BP Care",
    matchers: ["amlo", "telmi", "enala", "losar", "metoprolol", "ciplar", "ateno", "ramipril"],
    tipTitle: (med) => `Dosing Consistency: ${med}`,
    tipBody: (med) => `Maintain fixed daily timing for ${med}. Evening dosing of BP medications helps maintain natural nocturnal blood pressure dipping.`,
    badgeColor: "#f87171",
    iconName: "heart-outline"
  },
  {
    id: "statin",
    category: "Lipid & Cholesterol Optimization",
    matchers: ["atorva", "rosuva", "simva", "lipa", "pravastatin"],
    tipTitle: (med) => `Chronotherapy Tip: ${med}`,
    tipBody: (med) => `${med} is most effective when taken in the EVENING or at BEDTIME because hepatic cholesterol synthesis peaks overnight.`,
    badgeColor: "#fbbf24",
    iconName: "moon-outline"
  },
  {
    id: "nsaid",
    category: "Analgesics & Anti-Inflammatory",
    matchers: ["parac", "crocin", "dolo", "ibup", "combi", "diclo", "naprox", "aceclo"],
    tipTitle: (med) => `Stomach Protection: ${med}`,
    tipBody: (med) => `Always take ${med} after food or with milk to prevent gastric irritation and protect stomach mucosa.`,
    badgeColor: "#f472b6",
    iconName: "shield-checkmark-outline"
  },
  {
    id: "antibiotic",
    category: "Antibacterial Course",
    matchers: ["amox", "azithro", "cipro", "augmentin", "oflox", "cefix", "doxy"],
    tipTitle: (med) => `Full Course Compliance: ${med}`,
    tipBody: (med) => `Complete the full prescribed duration of ${med} at even intervals, even if symptoms subside early.`,
    badgeColor: "#c084fc",
    iconName: "ribbon-outline"
  },
  {
    id: "supplement",
    category: "Vitamins & Mineral Supplements",
    matchers: ["shelcal", "evion", "supra", "calc", "vit", "zinc", "ferro", "autrin", "urisee"],
    tipTitle: (med) => `Absorption Tip: ${med}`,
    tipBody: (med) => `Take ${med} with main meals containing healthy fats for superior fat-soluble nutrient bioavailability.`,
    badgeColor: "#2dd4bf",
    iconName: "sparkles-outline"
  }
];

export function getClinicalTipsForMedications(medications: any[]) {
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
        category: "Routine Medication Management",
        matchers: [],
        tipTitle: (m) => `Timing Guidance: ${m}`,
        tipBody: (m) => `Take ${m} consistently at your scheduled time each day to maintain therapeutic plasma concentrations.`,
        badgeColor: "#8b5cf6",
        iconName: "fitness-outline"
      };
    }

    seenMeds.add(nameLower);
    tips.push({ medName, rule: matchedRule });
  }

  return tips;
}
