(function () {
  "use strict";

  const STORAGE_KEY = "pattens.generate.items.v1";
  const MAX_SAVED_ITEMS = 100;

  const options = {
    surveyLanguages: [
      { value: "en-us", label: "English" },
      { value: "de", label: "German" },
      { value: "zh-cn", label: "Chinese" }
    ],
    surveyLobs: [
      { value: "Norican", label: "Norican" },
      { value: "Wheelabrator", label: "Wheelabrator" },
      { value: "DISA", label: "DISA" },
      { value: "DISA-India", label: "DISA India" },
      { value: "Simpson", label: "Simpson" },
      { value: "StrikoWestofen", label: "StrikoWestofen" },
      { value: "Monitizer", label: "Monitizer" }
    ],
    linkBaseUrls: [
      { value: "https://norican.com", label: "Norican" },
      { value: "https://disagroup.com", label: "DISA" },
      { value: "https://disa-india.com", label: "DISA India" },
      { value: "https://wheelabratorgroup.com", label: "Wheelabrator" },
      { value: "https://monitizer.com", label: "Monitizer" },
      { value: "https://simpsongroup.com", label: "Simpson" },
      { value: "https://strikowestofen.com", label: "StrikoWestofen" }
    ],
    businesses: [
      { value: "NO", label: "Norican" },
      { value: "MO", label: "Monitizer" },
      { value: "DI", label: "DISA" },
      { value: "SW", label: "StrikoWestofen" },
      { value: "SI", label: "Simpson" },
      { value: "WB", label: "Wheelabrator" }
    ],
    years: [
      { value: "26", label: "2026" },
      { value: "25", label: "2025" }
    ],
    regions: [
      { value: "", label: "None" },
      { value: "WW", label: "World Wide" },
      { value: "EU", label: "Europe" },
      { value: "ROW", label: "Rest of World" },
      { value: "NAM", label: "North America" },
      { value: "ISEA", label: "India & South East Asia" }
    ],
    languages: [
      { value: "", label: "None" },
      { value: "EN", label: "English" },
      { value: "DE", label: "German" },
      { value: "ZH", label: "Chinese" }
    ]
  };

  const state = { items: [], activeType: "Link" };
  const els = {
    typeTabs: document.querySelectorAll(".generator-type-tab"),
    surveyForm: document.getElementById("surveyGeneratorForm"),
    surveyBaseUrl: document.getElementById("surveyBaseUrl"),
    surveyLanguage: document.getElementById("surveyLanguage"),
    surveyLob: document.getElementById("surveyLob"),
    surveyJourney: document.getElementById("surveyJourney"),
    surveyCampaign: document.getElementById("surveyCampaign"),
    surveyContent: document.getElementById("surveyContent"),
    surveyMedium: document.getElementById("surveyMedium"),
    surveyPreview: document.getElementById("surveyPreview"),
    surveyError: document.getElementById("surveyFormError"),
    linkForm: document.getElementById("linkGeneratorForm"),
    linkBaseUrl: document.getElementById("linkBaseUrl"),
    linkSubUrl: document.getElementById("linkSubUrl"),
    linkSource: document.getElementById("linkSource"),
    linkMedium: document.getElementById("linkMedium"),
    linkCampaign: document.getElementById("linkCampaign"),
    linkContent: document.getElementById("linkContent"),
    linkTerm: document.getElementById("linkTerm"),
    linkCrmCampaign: document.getElementById("linkCrmCampaign"),
    linkPreview: document.getElementById("linkPreview"),
    linkError: document.getElementById("linkFormError"),
    campaignForm: document.getElementById("campaignGeneratorForm"),
    business: document.getElementById("campaignBusiness"),
    year: document.getElementById("campaignYear"),
    region: document.getElementById("campaignRegion"),
    language: document.getElementById("campaignLanguage"),
    descriptor: document.getElementById("campaignDescriptor"),
    salesplay: document.getElementById("campaignSalesplay"),
    campaignPreview: document.getElementById("campaignPreview"),
    campaignError: document.getElementById("campaignFormError"),
    list: document.getElementById("generatedItemsList"),
    count: document.getElementById("generatedItemCount"),
    generate: document.getElementById("generateItemButton"),
    copyPreview: document.getElementById("copyGeneratorPreviewButton"),
    clear: document.getElementById("clearGeneratedItemsButton"),
    status: document.getElementById("generatorStatusText"),
    formatTitle: document.getElementById("generatorFormatTitle"),
    formatDescription: document.getElementById("generatorFormatDescription")
  };

  function normalizeSegment(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function buildCampaignCode(values) {
    return [
      values.business,
      values.year,
      values.region,
      values.descriptor,
      values.salesplay,
      values.language
    ].map(normalizeSegment).filter(Boolean).join("-");
  }

  function uppercaseTrackingValue(value) {
    return String(value || "").trim().toUpperCase();
  }

  function buildLinkUrl(values) {
    let url;
    try {
      url = new URL(String(values.baseUrl || "").trim());
    } catch (error) {
      return "";
    }

    const subUrl = String(values.subUrl || "").trim().replace(/^\/+|\/+$/g, "");
    const basePath = url.pathname.replace(/\/+$/g, "");
    url.pathname = `${basePath}${subUrl ? `/${subUrl}` : ""}/`.replace(/\/{2,}/g, "/");
    url.search = "";
    url.hash = "";

    const tracking = [
      ["mtm_source", values.source],
      ["mtm_medium", values.medium],
      ["mtm_campaign", values.campaign],
      ["mtm_content", values.content],
      ["mtm_term", values.term],
      ["crm_campaign", values.crmCampaign]
    ];
    tracking.forEach(([key, value]) => {
      const normalized = uppercaseTrackingValue(value);
      if (normalized) url.searchParams.set(key, normalized);
    });
    return url.toString();
  }

  function buildSurveyUrl(values) {
    const baseUrl = String(values.baseUrl || "").trim().replace(/[?&]+$/g, "");
    if (!baseUrl) return "";
    try {
      new URL(baseUrl);
    } catch (error) {
      return "";
    }

    const context = {
      journey: String(values.journey || "").trim().toLowerCase(),
      lob: String(values.lob || "").trim(),
      source: "CRM",
      campaign: String(values.campaign || "").trim().toLowerCase(),
      medium: String(values.medium || "").trim(),
      content: String(values.content || "").trim().toLowerCase()
    };
    const language = String(values.lang || "").trim().toLowerCase();
    return `${baseUrl}&lang=${encodeURIComponent(language)}&ctx=${encodeURIComponent(JSON.stringify(context))}`;
  }

  function currentCampaignValues() {
    return {
      business: els.business?.value || "",
      year: els.year?.value || "",
      region: els.region?.value || "",
      descriptor: els.descriptor?.value || "",
      salesplay: els.salesplay?.value || "",
      language: els.language?.value || ""
    };
  }

  function currentLinkValues() {
    return {
      baseUrl: els.linkBaseUrl?.value || "",
      subUrl: els.linkSubUrl?.value || "",
      source: els.linkSource?.value || "",
      medium: els.linkMedium?.value || "",
      campaign: els.linkCampaign?.value || "",
      content: els.linkContent?.value || "",
      term: els.linkTerm?.value || "",
      crmCampaign: els.linkCrmCampaign?.value || ""
    };
  }

  function currentSurveyValues() {
    return {
      baseUrl: els.surveyBaseUrl?.value || "",
      lang: els.surveyLanguage?.value || "",
      journey: els.surveyJourney?.value || "",
      lob: els.surveyLob?.value || "",
      campaign: els.surveyCampaign?.value || "",
      content: els.surveyContent?.value || "",
      medium: els.surveyMedium?.value || ""
    };
  }

  function fillSelect(select, values) {
    if (!select) return;
    select.innerHTML = "";
    values.forEach(item => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }

  function loadItems() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      state.items = Array.isArray(stored)
        ? stored.filter(item => item && ["Campaign", "Link", "Survey"].includes(item.type) && typeof item.value === "string").slice(0, MAX_SAVED_ITEMS)
        : [];
    } catch (error) {
      state.items = [];
      setStatus("Saved items could not be loaded.");
    }
    renderItems();
  }

  function saveItems() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
      return true;
    } catch (error) {
      showError("This browser could not save the generated item.");
      return false;
    }
  }

  function updateCampaignPreview() {
    if (!els.campaignPreview) return "";
    const value = buildCampaignCode(currentCampaignValues());
    els.campaignPreview.textContent = value || "Campaign preview";
    clearError("Campaign");
    updateActionButtonStates();
    return value;
  }

  function isLinkComplete(values = currentLinkValues()) {
    return Object.values(values).every(value => String(value).trim());
  }

  function isCampaignComplete(values = currentCampaignValues()) {
    return [values.business, values.year, values.descriptor, values.salesplay]
      .every(value => String(value).trim());
  }

  function isSurveyComplete(values = currentSurveyValues()) {
    return Object.values(values).every(value => String(value).trim()) && Boolean(buildSurveyUrl(values));
  }

  function isActiveFormComplete() {
    if (state.activeType === "Link") return isLinkComplete();
    if (state.activeType === "Survey") return isSurveyComplete();
    return isCampaignComplete();
  }

  function updateActionButtonStates() {
    const disabled = !isActiveFormComplete();
    if (els.generate) els.generate.disabled = disabled;
    if (els.copyPreview) els.copyPreview.disabled = disabled;
  }

  function updateLinkPreview() {
    if (!els.linkPreview) return "";
    const value = buildLinkUrl(currentLinkValues());
    els.linkPreview.textContent = value || "Link preview";
    clearError("Link");
    updateActionButtonStates();
    return value;
  }

  function updateSurveyPreview() {
    if (!els.surveyPreview) return "";
    const value = buildSurveyUrl(currentSurveyValues());
    els.surveyPreview.textContent = value || "Survey preview";
    clearError("Survey");
    updateActionButtonStates();
    return value;
  }

  function updateActivePreview() {
    if (state.activeType === "Link") return updateLinkPreview();
    if (state.activeType === "Survey") return updateSurveyPreview();
    return updateCampaignPreview();
  }

  function addItem(type, value, fields) {
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      value,
      fields,
      createdAt: new Date().toISOString()
    };
    state.items.unshift(item);
    state.items = state.items.slice(0, MAX_SAVED_ITEMS);
    if (!saveItems()) {
      state.items.shift();
      return null;
    }
    renderItems();
    setStatus(`${type} saved in this browser.`);
    return item;
  }

  function generateCampaign(event) {
    event?.preventDefault();
    const values = currentCampaignValues();
    if (!isCampaignComplete(values)) return null;
    return addItem("Campaign", buildCampaignCode(values), values);
  }

  function generateLink(event) {
    event?.preventDefault();
    const values = currentLinkValues();
    if (!isLinkComplete(values)) return null;
    return addItem("Link", buildLinkUrl(values), values);
  }

  function generateSurvey(event) {
    event?.preventDefault();
    const values = currentSurveyValues();
    const value = buildSurveyUrl(values);
    if (!isSurveyComplete(values) || !value) return null;
    return addItem("Survey", value, values);
  }

  function generateActiveItem() {
    if (state.activeType === "Link") return generateLink();
    if (state.activeType === "Survey") return generateSurvey();
    return generateCampaign();
  }

  function setActiveType(type) {
    if (!["Link", "Campaign", "Survey"].includes(type)) return;
    state.activeType = type;
    const isLink = type === "Link";
    const isSurvey = type === "Survey";
    const isCampaign = type === "Campaign";
    els.surveyForm?.classList.toggle("hidden", !isSurvey);
    els.linkForm?.classList.toggle("hidden", !isLink);
    els.campaignForm?.classList.toggle("hidden", !isCampaign);
    els.surveyPreview?.classList.toggle("hidden", !isSurvey);
    els.linkPreview?.classList.toggle("hidden", !isLink);
    els.campaignPreview?.classList.toggle("hidden", !isCampaign);
    els.typeTabs.forEach(tab => {
      const active = tab.dataset.generatorType === type;
      tab.classList.toggle("bg-accentSoft", active);
      tab.classList.toggle("text-accent", active);
      tab.classList.toggle("text-muted", !active);
      tab.classList.toggle("hover:bg-white/10", !active);
      tab.classList.toggle("hover:text-white", !active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    if (els.formatTitle) {
      els.formatTitle.textContent = isSurvey ? "Survey format" : isLink ? "Link format" : "Campaign format";
    }
    if (els.formatDescription) {
      els.formatDescription.textContent = isSurvey
        ? "Editable survey URL followed by language and an encoded CRM context object."
        : isLink
          ? "Base URL and path followed by uppercase MTM and CRM campaign tracking parameters."
          : "Business, year, optional region, descriptor, sales play, and optional language joined with hyphens.";
    }
    clearError();
    updateActivePreview();
    updateActionButtonStates();
  }

  async function copyText(value, message) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setStatus(message);
    } catch (error) {
      showError("Clipboard access is unavailable in this browser.");
    }
  }

  function deleteItem(id) {
    state.items = state.items.filter(item => item.id !== id);
    saveItems();
    renderItems();
    setStatus("Saved item deleted.");
  }

  function clearItems() {
    if (!state.items.length) return;
    state.items = [];
    saveItems();
    renderItems();
    setStatus("Saved items cleared.");
  }

  function renderItems() {
    if (!els.list || !els.count) return;
    els.count.textContent = `${state.items.length} ${state.items.length === 1 ? "item" : "items"}`;
    if (els.clear) els.clear.disabled = state.items.length === 0;
    if (!state.items.length) {
      els.list.innerHTML = '<p class="px-1 py-2 text-sm font-medium text-muted">Generated items will appear here.</p>';
      return;
    }

    els.list.innerHTML = `<div class="grid min-w-0 max-w-full gap-2">${state.items.map(item => `
      <article data-saved-type="${escapeHtml(item.type)}" class="min-w-0 max-w-full overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <div class="flex min-w-0 max-w-full items-start justify-between gap-3">
          <div class="min-w-0 flex-1 overflow-hidden">
            <p data-saved-title class="text-xs font-extrabold uppercase tracking-wide ${savedTitleColor(item.type)}">${escapeHtml(item.type)}</p>
            <p data-saved-result class="mt-1 truncate font-mono text-sm font-bold leading-6 text-white" title="${escapeHtml(item.value)}">${escapeHtml(item.value)}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button type="button" data-generator-action="copy" data-item-id="${escapeHtml(item.id)}" class="rounded-md p-2 text-muted transition hover:bg-white/10 hover:text-accent" aria-label="Copy ${escapeHtml(item.value)}" title="Copy">
              <i data-lucide="copy" class="h-4 w-4"></i>
            </button>
            <button type="button" data-generator-action="delete" data-item-id="${escapeHtml(item.id)}" class="rounded-md p-2 text-muted transition hover:bg-red-400/10 hover:text-red-200" aria-label="Delete ${escapeHtml(item.value)}" title="Delete">
              <i data-lucide="trash-2" class="h-4 w-4"></i>
            </button>
          </div>
        </div>
        <time class="mt-2 block text-xs font-semibold text-muted" datetime="${escapeHtml(item.createdAt)}">${escapeHtml(formatDate(item.createdAt))}</time>
      </article>
    `).join("")}</div>`;
    window.lucide?.createIcons();
  }

  function savedTitleColor(type) {
    if (type === "Link") return "text-sky-300";
    if (type === "Campaign") return "text-emerald-300";
    if (type === "Survey") return "text-purple-300";
    return "text-accent";
  }

  function handleListAction(event) {
    const button = event.target.closest("[data-generator-action]");
    if (!button) return;
    const item = state.items.find(candidate => candidate.id === button.dataset.itemId);
    if (!item) return;
    if (button.dataset.generatorAction === "copy") copyText(item.value, "Saved item copied.");
    if (button.dataset.generatorAction === "delete") deleteItem(item.id);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Saved" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function showError(message, type = state.activeType) {
    const errorElement = type === "Survey" ? els.surveyError : type === "Link" ? els.linkError : els.campaignError;
    if (!errorElement) return;
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
  }

  function clearError(type) {
    const errorElements = type
      ? [type === "Survey" ? els.surveyError : type === "Link" ? els.linkError : els.campaignError]
      : [els.surveyError, els.linkError, els.campaignError];
    errorElements.filter(Boolean).forEach(errorElement => {
      errorElement.textContent = "";
      errorElement.classList.add("hidden");
    });
  }

  function setStatus(message) {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.classList.toggle("hidden", !message);
  }

  function init() {
    if (!els.campaignForm || !els.linkForm || !els.surveyForm) return;
    fillSelect(els.surveyLanguage, options.surveyLanguages);
    fillSelect(els.surveyLob, options.surveyLobs);
    fillSelect(els.linkBaseUrl, options.linkBaseUrls);
    fillSelect(els.business, options.businesses);
    fillSelect(els.year, options.years);
    fillSelect(els.region, options.regions);
    fillSelect(els.language, options.languages);
    els.typeTabs.forEach(tab => tab.addEventListener("click", () => setActiveType(tab.dataset.generatorType)));
    els.surveyForm.addEventListener("submit", generateSurvey);
    els.surveyForm.addEventListener("input", updateSurveyPreview);
    els.surveyForm.addEventListener("change", updateSurveyPreview);
    els.linkForm.addEventListener("submit", generateLink);
    els.linkForm.addEventListener("input", updateLinkPreview);
    els.linkForm.addEventListener("change", updateLinkPreview);
    els.campaignForm.addEventListener("submit", generateCampaign);
    els.campaignForm.addEventListener("input", updateCampaignPreview);
    els.campaignForm.addEventListener("change", updateCampaignPreview);
    els.generate?.addEventListener("click", generateActiveItem);
    els.copyPreview?.addEventListener("click", () => copyText(updateActivePreview(), `${state.activeType} preview copied.`));
    els.clear?.addEventListener("click", clearItems);
    els.list?.addEventListener("click", handleListAction);
    updateSurveyPreview();
    updateLinkPreview();
    updateCampaignPreview();
    setActiveType("Link");
    loadItems();
  }

  window.Pattens = window.Pattens || {};
  window.Pattens.generator = {
    buildCampaignCode,
    buildLinkUrl,
    buildSurveyUrl,
    generateCampaign,
    generateLink,
    generateSurvey,
    setActiveType,
    loadItems,
    deleteItem,
    clearItems,
    state,
    options,
    storageKey: STORAGE_KEY
  };

  init();
})();
