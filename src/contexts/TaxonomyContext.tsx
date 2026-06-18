import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getPlatformSettings } from "../services/firestore";
import type { TaxonomyLists } from "../types/domain";
import { taxonomyFromSettings } from "../utils/taxonomy";

interface TaxonomyContextValue {
  taxonomy: TaxonomyLists;
  reloadTaxonomy: () => Promise<void>;
}

const TaxonomyContext = createContext<TaxonomyContextValue | null>(null);

export function TaxonomyProvider({ children }: { children: ReactNode }) {
  const [taxonomy, setTaxonomy] = useState<TaxonomyLists>(() => taxonomyFromSettings());

  const reloadTaxonomy = useCallback(async () => {
    const settings = await getPlatformSettings();
    setTaxonomy(taxonomyFromSettings(settings));
  }, []);

  useEffect(() => {
    void reloadTaxonomy();
    const sync = () => void reloadTaxonomy();
    window.addEventListener("mujahiz-iq-demo-db-updated", sync);
    window.addEventListener("mujahiz-iq-taxonomy-updated", sync);
    return () => {
      window.removeEventListener("mujahiz-iq-demo-db-updated", sync);
      window.removeEventListener("mujahiz-iq-taxonomy-updated", sync);
    };
  }, [reloadTaxonomy]);

  const value = useMemo(() => ({ taxonomy, reloadTaxonomy }), [reloadTaxonomy, taxonomy]);

  return <TaxonomyContext.Provider value={value}>{children}</TaxonomyContext.Provider>;
}

export function useTaxonomy() {
  const context = useContext(TaxonomyContext);
  if (!context) {
    throw new Error("useTaxonomy must be used inside TaxonomyProvider.");
  }
  return context;
}
