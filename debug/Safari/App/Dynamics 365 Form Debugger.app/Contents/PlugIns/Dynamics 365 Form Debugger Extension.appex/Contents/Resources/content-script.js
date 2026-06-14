// content-script.js — Overlay with checkboxes and reload button

// Config is loaded from config.js (loaded first in manifest.json)
// Access configuration via the global CONFIG object

const STYLE_ID = CONFIG.ELEMENT_IDS.STYLE;
const OVERLAY_ID = CONFIG.ELEMENT_IDS.OVERLAY;

/**
 * Monitors network requests for Dynamics 365 form API calls using PerformanceObserver.
 * Logs form API detections to console with color-coded output.
 * This is a CSP-compliant alternative to intercepting network requests.
 *
 * @returns {void}
 */
function detectNetworkRequests() {
  const LOG_PREFIX = CONFIG.LOGGING.PREFIX;
  const LOG_STYLE = CONFIG.LOGGING.PREFIX_STYLE;
  
  // Monitor for form API calls via PerformanceObserver if available
  if (window.PerformanceObserver) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name && entry.name.includes('landingpageforms')) {
            console.log(LOG_PREFIX + ' %cForm API detected via performance:', LOG_STYLE, `color: ${CONFIG.COLORS.INFO};`, entry.name);
          }
        }
      });
      observer.observe({ entryTypes: ['resource'] });
      console.log(LOG_PREFIX + ' %cPerformance observer monitoring enabled', LOG_STYLE, `color: ${CONFIG.COLORS.SUCCESS};`);
    } catch (e) {
      console.log(LOG_PREFIX + ' %cPerformance observer not available:', LOG_STYLE, `color: ${CONFIG.COLORS.NOTICE};`, e.message);
    }
  }
}

/**
 * Scans the DOM for Dynamics 365 form containers and extracts metadata.
 * Looks for elements with [data-form-id] attribute and retrieves form information.
 * Also identifies form-related scripts and cache bypass methods.
 *
 * @returns {Object} Form state object containing detection results and metadata
 * @returns {boolean} return.found - Whether a Dynamics 365 form was detected on the page
 * @returns {string} [return.formId] - The unique form identifier from data-form-id attribute
 * @returns {string} [return.apiUrl] - The form API URL from data-form-api-url attribute
 * @returns {string} [return.cachedUrl] - The cached form URL if available
 * @returns {number} [return.fieldCount] - Number of form fields currently loaded
 * @returns {Array<string>} [return.relatedScripts] - URLs of form-related JavaScript files
 * @returns {Object} [return.cacheBypassMethods] - Object indicating active cache bypass methods
 */
function detectDynamicsForm() {
  const LOG_PREFIX = CONFIG.LOGGING.PREFIX;
  const LOG_STYLE = CONFIG.LOGGING.PREFIX_STYLE;

  console.log(LOG_PREFIX + ' %cScanning page for form...', LOG_STYLE, `color: ${CONFIG.COLORS.WARNING};`);

  let formContainer;
  try {
    formContainer = document.querySelector(CONFIG.SELECTORS.FORM_CONTAINER);
  } catch (e) {
    console.error(LOG_PREFIX + ' %cError querying for form container:', LOG_STYLE, `color: ${CONFIG.COLORS.ERROR};`, e);
    return { found: false, error: e.message };
  }

  if (formContainer) {
    console.log(LOG_PREFIX + ' %c✓ FORM DETECTED', LOG_STYLE, `color: ${CONFIG.COLORS.SUCCESS}; font-size: 14px;`);
    
    const formData = {
      formId: formContainer.getAttribute('data-form-id'),
      apiUrl: formContainer.getAttribute('data-form-api-url'),
      cachedUrl: formContainer.getAttribute('data-cached-form-url')
    };
    
    console.log(LOG_PREFIX + ' %cForm ID:', LOG_STYLE, `color: ${CONFIG.COLORS.INFO};`, formData.formId);
    console.log(LOG_PREFIX + ' %cAPI URL:', LOG_STYLE, `color: ${CONFIG.COLORS.INFO};`, formData.apiUrl);

    // Log all scripts on the page, filtering for form-related ones
    const allScripts = Array.from(document.querySelectorAll(CONFIG.SELECTORS.SCRIPTS)).map(s => s.src);
    const relatedScripts = allScripts.filter(src => 
      src.includes('dynamics') || src.includes('form') || src.includes('mkt') || src.includes('forms')
    );
    
    console.log(LOG_PREFIX + ' %cTotal scripts loaded:', LOG_STYLE, `color: ${CONFIG.COLORS.PURPLE};`, allScripts.length);
    if (relatedScripts.length > 0) {
      console.log(LOG_PREFIX + ' %cRelated scripts:', LOG_STYLE, `color: ${CONFIG.COLORS.PURPLE};`, relatedScripts);
    }

    // Detect cache-busting methods in use
    const url = window.location.href;
    const cacheBypassMethods = {
      urlHash: url.includes(CONFIG.CACHE_BYPASS.URL_HASH),
      apiParameter: false
    };

    const formState = {
      found: true,
      implementation: 'dynamic',
      ...formData,
      relatedScripts,
      cacheBypassMethods,
      fieldsLoaded: formContainer.children.length > 0,
      fieldCount: formContainer.children.length,
      allScripts: allScripts.length
    };

    console.log(LOG_PREFIX + ' %cForm fields detected:', LOG_STYLE, `color: ${CONFIG.COLORS.CYAN};`, formState.fieldCount);
    return formState;
  }

  console.log(LOG_PREFIX + ' %c✗ NO FORM DETECTED', LOG_STYLE, `color: ${CONFIG.COLORS.ERROR}; font-size: 14px;`);
  console.log(LOG_PREFIX + ' %cLooking for: [data-form-id] attribute', LOG_STYLE, `color: ${CONFIG.COLORS.NOTICE};`);
  return { found: false };
}

