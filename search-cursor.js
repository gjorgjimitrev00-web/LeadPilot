function buildSavedSearchKey({ category, place, radius }) {
  const categoryKey = normalizeKey(category);
  const locationKey = place
    ? `${normalizeKey(place.displayName)}:${roundCoordinate(place.lat)},${roundCoordinate(place.lon)}`
    : "unknown-location";
  const radiusKey = Math.round(Number(radius) || 0);

  return [categoryKey, locationKey, radiusKey].join("::");
}

function selectLeadBatch({ leads, seenLeadIds, limit }) {
  const batchLimit = Math.max(0, Math.floor(Number(limit) || 0));
  const safeLeads = Array.isArray(leads) ? leads.filter((lead) => lead && lead.id) : [];
  const safeSeenIds = Array.isArray(seenLeadIds) ? seenLeadIds.filter(Boolean).map(String) : [];
  const seen = new Set(safeSeenIds);
  const unseen = safeLeads.filter((lead) => !seen.has(String(lead.id)));
  const reset = safeLeads.length > 0 && unseen.length === 0;
  const source = reset ? safeLeads : unseen;
  const selected = source.slice(0, batchLimit);
  const selectedIds = selected.map((lead) => String(lead.id));
  const nextSeenLeadIds = reset ? selectedIds : mergeIds(safeSeenIds, selectedIds);

  return {
    leads: selected,
    nextSeenLeadIds,
    skippedSeenCount: reset ? safeLeads.length : safeLeads.length - unseen.length,
    reset,
    exhausted: !reset && unseen.length <= batchLimit,
    availableCount: safeLeads.length,
    freshCount: unseen.length,
  };
}

function mergeIds(existingIds, newIds) {
  return Array.from(new Set([...existingIds.map(String), ...newIds.map(String)]));
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-") || "empty";
}

function roundCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(3) : "0.000";
}

module.exports = {
  buildSavedSearchKey,
  selectLeadBatch,
};
