import type { MaterialTerm, TaxonomyLists } from "../types/domain";

const dictionaryStopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "can",
  "bank",
  "cash",
  "credit",
  "invoice",
  "for",
  "from",
  "has",
  "have",
  "i",
  "in",
  "is",
  "it",
  "need",
  "needs",
  "or",
  "supplier",
  "suppliers",
  "the",
  "to",
  "want",
  "with",
  "transfer",
  "payment",
  "payments",
  "terms",
  "اريد",
  "أريد",
  "احتاج",
  "أحتاج",
  "ابحث",
  "عن",
  "في",
  "من",
  "الى",
  "إلى",
  "او",
  "أو",
  "و",
  "مع",
  "مجهز",
  "مجهزين",
  "شركة",
  "شركات",
  "لديه",
  "لديها",
  "يقبل",
  "تقبل",
  "دفع",
  "مصرفي",
  "نقدي",
  "بعد",
  "قبل",
  "يوم",
  "شهر",
]);

export function normalizeDictionaryText(value?: string) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function materialAliases(term: MaterialTerm) {
  return Array.from(
    new Set([
      term.canonicalEn,
      term.canonicalAr,
      ...term.synonyms,
      ...term.brands,
      ...term.standards,
      ...term.subcategories,
    ].filter(Boolean)),
  );
}

export function matchMaterialTerms(query: string, terms: MaterialTerm[]) {
  const normalizedQuery = ` ${normalizeDictionaryText(query)} `;
  if (!normalizedQuery.trim()) {
    return [];
  }
  return terms.filter((term) =>
    materialAliases(term).some((alias) => {
      const normalizedAlias = normalizeDictionaryText(alias);
      if (!normalizedAlias || normalizedAlias.length < 2) {
        return false;
      }
      return normalizedQuery.includes(` ${normalizedAlias} `) || normalizedQuery.includes(normalizedAlias);
    }),
  );
}

export function expandSearchWithMaterialTerms(query: string, terms: MaterialTerm[]) {
  const matchedTerms = matchMaterialTerms(query, terms);
  const expandedTerms = Array.from(
    new Set(matchedTerms.flatMap((term) => [term.canonicalEn, term.canonicalAr, term.category, ...term.synonyms, ...term.brands, ...term.standards])),
  );
  return {
    expandedQuery: [query, ...expandedTerms].filter(Boolean).join(" "),
    matchedTerms,
  };
}

export function expandIntentTerms(searchTerms: string[], terms: MaterialTerm[]) {
  const matched = matchMaterialTerms(searchTerms.join(" "), terms);
  return {
    categories: Array.from(new Set(matched.map((term) => term.category).filter(Boolean))),
    searchTerms: Array.from(
      new Set([
        ...searchTerms,
        ...matched.flatMap((term) => [
          term.canonicalEn,
          term.canonicalAr,
          term.category,
          ...term.synonyms,
          ...term.brands,
          ...term.standards,
        ]),
      ].filter(Boolean)),
    ),
    matchedTerms: matched,
  };
}

export function suggestUnknownTerms(query: string, taxonomy: TaxonomyLists, terms: MaterialTerm[]) {
  const known = knownDictionaryTokens(taxonomy, terms);
  const tokens = query
    .split(/[\s,;،؛|/\\()[\]{}]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const suggestions: string[] = [];
  const seen = new Set<string>();

  for (const rawToken of tokens) {
    const normalized = normalizeDictionaryText(rawToken);
    if (!isUsefulCandidate(rawToken, normalized) || known.has(normalized) || seen.has(normalized)) {
      continue;
    }
    suggestions.push(rawToken);
    seen.add(normalized);
    if (suggestions.length >= 8) {
      break;
    }
  }

  return suggestions;
}

function knownDictionaryTokens(taxonomy: TaxonomyLists, terms: MaterialTerm[]) {
  const values = [
    ...taxonomy.governorates.flatMap((item) => [item.value, item.labelEn, item.labelAr]),
    ...taxonomy.supplierCategories.flatMap((item) => [item.value, item.labelEn, item.labelAr]),
    ...terms.flatMap((term) => [term.category, term.canonicalEn, term.canonicalAr, ...materialAliases(term)]),
  ];
  const tokens = new Set<string>();
  values.forEach((value) => {
    const normalized = normalizeDictionaryText(value);
    if (normalized) {
      tokens.add(normalized);
      normalized.split(" ").forEach((token) => {
        if (token.length > 1) {
          tokens.add(token);
        }
      });
    }
  });
  return tokens;
}

function isUsefulCandidate(rawToken: string, normalized: string) {
  if (!normalized || dictionaryStopWords.has(normalized)) {
    return false;
  }
  if (/^\d+$/.test(normalized)) {
    return false;
  }
  if (/^[a-z]$/.test(normalized)) {
    return false;
  }
  if (/^[\u0600-\u06ff]{1,2}$/.test(normalized)) {
    return false;
  }
  if (/^(?:\+?\d[\d\s-]{5,}|[\w.-]+@[\w.-]+)$/.test(rawToken)) {
    return false;
  }
  return /[a-z\u0600-\u06ff]/i.test(normalized) || /\d/.test(normalized);
}
