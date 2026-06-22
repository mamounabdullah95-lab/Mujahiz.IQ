import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, Section, SelectField, TextAreaField, TextField } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import { labelFor } from "../../data/constants";
import {
  approveTermSuggestion,
  ignoreTermSuggestion,
  listMaterialTerms,
  listTermSuggestions,
} from "../../services/firestore";
import type { MaterialTerm, TermSuggestion } from "../../types/domain";

type TermDraft = {
  canonicalEn: string;
  canonicalAr: string;
  category: string;
  subcategories: string;
  synonyms: string;
  brands: string;
  standards: string;
};

export function AdminMaterialDictionaryPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [terms, setTerms] = useState<MaterialTerm[]>([]);
  const [suggestions, setSuggestions] = useState<TermSuggestion[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TermDraft>>({});
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const visibleTerms = useMemo(
    () => [...terms].sort((a, b) => a.canonicalEn.localeCompare(b.canonicalEn)).slice(0, 80),
    [terms],
  );

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const [termResult, suggestionResult] = await Promise.all([listMaterialTerms(), listTermSuggestions("pending")]);
    setTerms(termResult);
    setSuggestions(suggestionResult);
    setDrafts((current) => ({
      ...Object.fromEntries(suggestionResult.map((item) => [item.id, current[item.id] || draftFromSuggestion(item)])),
    }));
  }

  function setDraftValue(id: string, key: keyof TermDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [key]: value,
      },
    }));
  }

  async function approve(item: TermSuggestion) {
    if (!firebaseUser) return;
    const draft = drafts[item.id] || draftFromSuggestion(item);
    if (!draft.category) {
      setMessage(t("materialDictionaryCategoryRequired"));
      return;
    }
    setBusyId(item.id);
    setMessage("");
    try {
      await approveTermSuggestion(item, firebaseUser.uid, {
        canonicalEn: draft.canonicalEn.trim() || item.term,
        canonicalAr: draft.canonicalAr.trim() || item.term,
        category: draft.category,
        subcategories: splitList(draft.subcategories),
        synonyms: splitList(draft.synonyms),
        brands: splitList(draft.brands),
        standards: splitList(draft.standards),
      });
      setMessage(t("termSuggestionApproved"));
      await loadData();
    } finally {
      setBusyId("");
    }
  }

  async function ignore(item: TermSuggestion) {
    if (!firebaseUser) return;
    setBusyId(item.id);
    setMessage("");
    try {
      await ignoreTermSuggestion(item, firebaseUser.uid);
      setMessage(t("termSuggestionIgnored"));
      await loadData();
    } finally {
      setBusyId("");
    }
  }

  return (
    <Section title={t("materialDictionary")} description={t("materialDictionaryDescription")}>
      {message ? <div className="rounded-md border border-mint/30 bg-mint/10 px-3 py-2 text-sm font-semibold text-mint">{message}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-md border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-ink">{t("activeMaterialTerms")}</h3>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{terms.length}</span>
          </div>
          <div className="mt-4 grid max-h-[680px] gap-3 overflow-auto pr-1">
            {visibleTerms.map((term) => (
              <article className="rounded-md border border-slate-200 bg-slate-50 p-3" key={term.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-black text-ink">{locale === "ar" ? term.canonicalAr || term.canonicalEn : term.canonicalEn || term.canonicalAr}</h4>
                    <p className="mt-1 text-xs font-semibold text-river">{labelFor(taxonomy.supplierCategories, term.category, locale)}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500">{term.synonyms.length} {t("synonyms")}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{term.synonyms.slice(0, 12).join(", ")}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-ink">{t("pendingTermSuggestions")}</h3>
            <span className="rounded bg-amber/10 px-2 py-1 text-xs font-bold text-amber">{suggestions.length}</span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">{t("pendingTermSuggestionsDescription")}</p>

          <div className="mt-4 grid gap-4">
            {!suggestions.length ? <EmptyState title={t("noPendingTermSuggestions")} /> : null}
            {suggestions.map((item) => {
              const draft = drafts[item.id] || draftFromSuggestion(item);
              return (
                <article className="rounded-md border border-slate-200 bg-white p-4 shadow-soft" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-black text-ink">{item.term}</h4>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {t("seenCount", { count: item.count || 1 })} · {(item.sources || []).join(", ")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button disabled={busyId === item.id} type="button" onClick={() => void approve(item)}>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        {t("approve")}
                      </Button>
                      <Button disabled={busyId === item.id} type="button" variant="secondary" onClick={() => void ignore(item)}>
                        <X className="h-4 w-4" aria-hidden="true" />
                        {t("ignore")}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <TextField label={t("canonicalEn")} value={draft.canonicalEn} onChange={(event) => setDraftValue(item.id, "canonicalEn", event.target.value)} />
                    <TextField label={t("canonicalAr")} value={draft.canonicalAr} onChange={(event) => setDraftValue(item.id, "canonicalAr", event.target.value)} />
                    <SelectField label={t("mainCategory")} value={draft.category} onChange={(event) => setDraftValue(item.id, "category", event.target.value)}>
                      <option value=""></option>
                      {taxonomy.supplierCategories.map((category) => (
                        <option key={category.value} value={category.value}>{labelFor(taxonomy.supplierCategories, category.value, locale)}</option>
                      ))}
                    </SelectField>
                    <TextField label={t("subcategories")} value={draft.subcategories} onChange={(event) => setDraftValue(item.id, "subcategories", event.target.value)} />
                    <TextAreaField className="md:col-span-2" label={t("synonyms")} rows={3} value={draft.synonyms} onChange={(event) => setDraftValue(item.id, "synonyms", event.target.value)} />
                    <TextField label={t("brands")} value={draft.brands} onChange={(event) => setDraftValue(item.id, "brands", event.target.value)} />
                    <TextField label={t("standards")} value={draft.standards} onChange={(event) => setDraftValue(item.id, "standards", event.target.value)} />
                  </div>

                  {item.examples?.length ? (
                    <div className="mt-4 rounded-md bg-slate-50 p-3">
                      <div className="text-xs font-bold uppercase text-slate-500">{t("examples")}</div>
                      <div className="mt-2 grid gap-2">
                        {item.examples.slice(-2).map((example, index) => (
                          <p className="text-sm leading-6 text-slate-600" key={`${item.id}-${index}`}>{example.queryText}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </Section>
  );
}

function draftFromSuggestion(item: TermSuggestion): TermDraft {
  const hasLatin = /[A-Za-z]/.test(item.term);
  const hasArabic = /[\u0600-\u06ff]/.test(item.term);
  return {
    canonicalEn: hasLatin ? item.term : "",
    canonicalAr: hasArabic ? item.term : "",
    category: item.suggestedCategory || "",
    subcategories: "",
    synonyms: item.term,
    brands: "",
    standards: "",
  };
}

function splitList(value: string) {
  return Array.from(new Set(value.split(/[,،;\n|]+/).map((item) => item.trim()).filter(Boolean)));
}
