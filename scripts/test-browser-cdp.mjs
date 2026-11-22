import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(os.tmpdir(), 'madhav-chrome-cdp-test-' + Date.now());

// Ensure clean temp dir
fs.mkdirSync(userDataDir, { recursive: true });

console.log('Starting headless Chrome for live browser verification...');
const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  'about:blank'
], { stdio: 'ignore' });

// Wait for Chrome to open remote debugging port
async function waitForCDP(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Wait 200ms
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Chrome remote debugging port not available after timeout');
}

// Minimal CDP client using native Node 22 WebSocket
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.callbacks = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message));
          } else {
            resolve(msg.result);
          }
        } else if (msg.method && this.eventListeners.has(msg.method)) {
          this.eventListeners.get(msg.method)(msg.params);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(event, handler) {
    this.eventListeners.set(event, handler);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runBrowserTests() {
  const version = await waitForCDP();
  console.log(`Connected to Chrome: ${version['Browser']}`);

  // Get existing target
  const listRes = await fetch('http://127.0.0.1:9222/json/list');
  const targets = await listRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  console.log('WebSocket CDP connection established.');

  const consoleLogs = [];
  const errors = [];

  client.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => a.value || JSON.stringify(a)).join(' ');
    consoleLogs.push({ type: params.type, text });
    if (params.type === 'error') {
      errors.push(text);
    }
  });

  client.on('Runtime.exceptionThrown', (params) => {
    const desc = params.exceptionDetails.exception?.description || params.exceptionDetails.text;
    errors.push(desc);
  });

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  // Navigate to application
  await client.send('Page.navigate', { url: 'http://127.0.0.1:3000' });

  // Wait for page to finish loading
  await new Promise((r) => setTimeout(r, 1200));

  // Helper to evaluate in page
  async function evaluate(expression) {
    const res = await client.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result.value;
  }

  console.log('\n--- 1. Testing Page Initialization & Chart.js Loading ---');
  const title = await evaluate('document.title');
  console.log(`Page Title: "${title}"`);
  if (title !== 'Madhav Finance Manager') {
    throw new Error(`Unexpected page title: ${title}`);
  }

  const chartLoaded = await evaluate('typeof window.Chart === "function"');
  console.log(`Chart.js loaded: ${chartLoaded}`);
  if (!chartLoaded) throw new Error('Chart.js vendor library failed to load!');

  // Check 4 KPI values
  const kpis = await evaluate(`({
    income: document.getElementById('kpi-income').textContent,
    expense: document.getElementById('kpi-expense').textContent,
    surplus: document.getElementById('kpi-surplus').textContent,
    rate: document.getElementById('kpi-savings-rate').textContent
  })`);
  console.log('Default KPIs initialized:', kpis);

  console.log('\n--- 2. Testing Transaction Creation Flow ---');
  // Open transaction modal
  await evaluate('document.getElementById("btn-header-add").click()');
  const modalOpen = await evaluate('document.getElementById("modal-transaction").classList.contains("open")');
  console.log(`Transaction Modal opened: ${modalOpen}`);
  if (!modalOpen) throw new Error('Modal failed to open on add button click');

  // Fill and submit transaction form
  await evaluate(`
    document.getElementById('txn-amount').value = '4500.50';
    document.getElementById('txn-category').value = 'groceries';
    document.getElementById('txn-payment-mode').value = 'upi';
    document.getElementById('txn-desc').value = 'Fresh Organic Vegetables';
    document.getElementById('form-transaction').dispatchEvent(new Event('submit', { cancelable: true }));
  `);

  await new Promise((r) => setTimeout(r, 300));

  const modalClosed = await evaluate('!document.getElementById("modal-transaction").classList.contains("open")');
  console.log(`Transaction Modal closed after submit: ${modalClosed}`);
  if (!modalClosed) throw new Error('Modal did not close after submit');

  // Verify toast notification
  const toastText = await evaluate('document.querySelector(".toast.show")?.textContent');
  console.log(`Toast shown: "${toastText}"`);

  // Verify updated KPI
  const updatedExpense = await evaluate('document.getElementById("kpi-expense").textContent');
  console.log(`Updated Monthly Expense KPI: ${updatedExpense}`);
  if (!updatedExpense.includes('4,500.50')) {
    throw new Error(`KPI did not update with transaction amount: ${updatedExpense}`);
  }

  // Verify Recent Transactions list on dashboard
  const recentItems = await evaluate(`
    Array.from(document.querySelectorAll('#dashboard-recent-list .transaction-item')).map(el => ({
      desc: el.querySelector('.txn-desc').textContent,
      amount: el.querySelector('.txn-amount').textContent
    }))
  `);
  console.log('Dashboard Recent Transactions:', recentItems);
  if (recentItems.length === 0 || !recentItems[0].desc.includes('Fresh Organic Vegetables')) {
    throw new Error('Recent transaction item was not rendered in dashboard list');
  }

  console.log('\n--- 3. Testing Navigation & View Switching ---');
  // Switch to Ledger
  await evaluate('document.querySelector(".desktop-nav .nav-link[data-view=\\"transactions\\"]").click()');
  const ledgerActive = await evaluate('document.getElementById("view-transactions").classList.contains("active")');
  console.log(`Ledger view active: ${ledgerActive}`);
  if (!ledgerActive) throw new Error('Failed to switch to ledger view');

  const ledgerCount = await evaluate('document.querySelectorAll("#ledger-transaction-list .transaction-item").length');
  console.log(`Ledger items rendered: ${ledgerCount}`);
  if (ledgerCount !== 1) throw new Error(`Expected 1 transaction in ledger, got ${ledgerCount}`);

  // Switch to Budgets
  await evaluate('document.querySelector(".desktop-nav .nav-link[data-view=\\"budgets\\"]").click()');
  const budgetsActive = await evaluate('document.getElementById("view-budgets").classList.contains("active")');
  console.log(`Budgets view active: ${budgetsActive}`);

  // Create a budget
  await evaluate('document.getElementById("btn-add-budget").click()');
  await evaluate(`
    document.getElementById('bgt-category').value = 'groceries';
    document.getElementById('bgt-limit').value = '10000';
    document.getElementById('form-budget').dispatchEvent(new Event('submit', { cancelable: true }));
  `);
  await new Promise((r) => setTimeout(r, 300));

  const budgetCards = await evaluate(`
    Array.from(document.querySelectorAll('#budgets-container .budget-card')).map(el => ({
      title: el.querySelector('.card-title').textContent,
      spent: el.querySelector('.metric-spent').textContent,
      limit: el.querySelector('.metric-limit').textContent
    }))
  `);
  console.log('Budgets rendered:', budgetCards);
  if (budgetCards.length === 0) throw new Error('Budget card failed to render');

  // Switch to Goals
  await evaluate('document.querySelector(".desktop-nav .nav-link[data-view=\\"goals\\"]").click()');
  const goalsActive = await evaluate('document.getElementById("view-goals").classList.contains("active")');
  console.log(`Goals view active: ${goalsActive}`);

  // Create a goal
  await evaluate('document.getElementById("btn-add-goal").click()');
  await evaluate(`
    document.getElementById('gol-name').value = 'Emergency Reserve';
    document.getElementById('gol-target').value = '500000';
    document.getElementById('gol-saved').value = '600000';
    document.getElementById('form-goal').dispatchEvent(new Event('submit', { cancelable: true }));
  `);
  await new Promise((r) => setTimeout(r, 300));

  const goalCards = await evaluate(`
    Array.from(document.querySelectorAll('#goals-container .goal-card')).map(el => ({
      title: el.querySelector('.card-title').textContent,
      badge: el.querySelector('.badge-tag')?.textContent,
      spent: el.querySelector('.metric-spent').textContent
    }))
  `);
  console.log('Goals rendered (exceeded >100% test):', goalCards);
  if (goalCards.length === 0 || goalCards[0].badge !== 'Exceeded') {
    throw new Error('Goal exceeded badge failed to render properly');
  }

  console.log('\n--- 4. Testing Theme Switching ---');
  await evaluate('document.querySelector(".desktop-nav .nav-link[data-view=\\"settings\\"]").click()');
  await evaluate('document.querySelector(".theme-btn[data-theme-val=\\"dark\\"]").click()');
  const darkTheme = await evaluate('document.documentElement.getAttribute("data-theme")');
  console.log(`Applied dark theme: ${darkTheme}`);
  if (darkTheme !== 'dark') throw new Error('Dark theme was not applied');

  await evaluate('document.querySelector(".theme-btn[data-theme-val=\\"light\\"]").click()');
  const lightTheme = await evaluate('document.documentElement.getAttribute("data-theme")');
  console.log(`Applied light theme: ${lightTheme}`);
  if (lightTheme !== 'light') throw new Error('Light theme was not applied');

  console.log('\n--- 5. Testing Mobile Viewport (iPhone 390x844) ---');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });

  const bottomNavVisible = await evaluate(`
    (() => {
      const nav = document.querySelector('.bottom-nav');
      const style = window.getComputedStyle(nav);
      return style.display !== 'none' && style.visibility !== 'hidden';
    })()
  `);
  console.log(`Mobile bottom nav visible: ${bottomNavVisible}`);
  if (!bottomNavVisible) throw new Error('Bottom navigation bar is not visible at mobile width!');

  const fabVisible = await evaluate(`
    (() => {
      const fab = document.getElementById('fab-add-txn');
      const style = window.getComputedStyle(fab);
      return style.display !== 'none' && style.visibility !== 'hidden';
    })()
  `);
  console.log(`Mobile FAB button visible: ${fabVisible}`);
  if (!fabVisible) throw new Error('Floating Action Button is not visible on mobile!');

  // Test mobile FAB click opens transaction modal
  await evaluate('document.getElementById("fab-add-txn").click()');
  const fabModalOpen = await evaluate('document.getElementById("modal-transaction").classList.contains("open")');
  console.log(`Transaction Modal opened via mobile FAB: ${fabModalOpen}`);

  // Test modal dismiss via Escape key
  await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))');
  const modalDismissed = await evaluate('!document.getElementById("modal-transaction").classList.contains("open")');
  console.log(`Modal dismissed via Escape key: ${modalDismissed}`);
  if (!modalDismissed) throw new Error('Modal did not dismiss on Escape key press');

  console.log('\n--- 6. Testing Service Worker & Offline PWA Caching ---');
  // Wait for service worker to activate
  const swState = await evaluate(`
    new Promise((resolve) => {
      if (!('serviceWorker' in navigator)) return resolve({ supported: false });
      navigator.serviceWorker.ready.then((reg) => {
        resolve({
          supported: true,
          scope: reg.scope,
          active: Boolean(reg.active)
        });
      }).catch((err) => resolve({ supported: true, error: err.message }));
    })
  `);
  console.log('Service Worker status:', swState);

  // Check caches created
  const cacheNames = await evaluate('caches.keys()');
  console.log('Active caches in browser:', cacheNames);
  if (!cacheNames.includes('madhav-finance-v1')) {
    throw new Error('Expected cache "madhav-finance-v1" was not created by service worker');
  }

  // Check cached items count
  const cachedCount = await evaluate(`
    caches.open('madhav-finance-v1').then(c => c.keys()).then(keys => keys.length)
  `);
  console.log(`Precached items in madhav-finance-v1: ${cachedCount}`);
  if (cachedCount < 10) {
    throw new Error(`Expected at least 10 precached items, got ${cachedCount}`);
  }

  // Emulate OFFLINE
  console.log('Emulating network offline mode...');
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0
  });

  // Test offline reload
  console.log('Reloading application while completely offline...');
  await client.send('Page.reload');
  await new Promise((r) => setTimeout(r, 1500));

  // Verify app loaded from service worker cache while offline
  const offlineTitle = await evaluate('document.title');
  console.log(`Offline Page Title: "${offlineTitle}"`);
  if (offlineTitle !== 'Madhav Finance Manager') {
    throw new Error('Application failed to load while offline!');
  }

  // Verify Chart.js loaded while offline
  const offlineChart = await evaluate('typeof window.Chart === "function"');
  console.log(`Chart.js loaded offline: ${offlineChart}`);
  if (!offlineChart) {
    throw new Error('Chart.js was not available while offline!');
  }

  // Verify LocalStorage data remained intact after offline reload
  const offlineTxnCount = await evaluate('JSON.parse(localStorage.getItem("madhavFinanceApp")).transactions.length');
  console.log(`Transactions preserved in LocalStorage while offline: ${offlineTxnCount}`);
  if (offlineTxnCount !== 1) {
    throw new Error(`Expected 1 preserved transaction, got ${offlineTxnCount}`);
  }

  // Disable offline emulation
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });

  console.log('\n--- 7. Console Error Check ---');
  console.log(`Total console logs captured: ${consoleLogs.length}`);
  console.log(`Total console errors: ${errors.length}`);
  if (errors.length > 0) {
    console.error('Browser errors captured:', errors);
    throw new Error(`Encountered ${errors.length} browser console errors during testing!`);
  } else {
    console.log('ZERO browser console errors detected.');
  }

  client.close();
}

try {
  await runBrowserTests();
  console.log('\n=== ALL BROWSER & RESPONSIVE VERIFICATION TESTS PASSED ===');
} catch (err) {
  console.error('\nBrowser test failure:', err);
  process.exitCode = 1;
} finally {
  chromeProc.kill('SIGKILL');
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch (e) {}
}
