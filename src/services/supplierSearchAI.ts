import { GoogleAIBackend, Schema, getAI, getGenerativeModel } from "firebase/ai";
import { app, isFirebaseConfigured } from "../config/firebase";
import type { CreditStart, TaxonomyLists } from "../types/domain";
import type { SupplierSearchIntent } from "../utils/supplierRecommendations";

const aiEnabled = isFirebaseConfigured && import.meta.env.VITE_FIREBASE_AI_ENABLED === "true";
const modelName = import.meta.env.VITE_FIREBASE_AI_MODEL || "gemini-2.5-flash-lite";

const responseSchema = Schema.object({
  properties: {
    acceptsCredit: Schema.boolean({ description: "Whether the user explicitly requires deferred or credit payment." }),
    categories: Schema.array({ items: Schema.string(), description: "Only category values from the supplied taxonomy." }),
    creditDays: Schema.integer({ description: "Requested credit period in days." }),
    creditStart: Schema.enumString({
      enum: ["invoice_date", "delivery_date", "invoice_approval"],
      description: "When the credit period starts.",
    }),
    governorates: Schema.array({ items: Schema.string(), description: "Only governorate values from the supplied taxonomy." }),
    minRating: Schema.number({ description: "Minimum rating from 1 to 5." }),
    inferredProducts: Schema.array({
      items: Schema.string(),
      description: "The normalized product or service names the buyer is asking for.",
    }),
    paymentOptions: Schema.array({
      items: Schema.enumString({ enum: ["cash", "bank_transfer", "usd", "iqd", "official_invoice"] }),
    }),
    searchTerms: Schema.array({
      items: Schema.string(),
      description: "Core products, materials, services, industries, supplier category terms, and useful Arabic/English equivalents.",
    }),
    supplierTypes: Schema.array({
      items: Schema.string(),
      description: "Plain-language supplier types likely to sell the requested item.",
    }),
  },
  optionalProperties: ["acceptsCredit", "creditDays", "creditStart", "inferredProducts", "minRating", "supplierTypes"],
});

export async function parseSupplierSearchWithGemini(
  query: string,
  taxonomy: TaxonomyLists,
): Promise<Partial<SupplierSearchIntent> | null> {
  if (!aiEnabled || !query.trim()) {
    return null;
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    model: modelName,
    generationConfig: {
      maxOutputTokens: 600,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0,
    },
    systemInstruction:
      "You parse procurement supplier-search requests for Iraq. First infer what type of supplier would sell the requested item, then return structured search intent. Map specific products to likely categories from the supplied taxonomy, e.g. differential pressure gauges are instrumentation/measurement and control, mechanical seals are mechanical/rotating equipment, cable trays are electrical/cable management. Do not invent supplier facts. Convert a month to 30 days. Interpret 'after invoicing' as invoice_date. Keep product, service, and supplier-type terms concise and include useful Arabic/English equivalents.",
  });

  const taxonomySummary = {
    categories: taxonomy.supplierCategories.map((item) => ({
      labelAr: item.labelAr,
      labelEn: item.labelEn,
      value: item.value,
    })),
    governorates: taxonomy.governorates.map((item) => ({
      labelAr: item.labelAr,
      labelEn: item.labelEn,
      value: item.value,
    })),
  };
  const result = await model.generateContent(
    `Available taxonomy:\n${JSON.stringify(taxonomySummary)}\n\nUser request:\n${query}`,
  );
  const parsed = JSON.parse(result.response.text()) as {
    acceptsCredit?: boolean;
    categories?: string[];
    creditDays?: number;
    creditStart?: CreditStart;
    governorates?: string[];
    minRating?: number;
    inferredProducts?: string[];
    paymentOptions?: string[];
    searchTerms?: string[];
    supplierTypes?: string[];
  };

  return {
    acceptsCredit: parsed.acceptsCredit,
    categories: validValues(parsed.categories, taxonomy.supplierCategories.map((item) => item.value)),
    creditDays: validNumber(parsed.creditDays, 1, 365),
    creditStart: ["invoice_date", "delivery_date", "invoice_approval"].includes(parsed.creditStart || "")
      ? parsed.creditStart
      : undefined,
    governorates: validValues(parsed.governorates, taxonomy.governorates.map((item) => item.value)),
    inferredProducts: (parsed.inferredProducts || []).map((item) => item.trim()).filter(Boolean).slice(0, 5),
    minRating: validNumber(parsed.minRating, 1, 5),
    paymentOptions: validValues(parsed.paymentOptions, ["cash", "bank_transfer", "usd", "iqd", "official_invoice"]),
    searchTerms: (parsed.searchTerms || []).map((item) => item.trim()).filter(Boolean).slice(0, 14),
    supplierTypes: (parsed.supplierTypes || []).map((item) => item.trim()).filter(Boolean).slice(0, 6),
  };
}

export function isGeminiSupplierSearchEnabled() {
  return aiEnabled;
}

function validValues(values: string[] | undefined, allowed: string[]) {
  return Array.from(new Set((values || []).filter((item) => allowed.includes(item))));
}

function validNumber(value: number | undefined, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}
