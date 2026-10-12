import { apiClient } from './apiClient';

// Fetch once per page load and reuse the same promise for every caller.
// 'no-cache' makes the browser revalidate with the server instead of reusing
// a stored copy, so rule changes reach admins right after a deploy.
let cachedPromise = null;

export const fieldCatalogService = {
  getFieldCatalog() {
    if (!cachedPromise) {
      cachedPromise = apiClient.get('/api/field-catalog', undefined, { cache: 'no-cache' })
        .then((res) => res.data) // { sections, fields, mandatoryKeys, lgasByState }
        .catch((err) => { cachedPromise = null; throw err; });
    }
    return cachedPromise;
  },
};
