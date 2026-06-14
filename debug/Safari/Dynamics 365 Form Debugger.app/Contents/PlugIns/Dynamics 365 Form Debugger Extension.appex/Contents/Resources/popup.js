/**
 * popup.js — Handles the extension popup UI for Form Debugger
 *
 * This script manages the popup interface showing form detection status,
 * form details, and cache control.
 *
 * Config is loaded from config.js (included via script tag before this file)
 */

/**
 * DOM element references
 */
const formIdElement = document.getElementById("form-id");
const fieldsCountElement = document.getElementById("fields-count");
const formStatusElement = document.getElementById("form-status");
const cacheToggleElement = document.getElementById("cache-toggle");
const extensionEnabledToggle = document.getElementById("extension-enabled");

/**
 * Update the cache toggle button appearance based on state
 * @param {boolean} cacheDisabled - Whether cache is disabled
 * @param {boolean} extensionEnabled - Whether the extension is enabled
 */
function updateCacheToggleUI(cacheDisabled, extensionEnabled) {
  // If extension is disabled, cache is always enabled (not bypassed)
  if (!extensionEnabled || !cacheDisabled) {
    cacheToggleElement.className = "status-button status-red";
    cacheToggleElement.innerHTML = "<div>Cache enabled</div>";
  } else {
    cacheToggleElement.className = "status-button status-green";
    cacheToggleElement.innerHTML = "<div>Cache disabled</div>";
  }
}

/**
 * Update the form detection status button
 * @param {boolean} detected - Whether a form is detected
 */
function updateFormStatusUI(detected) {
  if (detected) {
    formStatusElement.className = "status-button status-green";
    formStatusElement.innerHTML = "<div>Form detected</div>";
  } else {
    formStatusElement.className = "status-button status-red";
    formStatusElement.innerHTML = "<div>Form not detected</div>";
  }
}

/**
 * Update the visual style of info fields based on extension state
 * @param {boolean} enabled - Whether the extension is enabled
 */
function updateInfoFieldsStyle(enabled) {
  const infoCards = document.querySelectorAll('.info-card');
  const infoLabels = document.querySelectorAll('.info-label');
  const infoValues = document.querySelectorAll('.info-value');

  if (!enabled) {
    // Grey out info fields when extension is disabled
    infoCards.forEach(card => {
      card.style.backgroundColor = '#f5f5f5';
      card.style.borderColor = '#e0e0e0';
    });
    infoLabels.forEach(label => {
      label.style.color = '#aaaaaa';
    });
    infoValues.forEach(value => {
      value.style.color = '#bbbbbb';
    });
  } else {
    // Restore normal colors when extension is enabled
    infoCards.forEach(card => {
      card.style.backgroundColor = '#fff';
      card.style.borderColor = '#dee2e6';
    });
    infoLabels.forEach(label => {
      label.style.color = '#6c757d';
    });
    infoValues.forEach(value => {
      value.style.color = '#2c3e50';
    });
  }
}

/**
 * Query the active tab for form information
 */
function queryFormInfo() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;

    chrome.tabs.sendMessage(tabs[0].id, { type: "GET_FORM_INFO" }, (response) => {
      if (chrome.runtime.lastError) {
        // No response from content script - form not detected
        updateFormStatusUI(false);
        formIdElement.textContent = "---";
        fieldsCountElement.textContent = "0";
        // Auto-disable extension when no form is detected
        autoDisableExtension();
        return;
      }

      if (response && response.formDetected) {
        updateFormStatusUI(true);
        formIdElement.textContent = response.formId || "Unknown";
        fieldsCountElement.textContent = response.fieldCount || "0";
      } else {
        updateFormStatusUI(false);
        formIdElement.textContent = "---";
        fieldsCountElement.textContent = "0";
        // Auto-disable extension when no form is detected
        autoDisableExtension();
      }
    });
  });
}

/**
 * Auto-disable the extension when no form is detected
 */
