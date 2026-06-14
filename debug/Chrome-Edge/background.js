// background.js — append #d365mkt-nocache only for Dynamics 365 form URLs

// Import config.js into the service worker
importScripts('config.js');

/**
 * Regular expression to match Dynamics 365 Marketing form asset URLs.
 * Matches URLs like: https://assets-gbr.mkt.dynamics.com/...
 * @type {RegExp}
 */
const dynamicsRegex = CONFIG.PATTERNS.DYNAMICS_URL;

/**
 * Listens for tab URL updates and applies cache bypass for Dynamics 365 form pages.
 * Triggers when a tab's URL changes and the new URL matches the Dynamics 365 pattern.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && dynamicsRegex.test(changeInfo.url)) {
    applyNoCache(tabId, changeInfo.url);
  }
});

/**
 * Listens for messages from the popup UI to toggle cache bypass on/off.
 * Responds to TOGGLE_NOCACHE messages and applies changes to Dynamics 365 tabs.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === CONFIG.MESSAGE_TYPES.TOGGLE_NOCACHE) {
    if (sender.tab && dynamicsRegex.test(sender.tab.url)) {
      applyNoCache(sender.tab.id, sender.tab.url, message.enabled);
    }
  }
});

/**
 * Applies or removes the #d365mkt-nocache hash to a tab's URL based on user preference.
 * Reads the nocacheEnabled setting from storage and modifies the URL accordingly.
 * Only updates the tab if the URL actually needs to change.
 *
 * @param {number} tabId - The ID of the tab to modify
 * @param {string} url - The current URL of the tab
 * @param {boolean|null} [forceEnabled=null] - Force a specific enabled state, or null to read from storage
 * @returns {void}
 */
function applyNoCache(tabId, url, forceEnabled = null) {
  chrome.storage.local.get([CONFIG.STORAGE_KEYS.NOCACHE_ENABLED], (data) => {
    if (chrome.runtime.lastError) {
      console.error('[D365 Form Tester] Error reading storage in background:', chrome.runtime.lastError);
      return;
    }

    const enabled = forceEnabled !== null ? forceEnabled : (data[CONFIG.STORAGE_KEYS.NOCACHE_ENABLED] ?? CONFIG.DEFAULTS.NOCACHE_ENABLED);

    let newUrl = url;

    // Only append if not already present
    if (enabled && !url.includes(CONFIG.CACHE_BYPASS.URL_HASH)) {
      newUrl = url + CONFIG.CACHE_BYPASS.URL_HASH;
    } else if (!enabled && url.includes(CONFIG.CACHE_BYPASS.URL_HASH)) {
      newUrl = url.replace(CONFIG.CACHE_BYPASS.URL_HASH, "");
    }

    if (newUrl !== url) {
      chrome.tabs.update(tabId, { url: newUrl }, () => {
        if (chrome.runtime.lastError) {
          console.error('[D365 Form Tester] Error updating tab URL:', chrome.runtime.lastError);
        }
      });
    }
  });
}