/**
 * Sets up a MutationObserver to monitor dynamic changes to form fields.
 * Watches for child elements being added to the form container and logs field count updates.
 *
 * Note: Only observes direct children (subtree: false) to avoid performance overhead
 * from monitoring all descendant changes in the form tree.
 *
 * @returns {void}
 */
function monitorFormMutations() {
  const formContainer = document.querySelector(CONFIG.SELECTORS.FORM_CONTAINER);
  const LOG_PREFIX = CONFIG.LOGGING.PREFIX;
  const LOG_STYLE = CONFIG.LOGGING.PREFIX_STYLE;

  if (!formContainer) {
    console.log(LOG_PREFIX + ' %cNo form to monitor for mutations', LOG_STYLE, `color: ${CONFIG.COLORS.NOTICE};`);
    return;
  }

  let lastFieldCount = formContainer.children.length;

  const observer = new MutationObserver((mutations) => {
    const currentFieldCount = formContainer.children.length;

    // Only log if count actually changed
    if (currentFieldCount !== lastFieldCount) {
      console.log(LOG_PREFIX + ' %cForm fields updated: ' + lastFieldCount + ' → ' + currentFieldCount, LOG_STYLE, `color: ${CONFIG.COLORS.CYAN};`);
      lastFieldCount = currentFieldCount;
    }
  });

  observer.observe(formContainer, {
    childList: true,
    subtree: false // Don't observe deep - just direct children
  });

  console.log(LOG_PREFIX + ' %cMutation observer active', LOG_STYLE, `color: ${CONFIG.COLORS.SUCCESS};`);
}

// Overlay functionality removed - all UI now handled by popup

// ensureOverlay function removed - overlay no longer displayed on page

// updateOverlayStatus function removed - overlay no longer displayed on page

/**
 * Message listener to respond to popup requests for form information
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_FORM_INFO") {
    const formState = detectDynamicsForm();

    sendResponse({
      formDetected: formState.found,
      formId: formState.formId || null,
      fieldCount: formState.fieldCount || 0
    });

    return true; // Keep the message channel open for async response
  }

  // TOGGLE_EXTENSION message removed - no overlay to toggle
});

// Initialize - wait for DOM to be ready
console.log(CONFIG.LOGGING.PREFIX + ' %cExtension loaded!', CONFIG.LOGGING.PREFIX_STYLE, `color: ${CONFIG.COLORS.SUCCESS};`);
detectNetworkRequests();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log(CONFIG.LOGGING.PREFIX + ' %cMonitoring forms - all UI in popup', CONFIG.LOGGING.PREFIX_STYLE, `color: ${CONFIG.COLORS.SUCCESS};`);
    monitorFormMutations();
    detectDynamicsForm();
  });
} else {
  console.log(CONFIG.LOGGING.PREFIX + ' %cMonitoring forms - all UI in popup', CONFIG.LOGGING.PREFIX_STYLE, `color: ${CONFIG.COLORS.SUCCESS};`);
  monitorFormMutations();
  detectDynamicsForm();
}
