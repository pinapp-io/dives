/**
 * Species photos from iNaturalist — cached in localStorage.
 */
import { state } from './state.js';
import { INATURALIST_API } from './utils.js';

export function loadSpeciesCache() {
  try {
    const stored = localStorage.getItem('pinapp_species_photos');
    if (stored) state.speciesPhotoCache = new Map(JSON.parse(stored));
  } catch {}
}

function saveSpeciesCache() {
  try { localStorage.setItem('pinapp_species_photos', JSON.stringify([...state.speciesPhotoCache])); } catch {}
}

export async function getSpeciesPhoto(speciesStr) {
  if (state.speciesPhotoCache.has(speciesStr)) return state.speciesPhotoCache.get(speciesStr);
  const sciMatch = speciesStr.match(/\(([^)]+)\)/);
  const searchName = sciMatch ? sciMatch[1] : speciesStr;
  try {
    const resp = await fetch(`${INATURALIST_API}?q=${encodeURIComponent(searchName)}&per_page=1`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const taxon = data.results?.[0];
    if (!taxon) return null;
    const photo = {
      name: taxon.name || searchName,
      commonName: taxon.preferred_common_name || speciesStr.split('(')[0].trim(),
      photoUrl: taxon.default_photo?.medium_url || '',
      attribution: taxon.default_photo?.attribution || 'iNaturalist',
      wikiUrl: taxon.wikipedia_url || `https://en.wikipedia.org/wiki/${encodeURIComponent(taxon.name || searchName)}`,
    };
    if (photo.photoUrl) { state.speciesPhotoCache.set(speciesStr, photo); saveSpeciesCache(); }
    return photo.photoUrl ? photo : null;
  } catch { return null; }
}

export async function getSpeciesPhotos(speciesList) {
  loadSpeciesCache();
  const results = new Map();
  const toFetch = [];
  for (const sp of speciesList) {
    if (state.speciesPhotoCache.has(sp)) results.set(sp, state.speciesPhotoCache.get(sp));
    else toFetch.push(sp);
  }
  for (let i = 0; i < toFetch.length; i += 4) {
    const batch = toFetch.slice(i, i + 4);
    await Promise.all(batch.map(sp => getSpeciesPhoto(sp).then(p => { if (p) results.set(sp, p); })));
  }
  return results;
}
