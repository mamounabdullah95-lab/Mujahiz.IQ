import { FormEvent, useEffect, useState } from "react";
import { Database, Plus, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Section, TextField } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import { getPlatformSettings, savePlatformSettings, seedDefaultLists } from "../../services/firestore";
import type { PlatformSettings, TaxonomyItem, TaxonomyLists } from "../../types/domain";
import { slugFromLabel, taxonomyFromSettings } from "../../utils/taxonomy";

type TaxonomyGroup = keyof TaxonomyLists;

const emptyItem: TaxonomyItem = { value: "", labelEn: "", labelAr: "" };

export function AdminSettingsPage() {
  const { t } = useTranslation();
  const { firebaseUser, isOwner } = useAuth();
  const { reloadTaxonomy } = useTaxonomy();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyLists>(() => taxonomyFromSettings());
  const [message, setMessage] = useState("");

  useEffect(() => {
    void getPlatformSettings().then((result) => {
      setSettings(result);
      setTaxonomy(taxonomyFromSettings(result));
    });
  }, []);

  if (!settings) {
    return <Section title={t("settings")}><div>{t("loading")}</div></Section>;
  }

  const setNumber = (key: keyof PlatformSettings, value: string) =>
    setSettings((current) => (current ? { ...current, [key]: Number(value) } : current));
  const setBoolean = (key: keyof PlatformSettings, value: boolean) =>
    setSettings((current) => (current ? { ...current, [key]: value } : current));

  function updateTaxonomyItem(group: TaxonomyGroup, index: number, patch: Partial<TaxonomyItem>) {
    setTaxonomy((current) => ({
      ...current,
      [group]: current[group].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function addTaxonomyItem(group: TaxonomyGroup) {
    setTaxonomy((current) => ({
      ...current,
      [group]: [...current[group], emptyItem],
    }));
  }

  function removeTaxonomyItem(group: TaxonomyGroup, index: number) {
    setTaxonomy((current) => ({
      ...current,
      [group]: current[group].filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function normalizedTaxonomy() {
    const normalize = (items: TaxonomyItem[]) =>
      items
        .map((item) => {
          const labelEn = item.labelEn.trim();
          const labelAr = item.labelAr.trim();
          const value = item.value.trim() || slugFromLabel(labelEn || labelAr);
          return { value, labelEn: labelEn || value.replaceAll("_", " "), labelAr: labelAr || labelEn || value };
        })
        .filter((item) => item.value && item.labelEn && item.labelAr);
    return {
      governorates: normalize(taxonomy.governorates),
      supplierCategories: normalize(taxonomy.supplierCategories),
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!firebaseUser || !settings || !isOwner) return;
    const nextSettings = { ...settings, taxonomy: normalizedTaxonomy() };
    await savePlatformSettings(nextSettings, firebaseUser.uid);
    setSettings(nextSettings);
    setTaxonomy(taxonomyFromSettings(nextSettings));
    await reloadTaxonomy();
    setMessage(t("saved"));
  }

  async function seed() {
    if (!firebaseUser || !isOwner) return;
    await seedDefaultLists(firebaseUser.uid);
    const nextSettings = await getPlatformSettings();
    setSettings(nextSettings);
    setTaxonomy(taxonomyFromSettings(nextSettings));
    await reloadTaxonomy();
    setMessage(t("defaultsSeeded"));
  }

  return (
    <Section title={t("settings")} description={isOwner ? t("access") : t("ownerOnlySettings")}>
      <form className="grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField disabled={!isOwner} label={t("requiredSuppliersPerMonth")} type="number" min={1} value={settings.requiredApprovedSuppliersPerMonth} onChange={(event) => setNumber("requiredApprovedSuppliersPerMonth", event.target.value)} />
          <TextField disabled={!isOwner} label={t("daysGrantedPerBatch")} type="number" min={1} value={settings.daysGrantedPerBatch} onChange={(event) => setNumber("daysGrantedPerBatch", event.target.value)} />
          <TextField disabled={!isOwner} label={t("maximumStackableMonths")} type="number" min={1} value={settings.maximumStackableMonths} onChange={(event) => setNumber("maximumStackableMonths", event.target.value)} />
          <TextField disabled={!isOwner} label={t("gracePeriodDays")} type="number" min={0} value={settings.gracePeriodDays} onChange={(event) => setNumber("gracePeriodDays", event.target.value)} />
          <TextField disabled={!isOwner} label={t("trialAccessDays")} type="number" min={0} value={settings.trialAccessDays} onChange={(event) => setNumber("trialAccessDays", event.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input disabled={!isOwner} type="checkbox" checked={settings.reviewsEarnBonusPoints} onChange={(event) => setBoolean("reviewsEarnBonusPoints", event.target.checked)} />
          {t("reviewsEarnBonusPoints")}
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input disabled={!isOwner} type="checkbox" checked={settings.updateContributionsCanEarnAccessBonus} onChange={(event) => setBoolean("updateContributionsCanEarnAccessBonus", event.target.checked)} />
          {t("updateContributionsCanEarnAccessBonus")}
        </label>

        <TaxonomyEditor
          disabled={!isOwner}
          group="governorates"
          items={taxonomy.governorates}
          title={t("governorates")}
          onAdd={() => addTaxonomyItem("governorates")}
          onRemove={(index) => removeTaxonomyItem("governorates", index)}
          onUpdate={(index, patch) => updateTaxonomyItem("governorates", index, patch)}
        />

        <TaxonomyEditor
          disabled={!isOwner}
          group="supplierCategories"
          items={taxonomy.supplierCategories}
          title={t("supplierCategoryList")}
          onAdd={() => addTaxonomyItem("supplierCategories")}
          onRemove={(index) => removeTaxonomyItem("supplierCategories", index)}
          onUpdate={(index, patch) => updateTaxonomyItem("supplierCategories", index, patch)}
        />

        {message ? <div className="text-sm font-semibold text-river">{message}</div> : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!isOwner} type="submit">
            <Save className="h-4 w-4" aria-hidden="true" />
            {t("updateSettings")}
          </Button>
          <Button disabled={!isOwner} type="button" variant="secondary" onClick={() => void seed()}>
            <Database className="h-4 w-4" aria-hidden="true" />
            {t("seedDefaults")}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function TaxonomyEditor({
  disabled,
  items,
  title,
  onAdd,
  onRemove,
  onUpdate,
}: {
  disabled: boolean;
  group: TaxonomyGroup;
  items: TaxonomyItem[];
  title: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<TaxonomyItem>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-ink">{title}</h3>
        <Button disabled={disabled} type="button" variant="secondary" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("addItem")}
        </Button>
      </div>
      <div className="grid gap-3">
        {items.map((item, index) => (
          <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto]" key={`${item.value}-${index}`}>
            <TextField disabled={disabled} label={t("itemKey")} value={item.value} onChange={(event) => onUpdate(index, { value: event.target.value })} />
            <TextField disabled={disabled} label={t("englishLabel")} value={item.labelEn} onChange={(event) => onUpdate(index, { labelEn: event.target.value })} />
            <TextField disabled={disabled} label={t("arabicLabel")} value={item.labelAr} onChange={(event) => onUpdate(index, { labelAr: event.target.value })} />
            <div className="flex items-end">
              <Button disabled={disabled || items.length <= 1} type="button" variant="danger" onClick={() => onRemove(index)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
