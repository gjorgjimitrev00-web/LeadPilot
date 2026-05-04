(function attachLeadFilters(root) {
  function leadHasWebsite(lead) {
    if (!lead) return false;
    return Boolean(lead.hasWebsite || String(lead.website || "").trim());
  }

  function filterLeads(leads, options = {}) {
    const safeLeads = Array.isArray(leads) ? leads : [];
    return safeLeads.filter((lead) => {
      if (options.withEmail && !lead.email) return false;
      if (options.withPhone && !lead.phone) return false;
      if (options.withWebsite && !leadHasWebsite(lead)) return false;
      if (options.withoutWebsite && leadHasWebsite(lead)) return false;
      return true;
    });
  }

  const api = {
    filterLeads,
    leadHasWebsite,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.LeadFilters = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
