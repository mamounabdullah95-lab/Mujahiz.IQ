import type { MaterialTerm, TaxonomyLists } from "../types/domain";

const stopWords = new Set(["a", "an", "and", "are", "as", "at", "by", "can", "for", "from", "has", "have", "i", "in", "is", "it", "need", "needs", "or", "supplier", "suppliers", "the", "to", "want", "with", "bank", "cash", "credit", "invoice", "transfer", "payment", "terms", "اريد", "أريد", "احتاج", "أحتاج", "ابحث", "عن", "في", "من", "الى", "إلى", "او", "أو", "و", "مع", "مجهز", "مجهزين", "شركة", "شركات", "لديه", "لديها", "يقبل", "تقبل", "دفع", "مصرفي", "نقدي", "بعد", "قبل"]);

export function normalizeDictionaryText(value?: string) {
  return (value || "").trim().toLowerCase().replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^a-z0-9\u0600-\u06ff.+#/-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function materialAliases(term: MaterialTerm) {
  return Array.from(new Set([term.canonicalEn, term.canonicalAr, ...term.synonyms, ...term.brands, ...term.standards, ...term.subcategories].filter(Boolean)));
}

function aliasesByLength(term: MaterialTerm) {
  return materialAliases(term).map((alias) => ({ alias, normalized: normalizeDictionaryText(alias) })).filter((item) => item.normalized.length >= 2).sort((a, b) => b.normalized.length - a.normalized.length);
}

export function matchMaterialTerms(queryText: string, terms: MaterialTerm[]) {
  const normalizedQuery = normalizeDictionaryText(queryText);
  if (!normalizedQuery) return [];
  const padded = ` ${normalizedQuery} `;
  return terms.filter((term) => aliasesByLength(term).some(({ normalized }) => padded.includes(` ${normalized} `) || normalizedQuery === normalized));
}

export function expandSearchWithMaterialTerms(queryText: string, terms: MaterialTerm[]) {
  const matchedTerms = matchMaterialTerms(queryText, terms);
  const expandedTerms = Array.from(new Set(matchedTerms.flatMap((term) => [term.canonicalEn, term.canonicalAr, term.category, ...term.synonyms, ...term.brands, ...term.standards])));
  return { expandedQuery: [queryText, ...expandedTerms].filter(Boolean).join(" "), matchedTerms };
}

export function expandIntentTerms(searchTerms: string[], terms: MaterialTerm[]) {
  const matchedTerms = matchMaterialTerms(searchTerms.join(" "), terms);
  return {
    categories: Array.from(new Set(matchedTerms.map((term) => term.category).filter(Boolean))),
    searchTerms: Array.from(new Set([...searchTerms, ...matchedTerms.flatMap((term) => [term.canonicalEn, term.canonicalAr, term.category, ...term.synonyms, ...term.brands, ...term.standards])].filter(Boolean))),
    matchedTerms,
  };
}

function knownPhrases(taxonomy: TaxonomyLists, terms: MaterialTerm[]) {
  const values = [...taxonomy.governorates.flatMap((item) => [item.value, item.labelEn, item.labelAr]), ...taxonomy.supplierCategories.flatMap((item) => [item.value, item.labelEn, item.labelAr]), ...terms.flatMap((term) => [term.category, ...materialAliases(term)])];
  return new Set(values.map(normalizeDictionaryText).filter(Boolean));
}

function useful(value: string) {
  if (!value || stopWords.has(value) || /^\d+$/.test(value) || /^[a-z\u0600-\u06ff]{1,2}$/i.test(value)) return false;
  return /[a-z\u0600-\u06ff]/i.test(value) || /\d/.test(value);
}

export function analyzeUnknownMaterialPhrases(queryText: string, taxonomy: TaxonomyLists, terms: MaterialTerm[]) {
  const known = knownPhrases(taxonomy, terms);
  const rawTokens = queryText.split(/[\s,;،؛|\\()[\]{}]+/).map((item) => item.trim()).filter(Boolean);
  const tokens = rawTokens.map((raw, index) => ({ raw, normalized: normalizeDictionaryText(raw), index })).filter((item) => item.normalized && !stopWords.has(item.normalized) && !known.has(item.normalized));
  const suggestions: string[] = [];
  const covered = new Set<number>();
  for (let size = Math.min(5, tokens.length); size >= 2; size -= 1) {
    for (let start = 0; start <= tokens.length - size; start += 1) {
      const group = tokens.slice(start, start + size);
      if (group.some((item, index) => index > 0 && item.index !== group[index - 1].index + 1) || group.some((item) => covered.has(item.index))) continue;
      const normalized = group.map((item) => item.normalized).join(" ");
      if (!useful(normalized) || known.has(normalized)) continue;
      suggestions.push(group.map((item) => item.raw).join(" "));
      group.forEach((item) => covered.add(item.index));
      if (suggestions.length >= 8) return suggestions;
    }
  }
  tokens.filter((item) => !covered.has(item.index) && useful(item.normalized)).forEach((item) => { if (suggestions.length < 8) suggestions.push(item.raw); });
  return suggestions;
}

export function suggestUnknownTerms(queryText: string, taxonomy: TaxonomyLists, terms: MaterialTerm[]) {
  if (matchMaterialTerms(queryText, terms).length) return [];
  return analyzeUnknownMaterialPhrases(queryText, taxonomy, terms);
}
