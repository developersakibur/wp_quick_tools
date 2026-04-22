# WP Quick Tools

A lightweight, high-performance Chrome Extension designed for WordPress developers and power users to streamline administrative tasks and site analysis.

## Key Features

- **🚀 Quick WP Access**: Instant navigation to `WP-Admin` and `All-in-One WP Migration` export pages.
- **🕶️ Dual Access Modes**: Open the current website in a standard tab or a new Incognito window with one click.
- **🔄 No-Cache (NC) Visits**: Force a fresh load by clearing the browser cache for the specific origin and appending a unique cache-busting parameter. Supports both Normal and Incognito modes.
- **⚡ Performance & DNS Tools**: 
  - **Speed**: Direct link to Google PageSpeed Insights for the current URL.
  - **DNS**: Quick access to DNS Checker for the current domain.
- **📂 Smart Tab Management**: Toggle whether new tabs open to the left (**Before**) or right (**After**) of your active tab.
- **📋 URL Utility**: One-click to copy the current tab's URL to your clipboard.
- **🎨 Modern Dark UI**: Sleek, compact interface with neon cyan accents designed for developer productivity.

## Technical Overview

- **Manifest Version**: 3
- **Permissions**:
  - `browsingData`: Used to clear site-specific cache for the "No Cache" feature.
  - `storage`: Persists your tab positioning preferences.
  - `tabs` & `scripting`: Handles navigation and tab indexing.
  - `activeTab`: Safely interacts with the site you are currently viewing.

## Installation

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the project folder.

## Author

Created by **Sakibur Rahman**