function autoDisableExtension() {
  chrome.storage.local.get([CONFIG.STORAGE_KEYS.EXTENSION_ENABLED], (data) => {
    const currentlyEnabled = data[CONFIG.STORAGE_KEYS.EXTENSION_ENABLED] ?? CONFIG.DEFAULTS.EXTENSION_ENABLED;

    // Only disable if currently enabled
    if (currentlyEnabled) {
      chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.EXTENSION_ENABLED]: false }, () => {
        if (chrome.runtime.lastError) {
          console.error('[D365 Form Tester] Error saving to storage:', chrome.runtime.lastError);
          return;
        }

        console.log('[D365 Form Tester] Extension auto-disabled (no form detected)');
        extensionEnabledToggle.checked = false;

        // Update cache status UI
        chrome.storage.local.get([CONFIG.STORAGE_KEYS.NOCACHE_ENABLED], (data) => {
          const cacheDisabled = data[CONFIG.STORAGE_KEYS.NOCACHE_ENABLED] ?? CONFIG.DEFAULTS.NOCACHE_ENABLED;
          updateCacheToggleUI(cacheDisabled, false);
        });

        // Update info fields to grey
        updateInfoFieldsStyle(false);
      });
    } else {
      // Already disabled, just update the UI
      updateInfoFieldsStyle(false);
    }
  });
}

/**
 * Initialize the popup state from storage
 */
chrome.storage.local.get([
  CONFIG.STORAGE_KEYS.NOCACHE_ENABLED,
  CONFIG.STORAGE_KEYS.EXTENSION_ENABLED
], (data) => {
  if (chrome.runtime.lastError) {
    console.error('[D365 Form Tester] Error reading storage:', chrome.runtime.lastError);
    updateCacheToggleUI(CONFIG.DEFAULTS.NOCACHE_ENABLED, CONFIG.DEFAULTS.EXTENSION_ENABLED);
    extensionEnabledToggle.checked = CONFIG.DEFAULTS.EXTENSION_ENABLED;
    updateInfoFieldsStyle(CONFIG.DEFAULTS.EXTENSION_ENABLED);
    return;
  }

  const cacheDisabled = data[CONFIG.STORAGE_KEYS.NOCACHE_ENABLED] ?? CONFIG.DEFAULTS.NOCACHE_ENABLED;
  const extensionEnabled = data[CONFIG.STORAGE_KEYS.EXTENSION_ENABLED] ?? CONFIG.DEFAULTS.EXTENSION_ENABLED;

  updateCacheToggleUI(cacheDisabled, extensionEnabled);
  extensionEnabledToggle.checked = extensionEnabled;
  updateInfoFieldsStyle(extensionEnabled);
});

/**
 * Query form info on popup open
 */
queryFormInfo();

/**
 * Handle extension enabled/disabled toggle
 */
extensionEnabledToggle.addEventListener("change", () => {
  const enabled = extensionEnabledToggle.checked;

  chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.EXTENSION_ENABLED]: enabled }, () => {
    if (chrome.runtime.lastError) {
      console.error('[D365 Form Tester] Error saving to storage:', chrome.runtime.lastError);
      return;
    }

    console.log('[D365 Form Tester] Extension ' + (enabled ? 'enabled' : 'disabled'));

    // Update cache status UI based on extension state
    chrome.storage.local.get([CONFIG.STORAGE_KEYS.NOCACHE_ENABLED], (data) => {
      const cacheDisabled = data[CONFIG.STORAGE_KEYS.NOCACHE_ENABLED] ?? CONFIG.DEFAULTS.NOCACHE_ENABLED;
      updateCacheToggleUI(cacheDisabled, enabled);
    });

    // Update info fields style based on extension state
    updateInfoFieldsStyle(enabled);
  });
});

// Cache toggle button removed - cache status is display-only, not clickable

/**
 * Add click-to-copy functionality for info values
 */
function addCopyToClipboard(element) {
  element.addEventListener("click", () => {
    const text = element.textContent;
    if (text && text !== "---" && text !== "0" && text !== "Copied") {
      navigator.clipboard.writeText(text).then(() => {
        // Visual feedback - show "Copied!" message
        const originalText = element.textContent;
        element.textContent = "Copied";
        element.style.color = "#5cb85c";

        setTimeout(() => {
          element.textContent = originalText;
          element.style.color = "#2c3e50";
        }, 1000);
      }).catch(err => {
        console.error('[D365 Form Tester] Failed to copy text:', err);
      });
    }
  });
}

// Add copy functionality to info values
addCopyToClipboard(formIdElement);
addCopyToClipboard(fieldsCountElement);

/**
 * Handle footer link clicks
 */
document.getElementById("report-feedback").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "https://pattens.tech/contact" });
});

document.getElementById("get-support").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "https://pattens.tech/dynamics-365-form-debugger" });
});
