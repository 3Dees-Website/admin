import { useState, useEffect } from 'react';
import { fieldCatalogService } from '../services/fieldCatalogService';

/**
 * The field catalog ({ sections, fields, mandatoryKeys, lgasByState }),
 * fetched once (module-cached in fieldCatalogService) and shared by the
 * requirements builder, requirements summary, and application detail view.
 */
export function useFieldCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fieldCatalogService.getFieldCatalog()
      .then((data) => { if (!cancelled) setCatalog(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { catalog, isLoading };
}
