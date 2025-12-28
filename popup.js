(async function () {
  let currentUrl = '';
  let baseUrl = '';
  let domain = '';
  let currentWindow = null;
  let tabPosition = 'after'; // Store in memory

  // Cache duration: 7 days in milliseconds
  const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function getCurrentWindow() {
    return await chrome.windows.getCurrent();
  }

  // Get cached WordPress status
  async function getCachedStatus(domain) {
    try {
      const result = await chrome.storage.local.get(['wpCache']);
      const cache = result.wpCache || {};

      if (cache[domain]) {
        const { isWordPress, timestamp } = cache[domain];
        const age = Date.now() - timestamp;

        if (age < CACHE_DURATION) {
          return { isWordPress, fromCache: true };
        }
      }

      return null;
    } catch (e) {
      console.error('Cache read error:', e);
      return null;
    }
  }

  // Save WordPress status to cache
  async function setCachedStatus(domain, isWordPress) {
    try {
      const result = await chrome.storage.local.get(['wpCache']);
      const cache = result.wpCache || {};

      cache[domain] = {
        isWordPress: isWordPress,
        timestamp: Date.now()
      };

      await chrome.storage.local.set({ wpCache: cache });
    } catch (e) {
      console.error('Cache write error:', e);
    }
  }

  async function checkWordPress() {
    const cached = await getCachedStatus(domain);
    if (cached !== null) {
      console.log('Using cached WordPress status for', domain);
      return cached.isWordPress;
    }

    console.log('Checking WordPress status for', domain);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (document.querySelector('link[href*="wp-content"]') ||
            document.querySelector('script[src*="wp-includes"]') ||
            document.querySelector('script[src*="wp-content"]')) {
            return true;
          }

          const generator = document.querySelector('meta[name="generator"]');
          if (generator?.content.toLowerCase().includes('wordpress')) {
            return true;
          }

          const headHTML = document.head.innerHTML;
          if (headHTML.includes('wp-content') || headHTML.includes('wp-includes')) {
            return true;
          }

          return false;
        }
      });

      const isWP = results[0].result;
      await setCachedStatus(domain, isWP);
      return isWP;
    } catch (e) {
      console.error('WordPress check error:', e);
      try {
        const response = await fetch(baseUrl + '/wp-login.php', { method: 'HEAD', mode: 'no-cors' });
        const isWP = true;
        await setCachedStatus(domain, isWP);
        return isWP;
      } catch {
        const isWP = false;
        await setCachedStatus(domain, isWP);
        return isWP;
      }
    }
  }

  // Load tab position from storage
  async function loadTabPosition() {
    try {
      const result = await chrome.storage.local.get(['tabPosition']);
      tabPosition = result.tabPosition || 'after';
      console.log('✅ Loaded tab position:', tabPosition);
      return tabPosition;
    } catch (e) {
      console.error('❌ Error loading tab position:', e);
      tabPosition = 'after';
      return 'after';
    }
  }

  // Save tab position to storage
  async function saveTabPosition(position) {
    try {
      tabPosition = position; // Update memory immediately
      await chrome.storage.local.set({ tabPosition: position });
      console.log('✅ Saved tab position:', position);

      // Verify
      const verify = await chrome.storage.local.get(['tabPosition']);
      console.log('✅ Verified in storage:', verify.tabPosition);

      return true;
    } catch (e) {
      console.error('❌ Failed to save tab position:', e);
      return false;
    }
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  }

  function generateNoCacheParam() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function addNoCacheParam(url) {
    const urlObj = new URL(url);
    urlObj.searchParams.set('nocache', generateNoCacheParam());
    return urlObj.toString();
  }

  async function clearCacheOnly(url) {
    try {
      const urlObj = new URL(url);

      // Only clear cache - DO NOT clear cookies
      await chrome.browsingData.removeCache({
        origins: [urlObj.origin]
      });

      console.log('✅ Cache cleared for:', urlObj.hostname);
      return true;
    } catch (e) {
      console.error('❌ Error clearing cache:', e);
      return false;
    }
  }

  function updateTabPositionButtons(position) {
    const beforeBtn = document.getElementById('beforeBtn');
    const afterBtn = document.getElementById('afterBtn');

    if (beforeBtn && afterBtn) {
      beforeBtn.classList.remove('active');
      afterBtn.classList.remove('active');

      if (position === 'before') {
        beforeBtn.classList.add('active');
      } else {
        afterBtn.classList.add('active');
      }

      console.log('🎨 Updated buttons, active:', position);
    }
  }

  async function openInNewTab(url) {
    const tab = await getCurrentTab();

    // Use the memory variable (already loaded from storage)
    const position = tabPosition;
    const index = position === 'before' ? tab.index : tab.index + 1;

    console.log('━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📂 Opening new tab:');
    console.log('   Position setting:', position);
    console.log('   Current tab index:', tab.index);
    console.log('   New tab will be at index:', index);
    console.log('   Direction:', position === 'before' ? '⬅️ LEFT (BEFORE)' : '➡️ RIGHT (AFTER)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━');

    await chrome.tabs.create({
      url: url,
      index: index,
      windowId: currentWindow.id
    });
  }

  async function init() {
    const tab = await getCurrentTab();
    currentWindow = await getCurrentWindow();
    currentUrl = tab.url;
    const urlObj = new URL(currentUrl);
    baseUrl = urlObj.origin;
    domain = urlObj.hostname;

    document.getElementById('currentUrl').textContent = domain;

    // Elementor toggle handler
    const elementorToggle = document.getElementById('elementorToggle');
    if (elementorToggle) {
      elementorToggle.addEventListener('change', async () => {
        const isEnabled = elementorToggle.checked;

        try {
          const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

          if (isEnabled) {
            // Inject CSS to hide elementor loading panel
            await chrome.scripting.insertCSS({
              target: { tabId: currentTab.id },
              css: 'div#elementor-panel-state-loading { display: none !important; }'
            });
            showToast('✓ Elementor Panel Hidden');
          } else {
            // Remove the injected CSS
            await chrome.scripting.removeCSS({
              target: { tabId: currentTab.id },
              css: 'div#elementor-panel-state-loading { display: none !important; }'
            });
            showToast('✓ Elementor Panel Restored');
          }
        } catch (e) {
          console.error('Error toggling Elementor CSS:', e);
          showToast('❌ Toggle Failed');
        }
      });
    }

    // Load saved tab position FIRST
    await loadTabPosition();

    // Quick WordPress check (with caching)
    const isWP = await checkWordPress();

    const statusBox = document.getElementById('statusBox');
    const wpSection = document.getElementById('wpSection');
    const warningBox = document.getElementById('warningBox');

    if (isWP) {
      statusBox.style.display = 'none';
      wpSection.style.display = 'block';
      warningBox.style.display = 'none';

      // Set initial button state based on loaded position
      updateTabPositionButtons(tabPosition);

      // Before button handler
      const beforeBtn = document.getElementById('beforeBtn');
      if (beforeBtn) {
        beforeBtn.addEventListener('click', async () => {
          console.log('🖱️ BEFORE button clicked');
          const saved = await saveTabPosition('before');
          if (saved) {
            updateTabPositionButtons('before');
            showToast('⬅️ Tabs will open BEFORE (LEFT)');
          }
        });
      }

      // After button handler
      const afterBtn = document.getElementById('afterBtn');
      if (afterBtn) {
        afterBtn.addEventListener('click', async () => {
          console.log('🖱️ AFTER button clicked');
          const saved = await saveTabPosition('after');
          if (saved) {
            updateTabPositionButtons('after');
            showToast('➡️ Tabs will open AFTER (RIGHT)');
          }
        });
      }
    } else {
      statusBox.style.display = 'none';
      wpSection.style.display = 'none';
      warningBox.style.display = 'block';
    }

    // Setup click handlers for WordPress links
    document.querySelectorAll('.link-item').forEach(item => {
      item.addEventListener('click', async () => {
        const url = item.getAttribute('data-url');
        await openInNewTab(baseUrl + url);
      });
    });

    // DNS Checker
    document.getElementById('dnsCheckerBtn')?.addEventListener('click', async () => {
      await openInNewTab(`https://dnschecker.org/#A/${domain}`);
    });

    // WHOIS
    document.getElementById('whoisBtn')?.addEventListener('click', async () => {
      await openInNewTab(`https://who.is/whois/${domain}`);
    });

    // Normal Visit (clear cache + same tab)
    document.getElementById('normalVisitBtn')?.addEventListener('click', async () => {
      const noCacheUrl = addNoCacheParam(currentUrl);
      await clearCacheOnly(currentUrl); // Changed from clearCacheAndCookies

      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.update(currentTab.id, { url: noCacheUrl });

      showToast('🔄 Cache Cleared - Reloading');
      window.close();
    });

    // Incognito Visit (clear cache + incognito tab)
    document.getElementById('incognitoBtn')?.addEventListener('click', async () => {
      const noCacheUrl = addNoCacheParam(currentUrl);
      await clearCacheOnly(currentUrl); // Changed from clearCacheAndCookies

      try {
        await chrome.windows.create({
          url: noCacheUrl,
          incognito: true
        });
        showToast('🕶️ Opened in Incognito');
      } catch (e) {
        console.error('Incognito error:', e);
        showToast('❌ Incognito blocked - Check permissions');
      }
    });

    // View Website
    document.getElementById('viewWebsiteBtn')?.addEventListener('click', async () => {
      await openInNewTab(baseUrl);
    });

    // PageSpeed
    document.getElementById('pageSpeedBtn')?.addEventListener('click', async () => {
      await openInNewTab(`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(currentUrl)}`);
    });

    // Copy URL
    document.getElementById('copyUrlBtn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(currentUrl);
      showToast('✓ URL Copied');
    });
  }

  init();
})();