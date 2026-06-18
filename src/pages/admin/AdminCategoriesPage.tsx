import { useTranslation } from "react-i18next";
import { Section } from "../../components/ui";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import { capabilityTags } from "../../data/constants";

export function AdminCategoriesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { taxonomy } = useTaxonomy();
  const groups = [
    [t("governorates"), taxonomy.governorates],
    [t("supplierCategoryList"), taxonomy.supplierCategories],
    [t("capabilityTags"), capabilityTags],
  ] as const;

  return (
    <Section title={t("categories")} description={t("seedDefaults")}>
      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map(([title, items]) => (
          <div className="rounded-md border border-slate-200 p-4" key={title}>
            <h3 className="font-bold text-ink">{title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {items.map((item) => (
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600" key={item.value}>
                  {locale === "ar" ? item.labelAr : item.labelEn}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
