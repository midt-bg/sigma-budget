import { datasetDescriptions } from './production/launch-texts.js';

// Compatibility view for releases that still list unavailable datasets.
export function availableCatalog(catalog) {
  const datasets = (catalog.datasets || []).filter((set) => set.status !== 'pending');
  const slugs = new Set(datasets.map((set) => set.slug));
  return {
    ...catalog,
    ...(catalog.groups ? { groups: catalog.groups.filter((group) => group.id !== 'pending') } : {}),
    ...(catalog.counts
      ? {
          counts: Object.fromEntries(
            Object.entries({
              ...catalog.counts,
              datasets: datasets.length,
            }).filter(([key]) => key !== 'pending'),
          ),
        }
      : {}),
    datasets: datasets.map(({ pending, expected, ...set }) => ({
      ...set,
      ...(datasetDescriptions[set.slug] ? { description: datasetDescriptions[set.slug] } : {}),
    })),
    ...Object.fromEntries(
      ['traps', 'methodology']
        .filter((key) => catalog[key])
        .map((key) => [
          key,
          catalog[key].map((note) => ({
            ...note,
            ...(note.related ? { related: note.related.filter((slug) => slugs.has(slug)) } : {}),
          })),
        ]),
    ),
  };
}
