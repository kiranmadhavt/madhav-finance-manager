/**
 * Madhav Finance Manager - CI/CD Pipeline Automated Tests
 *
 * Verifies:
 * - GitHub Actions workflow structure and syntax.
 * - Continuous Integration triggers on pushes and PRs to main.
 * - Deployment dependency on passing CI tests.
 * - Least-privilege permissions (contents: read, pages: write, id-token: write).
 * - Official GitHub Pages deployment actions.
 * - Concurrency group configuration to prevent deployment race conditions.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('GitHub Actions CI/CD Pipeline Configuration', () => {

  const workflowPath = path.join(rootDir, '.github', 'workflows', 'deploy.yml');

  test('Workflow file exists and is readable', () => {
    assert.ok(fs.existsSync(workflowPath), '.github/workflows/deploy.yml must exist');
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.length > 0, 'Workflow file must not be empty');
  });

  test('Workflow triggers on push and pull_request to main branch', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(content.includes('push:'), 'Workflow must trigger on push');
    assert.ok(content.includes('pull_request:'), 'Workflow must trigger on pull_request');
    assert.ok(content.includes('- main'), 'Workflow must target main branch');
  });

  test('CI Job: runs syntax validation and automated test suite on Node LTS', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    // Node version
    assert.ok(content.includes('node-version: 22.x') || content.includes('node-version: 20.x'), 'Must use supported Node LTS');

    // Syntax check step
    assert.ok(content.includes('npm run check'), 'Must run npm run check');

    // Test execution step
    assert.ok(content.includes('npm test'), 'Must run npm test');
  });

  test('Deploy Job: gated on CI success, restricted to main pushes, and uses least-privilege permissions', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    // Dependency on CI
    assert.ok(content.includes('needs: ci'), 'Deploy job must depend on ci job');

    // Branch condition
    assert.ok(content.includes("github.ref == 'refs/heads/main'"), 'Must deploy only from main branch');
    assert.ok(content.includes("github.event_name != 'pull_request'"), 'Must never deploy pull requests');

    // Least-privilege permissions
    assert.ok(content.includes('pages: write'), 'pages: write permission required');
    assert.ok(content.includes('id-token: write'), 'id-token: write permission required');
    assert.ok(content.includes('contents: read'), 'contents: read permission required');

    // Official Pages actions & Staged production artifact
    assert.ok(content.includes('actions/configure-pages@v5'), 'Must use actions/configure-pages@v5');
    assert.ok(content.includes('actions/upload-pages-artifact@v3'), 'Must use actions/upload-pages-artifact@v3');
    assert.ok(content.includes("path: 'dist'"), 'Must upload staged dist directory excluding tests and development scripts');
    assert.ok(content.includes('actions/deploy-pages@v4'), 'Must use actions/deploy-pages@v4');

    // Concurrency control
    assert.ok(content.includes('concurrency:'), 'Must specify concurrency group');
    assert.ok(content.includes('group: "pages"'), 'Must group on pages');
  });

  test('package.json scripts support CI workflow commands', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

    assert.ok(pkg.scripts, 'scripts object required in package.json');
    assert.ok(pkg.scripts.check, 'npm run check script required');
    assert.ok(pkg.scripts.test, 'npm test script required');
  });
});
