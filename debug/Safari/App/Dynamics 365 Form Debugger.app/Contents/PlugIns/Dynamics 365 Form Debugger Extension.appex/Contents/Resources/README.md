# Dynamics 365 Form Debugger

![image](https://repository-images.githubusercontent.com/1082475662/d07f2266-beae-4747-bfc8-2be84cf6efa2)

Temporarily disables **Dynamics 365 Customer Insights Forms** cache, allowing you to test form changes quickly.

Test, debug, and validate **Dynamics 365 forms** directly in **Microsoft Edge / Chrome**.

---

## Overview

**Dynamics 365 Form Debugger** is a lightweight browser extension designed for Dynamics 365 Marketing users, developers, and CRM specialists.
It helps you inspect form behavior, bypass cached data, and view form details with a simple popup interface.

Everything runs **locally** — no data is collected, transmitted, or shared.

---

## Key Features

- ✅ **Instant form detection** - Automatically detects Dynamics 365 forms on the page
- 📋 **View form details** - See Form ID and field count (including hidden fields)
- 🔄 **Automatic cache bypass** using `#d365mkt-nocache`
- ⚙️ **Toggle on/off** from the browser toolbar
- 📋 **Click to copy** - Click any form detail to copy it to clipboard
- ⚡ **Smart auto-disable** - Extension automatically turns off when no form is detected
- 🎨 **Visual feedback** - Info fields turn grey when extension is inactive
- 🔒 **100% client-side** — no tracking, telemetry, or network calls

---

## How to Use

1. Install the extension from the Edge Add-ons or Chrome Web Store.
2. Open a Dynamics 365 form page, such as: `https://assets-*.mkt.dynamics.com/...`
3. Click the **Dynamics 365 Form Debugger** icon in your browser toolbar.
4. Toggle **"Activate extension"** to enable cache bypass.
5. View form details: Form ID, field count, detection status, and cache status.
6. Click any value to copy it to your clipboard.

All operations happen locally inside your browser session.

---

## Privacy & Data

This extension **does not** collect, transmit, or store any user or form data.
All functionality (cache toggle, form detection, and form checks) is performed entirely on your device.

**Permissions Used:**
- `storage` - To save your extension on/off preference locally
- `activeTab` - To read form information from the current active tab
- `<all_urls>` - Required because Dynamics 365 forms can be embedded on any website, not just Microsoft domains. The extension only activates when it detects a Dynamics 365 form on the page.

---

# Changelog

## [1.0.0] - 2025-01-XX

### Features
- ✅ Form detection via `[data-form-id]` attribute for Dynamics 365 forms
- 📊 Display Form ID and field count (including hidden fields)
- 🎯 Click-to-copy functionality for form details
- 🔄 Cache bypass via `#d365mkt-nocache` URL hash
- ⚙️ Extension on/off toggle with visual feedback
- ⚡ Smart auto-disable: Extension automatically toggles off when no form is detected
- 🎨 Visual feedback: Info fields turn grey when extension is inactive
- 📡 Performance API monitoring to detect form API calls
- 🔍 Mutation observer to track dynamically loaded form fields
- 📝 Comprehensive console logging with color-coded output

### UI/UX
- Modern popup interface (350px × 400px)
- Status indicators: Form detected (green/red), Cache status (green/red)
- Clean card-based layout with proper spacing
- Interactive elements with hover effects
- Greyed-out info cards when extension is disabled or no form detected
- Auto-disable functionality for better user experience
- Footer links for feedback and support

### Technical Details
- Manifest V3 compliant
- Works on any URL where Dynamics 365 forms are embedded
- CSP-compliant implementation (no eval, no inline scripts)
- Content script runs at `document_start` for early detection
- Real-time field count updates via MutationObserver
- Dynamic UI state management based on form detection
- Auto-disable logic prevents unnecessary cache bypass on non-form pages
- Only activates when Dynamics 365 form is detected via `[data-form-id]` attribute

## Legal Notice

**Dynamics 365** and **Microsoft Edge** are registered trademarks of **Microsoft Corporation**.
This extension, **Dynamics 365 Form Debugger**, is an **independent tool** created by **Pattens Tech** and is **not affiliated with, endorsed by, or sponsored by Microsoft Corporation** in any way.
All references to Microsoft products are used for informational and compatibility purposes only.

---

## Support & Feedback

- 📧 [Contact Us](https://pattens.tech/contact)
- 📚 [Extension Documentation](https://pattens.tech/dynamics-365-form-debugger)

---

**Author:** Pattens Tech
**License:** Apache 2.0
**Version:** 1.0.0
