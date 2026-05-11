/**
 * Shared mutable state — all modules import from here.
 */
export const state = {
  instance: null,
  templateManifest: null,
  observations: [],
  sitePackages: [],
  currentSite: null,
  currentGps: null,
  videoStream: null,
  leafletMap: null,
  mapInitialized: false,
  speciesPhotoCache: new Map(),
  db: null,
};
