export interface ProcurementOntologyEntry {
  categories: string[];
  productAr: string;
  productEn: string;
  supplierTypesAr: string[];
  supplierTypesEn: string[];
  terms: string[];
  triggers: string[];
}

export interface ProcurementOntologyMatch {
  categories: string[];
  products: string[];
  searchTerms: string[];
  supplierTypes: string[];
}

const entries: ProcurementOntologyEntry[] = [
  {
    productEn: "Differential pressure gauge",
    productAr: "مقياس ضغط تفاضلي",
    triggers: ["differential pressure gauge", "dp gauge", "differential gauge", "pressure differential gauge"],
    categories: ["instrumentation", "oil_gas_materials", "power_plant_materials"],
    supplierTypesEn: ["Instrumentation suppliers", "Measurement and control companies", "Oil and gas instrument distributors"],
    supplierTypesAr: ["شركات القياس والسيطرة", "مجهزو أجهزة القياس", "موزعو أجهزة النفط والغاز"],
    terms: [
      "differential pressure gauge",
      "dp gauge",
      "pressure gauge",
      "pressure instrument",
      "process instrumentation",
      "instrumentation",
      "measurement control",
      "oil gas instruments",
      "mechanical pressure gauge",
      "manometer",
      "gauge",
      "قياس وسيطرة",
      "اجهزة قياس",
      "مقياس ضغط",
      "ضغط تفاضلي",
    ],
  },
  {
    productEn: "Pressure transmitter",
    productAr: "مرسل ضغط",
    triggers: ["pressure transmitter", "pressure transducer", "pressure sensor"],
    categories: ["instrumentation", "oil_gas_materials", "power_plant_materials"],
    supplierTypesEn: ["Instrumentation suppliers", "Automation and control companies"],
    supplierTypesAr: ["شركات القياس والسيطرة", "شركات الأتمتة والتحكم"],
    terms: ["pressure transmitter", "pressure transducer", "pressure sensor", "instrumentation", "automation", "process control", "مرسل ضغط", "حساس ضغط"],
  },
  {
    productEn: "Flow meter",
    productAr: "مقياس جريان",
    triggers: ["flow meter", "flowmeter", "magnetic flow meter", "coriolis flow meter", "ultrasonic flow meter"],
    categories: ["instrumentation", "oil_gas_materials", "power_plant_materials"],
    supplierTypesEn: ["Instrumentation suppliers", "Measurement and control companies"],
    supplierTypesAr: ["شركات القياس والسيطرة", "مجهزو أجهزة القياس"],
    terms: ["flow meter", "flowmeter", "flow measurement", "instrumentation", "process instruments", "مقياس جريان", "عداد جريان"],
  },
  {
    productEn: "PLC and control panel",
    productAr: "PLC ولوحات سيطرة",
    triggers: ["plc", "control panel", "automation panel", "scada", "dcs"],
    categories: ["instrumentation", "electrical_materials", "it_electronics"],
    supplierTypesEn: ["Automation companies", "Control system integrators", "Electrical panel builders"],
    supplierTypesAr: ["شركات الأتمتة", "شركات أنظمة السيطرة", "مصنعي لوحات كهربائية"],
    terms: ["plc", "scada", "dcs", "control panel", "automation", "control system", "electrical panel", "لوحات سيطرة", "اتمتة"],
  },
  {
    productEn: "Mechanical seal",
    productAr: "مانع تسرب ميكانيكي",
    triggers: ["mechanical seal", "pump seal", "seal kit"],
    categories: ["mechanical_materials", "maintenance_services", "oil_gas_materials"],
    supplierTypesEn: ["Pump spare parts suppliers", "Rotating equipment suppliers", "Mechanical maintenance companies"],
    supplierTypesAr: ["مجهزو قطع المضخات", "مجهزو المعدات الدوارة", "شركات الصيانة الميكانيكية"],
    terms: ["mechanical seal", "pump seal", "rotating equipment", "pump spare parts", "seal kit", "مانع تسرب", "سيل مضخة"],
  },
  {
    productEn: "Industrial pump",
    productAr: "مضخة صناعية",
    triggers: ["pump", "centrifugal pump", "submersible pump", "gear pump", "diaphragm pump"],
    categories: ["mechanical_materials", "oil_gas_materials", "power_plant_materials"],
    supplierTypesEn: ["Pump suppliers", "Rotating equipment suppliers", "Mechanical equipment traders"],
    supplierTypesAr: ["مجهزو المضخات", "مجهزو المعدات الدوارة", "تجار المعدات الميكانيكية"],
    terms: ["pump", "centrifugal pump", "submersible pump", "rotating equipment", "mechanical equipment", "مضخة", "مضخات"],
  },
  {
    productEn: "Industrial valve",
    productAr: "صمام صناعي",
    triggers: ["valve", "gate valve", "globe valve", "ball valve", "butterfly valve", "check valve", "control valve"],
    categories: ["valves", "piping_materials", "oil_gas_materials"],
    supplierTypesEn: ["Valve suppliers", "Piping material suppliers", "Oil and gas material traders"],
    supplierTypesAr: ["مجهزو الصمامات", "مجهزو مواد الأنابيب", "تجار مواد النفط والغاز"],
    terms: ["valve", "gate valve", "globe valve", "ball valve", "butterfly valve", "control valve", "piping", "صمام", "صمامات"],
  },
  {
    productEn: "Cable tray",
    productAr: "حامل كابلات",
    triggers: ["cable tray", "cable ladder", "cable trunking"],
    categories: ["electrical_materials", "steel_fabrication"],
    supplierTypesEn: ["Electrical material suppliers", "Cable management suppliers", "Steel fabrication workshops"],
    supplierTypesAr: ["مجهزو المواد الكهربائية", "مجهزو حوامل الكابلات", "ورش تصنيع معدني"],
    terms: ["cable tray", "cable ladder", "cable management", "electrical materials", "galvanized tray", "حامل كابلات", "تري كابل"],
  },
  {
    productEn: "Gasket",
    productAr: "كاسكيت",
    triggers: ["gasket", "spiral wound gasket", "ring gasket", "rubber gasket"],
    categories: ["flanges_fittings", "piping_materials", "mechanical_materials"],
    supplierTypesEn: ["Piping material suppliers", "Flange and fitting suppliers", "Mechanical spare parts traders"],
    supplierTypesAr: ["مجهزو مواد الأنابيب", "مجهزو الفلنجات والملحقات", "تجار القطع الميكانيكية"],
    terms: ["gasket", "spiral wound gasket", "ring gasket", "flange gasket", "piping", "flanges", "كاسكيت", "جوان"],
  },
  {
    productEn: "PPE and safety equipment",
    productAr: "معدات سلامة",
    triggers: ["ppe", "helmet", "safety shoes", "coverall", "safety gloves", "fire extinguisher"],
    categories: ["safety_ppe"],
    supplierTypesEn: ["Safety equipment suppliers", "PPE traders"],
    supplierTypesAr: ["مجهزو معدات السلامة", "تجار معدات الوقاية الشخصية"],
    terms: ["ppe", "safety", "helmet", "safety shoes", "coverall", "gloves", "معدات سلامة", "خوذة", "أحذية سلامة"],
  },
];

export function inferProcurementOntology(query: string, allowedCategories: string[], locale: "ar" | "en"): ProcurementOntologyMatch {
  const normalizedQuery = normalizeOntologyText(query);
  const allowed = new Set(allowedCategories);
  const matches = entries.filter((entry) =>
    entry.triggers.some((trigger) => triggerMatches(normalizedQuery, normalizeOntologyText(trigger))),
  );

  return {
    categories: unique(matches.flatMap((entry) => entry.categories).filter((category) => allowed.has(category))),
    products: unique(matches.map((entry) => (locale === "ar" ? entry.productAr : entry.productEn))),
    searchTerms: unique(matches.flatMap((entry) => entry.terms)).slice(0, 24),
    supplierTypes: unique(matches.flatMap((entry) => (locale === "ar" ? entry.supplierTypesAr : entry.supplierTypesEn))).slice(0, 8),
  };
}

function triggerMatches(query: string, trigger: string) {
  if (!query || !trigger) {
    return false;
  }
  if (query.includes(trigger)) {
    return true;
  }
  const tokens = trigger.split(" ").filter((token) => token.length > 1);
  return tokens.length > 1 && tokens.every((token) => query.includes(token));
}

function normalizeOntologyText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
