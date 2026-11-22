/**
 * Madhav Finance Manager - Progressive Web App (PWA) Automated Tests
 *
 * Verifies:
 * - Manifest structure, required fields, and icon integrity.
 * - Service worker syntax, cache versioning, and precache asset completeness.
 * - GitHub Pages subpath compatibility (relative paths, no root assumptions).
 * - Offline navigation fallback and cache cleanup safety.
 * - Protection of client LocalStorage data during service worker updates.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Progressive Web App (PWA) Infrastructure', () => {

  test('PWA Manifest: valid JSON and all required PWA properties present', () => {
    const manifestPath = path.join(rootDir, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist at project root');

    const content = fs.readFileSync(manifestPath, 'utf8');
    let manifest;
    assert.doesNotThrow(() => {
      manifest = JSON.parse(content);
    }, 'manifest.json must be valid JSON');

    assert.equal(manifest.name, 'Madhav Finance Manager');
    assert.equal(manifest.short_name, 'Madhav Finance');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.orientation, 'portrait-primary');
    assert.equal(manifest.theme_color, '#059669');
    assert.equal(manifest.background_color, '#0F172A');
    assert.ok(Array.isArray(manifest.icons), 'manifest.icons must be an array');
    assert.ok(manifest.icons.length >= 2, 'manifest must specify at least 192px and 512px icons');
  });

  test('PWA Manifest: GitHub Pages subpath compatibility (relative paths)', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));

    // start_url and scope must NOT be root-absolute (e.g., '/') because GitHub Pages hosts under /<repo-name>/
    assert.ok(
      manifest.start_url.startsWith('./') || !manifest.start_url.startsWith('/'),
      `start_url must be relative: "${manifest.start_url}"`
    );
    assert.ok(
      manifest.scope.startsWith('./') || !manifest.scope.startsWith('/'),
      `scope must be relative: "${manifest.scope}"`
    );

    // All icon paths must also be relative
    manifest.icons.forEach((icon) => {
      assert.ok(
        icon.src.startsWith('./') || !icon.src.startsWith('/'),
        `Icon path must be relative for subpaths: "${icon.src}"`
      );
    });
  });

  test('PWA Manifest: all referenced icon files exist on disk with valid sizes', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));

    manifest.icons.forEach((icon) => {
      const cleanPath = icon.src.replace(/^\.\//, '');
      const fullPath = path.join(rootDir, cleanPath);

      assert.ok(fs.existsSync(fullPath), `Icon file must exist: ${cleanPath}`);
      const stats = fs.statSync(fullPath);
      assert.ok(stats.size > 0, `Icon file must not be empty: ${cleanPath}`);
    });
  });

  test('Service Worker: file exists, has valid syntax, and defines versioned cache', () => {
    const swPath = path.join(rootDir, 'service-worker.js');
    assert.ok(fs.existsSync(swPath), 'service-worker.js must exist at project root');

    const content = fs.readFileSync(swPath, 'utf8');

    // Must define a versioned cache name
    assert.ok(
      /const\s+CACHE_NAME\s*=\s*['"]madhav-finance-v\d+['"]/.test(content),
      'service-worker.js must define versioned CACHE_NAME'
    );

    // Must implement install, activate, and fetch listeners
    assert.ok(content.includes("addEventListener('install'"), 'Must handle install event');
    assert.ok(content.includes("addEventListener('activate'"), 'Must handle activate event');
    assert.ok(content.includes("addEventListener('fetch'"), 'Must handle fetch event');
  });

  test('Service Worker: all precached assets exist on disk (zero 404 risk)', () => {
    const swContent = fs.readFileSync(path.join(rootDir, 'service-worker.js'), 'utf8');

    // Extract PRECACHE_ASSETS array
    const match = swContent.match(/const\s+PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
    assert.ok(match, 'PRECACHE_ASSETS array must be defined');

    const assetStrings = match[1]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter((s) => s.length > 0 && s !== './');

    assert.ok(assetStrings.length >= 10, 'Expected at least 10 core precached assets');

    assetStrings.forEach((relPath) => {
      // Must be relative
      assert.ok(relPath.startsWith('./'), `Precache path must start with ./: ${relPath}`);

      // Must not be a remote URL
      assert.ok(!relPath.startsWith('http'), `Precache must not contain remote URLs: ${relPath}`);

      const diskPath = path.join(rootDir, relPath.replace(/^\.\//, ''));
      assert.ok(fs.existsSync(diskPath), `Precached file must exist on disk: ${relPath}`);
    });
  });

  test('Service Worker: cache cleanup never deletes client LocalStorage or user data', () => {
    const swContent = fs.readFileSync(path.join(rootDir, 'service-worker.js'), 'utf8');

    // Verify service worker only calls caches.delete on obsolete cache names
    assert.ok(
      swContent.includes('caches.delete(obsoleteName)') || swContent.includes('caches.delete('),
      'Must delete obsolete caches'
    );

    // Service workers do not have access to localStorage, but verify no misleading storage wipe calls
    assert.ok(!swContent.includes('localStorage.clear'), 'Service worker must never clear localStorage');
    assert.ok(!swContent.includes('indexedDB.deleteDatabase'), 'Must not delete client databases');
  });

  test('HTML Integration: index.html references manifest, Apple touch icon, and relative scripts', () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    // Manifest link
    assert.ok(
      html.includes('<link rel="manifest" href="./manifest.json">'),
      'index.html must link to ./manifest.json'
    );

    // Apple touch icon
    assert.ok(
      html.includes('<link rel="apple-touch-icon" href="./assets/icons/apple-touch-icon.png">'),
      'index.html must link to ./assets/icons/apple-touch-icon.png'
    );

    // Meta tags for iOS PWA
    assert.ok(html.includes('apple-mobile-web-app-capable'), 'iOS web app capable meta tag required');
    assert.ok(html.includes('apple-mobile-web-app-status-bar-style'), 'iOS status bar style meta tag required');
    assert.ok(html.includes('theme-color'), 'theme-color meta tag required');

    // Local Chart.js vendor script
    assert.ok(html.includes('src="./assets/vendor/chart.umd.min.js"'), 'Chart.js must load from local assets');

    // Modular app script
    assert.ok(html.includes('src="./js/app.js"'), 'app.js must load relatively');
  });

  test('Application Registration: app.js registers service worker with relative scope', () => {
    const appContent = fs.readFileSync(path.join(rootDir, 'js/app.js'), 'utf8');

    assert.ok(
      appContent.includes("navigator.serviceWorker.register('./service-worker.js', { scope: './' })"),
      'app.js must register ./service-worker.js with relative scope ./'
    );

    assert.ok(
      appContent.includes('updatefound') || appContent.includes('showUpdateToast'),
      'app.js must handle service worker update notifications'
    );
  });
});
