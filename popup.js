document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openBtn');
  const themeSelect = document.getElementById('themeSelect');
  const statusEl = document.getElementById('status');

  const maxXpathCharsInput = document.getElementById('maxXpathCharsInput');

  // Load saved settings
  chrome.storage.local.get(['ivTheme', 'ivMaxXpathCharsInPreview'], (data) => {
    if (data.ivTheme) themeSelect.value = data.ivTheme;
    if (typeof data.ivMaxXpathCharsInPreview === 'number' && data.ivMaxXpathCharsInPreview > 0) {
      maxXpathCharsInput.value = data.ivMaxXpathCharsInPreview;
    }
  });

  maxXpathCharsInput.addEventListener('change', () => {
    const n = parseInt(maxXpathCharsInput.value, 10);
    if (!isFinite(n) || n < 10) return;
    chrome.storage.local.set({ ivMaxXpathCharsInPreview: n });
  });

  // Save theme and notify all OIC tabs
  themeSelect.addEventListener('change', () => {
    const theme = themeSelect.value;
    chrome.storage.local.set({ ivTheme: theme });
    chrome.tabs.query({ url: '*://*.oraclecloud.com/*' }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'iv-themeChanged', theme }).catch(() => {});
      }
    });
  });

  // True if the active tab is an OIC Integration design page that the viewer can attach to.
  function isIntegrationPage(url) {
    if (!url) return false;
    try {
      var u = new URL(url);
      return /^design\.integration\..+\.ocp\.oraclecloud\.com$/i.test(u.hostname);
    } catch (e) { return false; }
  }

  function showNotIntegrationError() {
    statusEl.textContent = 'Please navigate to an OIC page first';
    statusEl.className = 'status error';
  }

  // Helper: inject content script + CSS then run a callback
  function injectAndRun(tabId, callback) {
    statusEl.textContent = 'Injecting viewer...';
    statusEl.className = 'status';
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['jszip.min.js', 'content.js']
    }).then(() =>
      chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content.css']
      })
    ).then(() => {
      setTimeout(callback, 300);
    }).catch((err) => {
      statusEl.textContent = 'Injection failed: ' + err.message;
      statusEl.className = 'status error';
    });
  }

  // Open Viewer button — just opens the empty overlay; user enters code/version inside
  openBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        statusEl.textContent = 'No active tab found';
        statusEl.className = 'status error';
        return;
      }
      const tab = tabs[0];
      if (!isIntegrationPage(tab.url)) { showNotIntegrationError(); return; }
      const msg = { type: 'iv-openEmptyViewer' };
      chrome.tabs.sendMessage(tab.id, msg, () => {
        if (chrome.runtime.lastError) {
          injectAndRun(tab.id, () => {
            chrome.tabs.sendMessage(tab.id, msg);
            window.close();
          });
          return;
        }
        window.close();
      });
    });
  });

  // Import JSON button
  document.getElementById('importBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      statusEl.textContent = 'Reading file...';
      statusEl.className = 'status';
      const reader = new FileReader();
      reader.onload = () => {
        let data;
        try {
          data = JSON.parse(reader.result);
          if (!data.orchestration) {
            statusEl.textContent = 'Invalid file: missing "orchestration" key';
            statusEl.className = 'status error';
            return;
          }
        } catch (e) {
          statusEl.textContent = 'Failed to parse JSON: ' + e.message;
          statusEl.className = 'status error';
          return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs[0]) {
            statusEl.textContent = 'No active tab found';
            statusEl.className = 'status error';
            return;
          }
          const tab = tabs[0];
          if (!isIntegrationPage(tab.url)) { showNotIntegrationError(); return; }
          const sendImport = () => {
            chrome.tabs.sendMessage(tab.id, { type: 'iv-importData', data }, () => {
              if (chrome.runtime.lastError) {
                statusEl.textContent = 'Error: ' + chrome.runtime.lastError.message;
                statusEl.className = 'status error';
                return;
              }
              window.close();
            });
          };
          chrome.tabs.sendMessage(tab.id, { type: 'ping' }, () => {
            if (chrome.runtime.lastError) injectAndRun(tab.id, sendImport);
            else sendImport();
          });
        });
      };
      reader.readAsText(file);
    });
    input.click();
  });

  // ── Color Override Settings ──────────────────────────────────────────────

  const ACTIVITY_TYPES = [
    'RECEIVE', 'INVOKE', 'TRANSFORMER', 'ASSIGNMENT', 'ROUTER', 'ROUTER_ROUTE',
    'TRY', 'CATCH_ALL', 'THROW', 'LABEL', 'STAGEFILE', 'NOTIFICATION',
    'PUBLISHER', 'REPLY', 'NOTE', 'STITCH', 'ACTIVITY_STREAM_LOGGER', 'WAIT', 'GLOBAL_VARIABLE'
  ];

  const DEFAULT_COLORS = {
    light: {
      RECEIVE: '#1e40af', INVOKE: '#1e40af', TRANSFORMER: '#7c3aed',
      ASSIGNMENT: '#475569', ROUTER: '#c2410c', ROUTER_ROUTE: '#ea580c',
      TRY: '#b45309', CATCH_ALL: '#dc2626', THROW: '#dc2626',
      LABEL: '#16a34a', STAGEFILE: '#0d9488', NOTIFICATION: '#db2777',
      PUBLISHER: '#4f46e5', REPLY: '#2563eb', NOTE: '#94a3b8',
      STITCH: '#6b7280', ACTIVITY_STREAM_LOGGER: '#6b7280', GLOBAL_VARIABLE: '#6b7280'
    },
    dark: {
      RECEIVE: '#60a5fa', INVOKE: '#60a5fa', TRANSFORMER: '#a78bfa',
      ASSIGNMENT: '#94a3b8', ROUTER: '#fb923c', ROUTER_ROUTE: '#fdba74',
      TRY: '#fbbf24', CATCH_ALL: '#f87171', THROW: '#f87171',
      LABEL: '#4ade80', STAGEFILE: '#2dd4bf', NOTIFICATION: '#f472b6',
      PUBLISHER: '#818cf8', REPLY: '#60a5fa', NOTE: '#64748b',
      STITCH: '#9ca3af', ACTIVITY_STREAM_LOGGER: '#9ca3af', GLOBAL_VARIABLE: '#9ca3af'
    },
    'high-contrast': {
      RECEIVE: '#38bdf8', INVOKE: '#38bdf8', TRANSFORMER: '#c4b5fd',
      ASSIGNMENT: '#d4d4d4', ROUTER: '#fb923c', ROUTER_ROUTE: '#fdba74',
      TRY: '#facc15', CATCH_ALL: '#f87171', THROW: '#f87171',
      LABEL: '#4ade80', STAGEFILE: '#2dd4bf', NOTIFICATION: '#f472b6',
      PUBLISHER: '#a5b4fc', REPLY: '#38bdf8', NOTE: '#737373',
      STITCH: '#a3a3a3', ACTIVITY_STREAM_LOGGER: '#a3a3a3', GLOBAL_VARIABLE: '#a3a3a3'
    },
    solarized: {
      RECEIVE: '#268bd2', INVOKE: '#268bd2', TRANSFORMER: '#6c71c4',
      ASSIGNMENT: '#839496', ROUTER: '#cb4b16', ROUTER_ROUTE: '#cb4b16',
      TRY: '#b58900', CATCH_ALL: '#dc322f', THROW: '#dc322f',
      LABEL: '#859900', STAGEFILE: '#2aa198', NOTIFICATION: '#d33682',
      PUBLISHER: '#6c71c4', REPLY: '#268bd2', NOTE: '#586e75',
      STITCH: '#657b83', ACTIVITY_STREAM_LOGGER: '#657b83', GLOBAL_VARIABLE: '#657b83'
    }
  };

  let ivColorOverrides = {};

  function renderColorOverrides() {
    const theme = themeSelect.value;
    const defaults = DEFAULT_COLORS[theme] || {};
    const overrides = ivColorOverrides[theme] || {};
    const container = document.getElementById('colorOverrides');

    container.innerHTML = ACTIVITY_TYPES.map((type) => {
      const value = overrides[type] || defaults[type] || '#6b7280';
      return `<div class="color-row" data-type="${type}">
        <label>${type}</label>
        <input type="color" value="${value}" data-type="${type}">
        <button class="reset-btn" data-type="${type}" title="Reset to default">↺</button>
      </div>`;
    }).join('');

    container.querySelectorAll('input[type="color"]').forEach((input) => {
      input.addEventListener('change', () => {
        const t = input.dataset.type;
        if (!ivColorOverrides[theme]) ivColorOverrides[theme] = {};
        ivColorOverrides[theme][t] = input.value;
        chrome.storage.local.set({ ivColorOverrides });
      });
    });

    container.querySelectorAll('.reset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.type;
        if (ivColorOverrides[theme]) {
          delete ivColorOverrides[theme][t];
          if (Object.keys(ivColorOverrides[theme]).length === 0) {
            delete ivColorOverrides[theme];
          }
        }
        chrome.storage.local.set({ ivColorOverrides });
        renderColorOverrides();
      });
    });
  }

  // Load color overrides from storage then render
  chrome.storage.local.get(['ivColorOverrides'], (data) => {
    ivColorOverrides = data.ivColorOverrides || {};
    renderColorOverrides();
  });

  // Re-render color pickers when theme changes
  themeSelect.addEventListener('change', renderColorOverrides);
});
