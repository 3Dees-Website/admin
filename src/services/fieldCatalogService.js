import { apiClient } from './apiClient';

// The catalog is effectively static (24h Cache-Control on the backend) —
// fetch once per session and reuse the same promise for every caller.
let cachedPromise = null;

export const fieldCatalogService = {
  getFieldCatalog() {
    if (!cachedPromise) {
      cachedPromise = apiClient.get('/api/field-catalog')
        .then((res) => res.data) // { sections, fields, mandatoryKeys, lgasByState }
        .catch((err) => { cachedPromise = null; throw err; });
    }
    return cachedPromise;
  },
};
