/**
 * config.js — Central configuration file for the Dynamics 365 Form Debugger extension
 *
 * This file contains all constants, magic numbers, and configuration values used
 * throughout the extension. Centralizing these values makes the code more maintainable
 * and easier to modify.
 *
 * Note: This file uses a global CONFIG object instead of ES6 exports because content
 * scripts cannot use ES6 modules in browser extensions.
 */

// Define all configuration in a global CONFIG object
const CONFIG = {};

/**
 * DOM element IDs used throughout the extension
 * @const {Object}
 */
CONFIG.ELEMENT_IDS = {
  STYLE: "d365-forms-tester-style",
  OVERLAY: "d365-forms-tester-overlay",
  FORM_BADGE: "form-badge",
  CACHE_BADGE: "cache-badge",
  FORM_INFO: "form-info"
};

/**
 * Timeout values in milliseconds
 * @const {Object}
 */
CONFIG.TIMEOUTS = {
  /** Retry delay when waiting for DOM elements to be available */
  DOM_RETRY: 100
};

/**
 * UI styling constants
 * @const {Object}
 */
CONFIG.STYLES = {
  /** Z-index for overlay to ensure it appears above all other page content */
  OVERLAY_Z_INDEX: 999999
};

/**
 * Color palette used for console logging and UI elements
 * @const {Object}
 */
CONFIG.COLORS = {
  /** Primary brand color (orange) */
  BRAND: "#FF6B35",
  /** Success state (green) */
  SUCCESS: "#4CAF50",
  /** Error/inactive state (red) */
  ERROR: "#F44336",
  /** Info state (blue) */
  INFO: "#2196F3",
  /** Cyan accent */
  CYAN: "#00BCD4",
  /** Purple accent */
  PURPLE: "#9C27B0",
  /** Warning state (amber) */
  WARNING: "#FFC107",
  /** Notice state (orange) */
  NOTICE: "#FF9800"
};

/**
 * Console logging configuration
 * @const {Object}
 */
CONFIG.LOGGING = {
  /** Prefix for all console log messages */
  PREFIX: "%c[D365 Form Tester]",
  /** CSS style for the log prefix */
  PREFIX_STYLE: "color: #FF6B35; font-weight: bold;"
};

/**
 * Regular expression patterns
 * @const {Object}
 */
CONFIG.PATTERNS = {
  /**
   * Matches Dynamics 365 Marketing form asset URLs
   * Examples: https://assets-gbr.mkt.dynamics.com/...
   *           https://assets-usa.mkt.dynamics.com/...
   */
  DYNAMICS_URL: /^https:\/\/assets-[a-z]{3}\.mkt\.dynamics\.com\//i
};

/**
 * Cache bypass configuration
 * @const {Object}
 */
CONFIG.CACHE_BYPASS = {
  /** URL hash used to disable Dynamics 365 form caching */
  URL_HASH: "#d365mkt-nocache"
};

/**
 * Storage keys used in chrome.storage.local
 * @const {Object}
 */
CONFIG.STORAGE_KEYS = {
  /** Key for storing the cache bypass enabled/disabled preference */
  NOCACHE_ENABLED: "nocacheEnabled",
  /** Key for storing the extension enabled/disabled state */
  EXTENSION_ENABLED: "extensionEnabled"
};

/**
 * DOM selectors used for form detection
 * @const {Object}
 */
CONFIG.SELECTORS = {
  /** Attribute selector for Dynamics 365 form containers */
  FORM_CONTAINER: "[data-form-id]",
  /** All script tags with src attributes */
  SCRIPTS: "script[src]"
};

/**
 * Message types for inter-component communication
 * @const {Object}
 */
CONFIG.MESSAGE_TYPES = {
  /** Message sent from popup to background to toggle cache bypass */
  TOGGLE_NOCACHE: "TOGGLE_NOCACHE"
};

/**
 * Default values
 * @const {Object}
 */
CONFIG.DEFAULTS = {
  /** Default state for cache bypass (enabled by default) */
  NOCACHE_ENABLED: true,
  /** Default state for extension (enabled by default) */
  EXTENSION_ENABLED: true
};

// Make CONFIG available globally (for content scripts)
// and also export it for modules (background.js, popup.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

// For ES6 modules (background.js with type="module")
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
