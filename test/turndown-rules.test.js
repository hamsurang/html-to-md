const { describe, it } = require('node:test');
const assert = require('node:assert');

// Test Turndown conversion by building dist and importing
// Since Turndown needs DOM, we test the bundled output patterns
// by checking that the esbuild build produces valid JS

describe('build output', () => {
  it('content.js should exist and be non-empty', () => {
    const fs = require('fs');
    const path = require('path');
    const contentPath = path.resolve(__dirname, '../dist/content.js');
    assert.ok(fs.existsSync(contentPath), 'dist/content.js should exist');
    const stat = fs.statSync(contentPath);
    assert.ok(stat.size > 10000, `content.js should be >10KB, got ${stat.size}`);
  });

  it('background.js should exist and be non-empty', () => {
    const fs = require('fs');
    const path = require('path');
    const bgPath = path.resolve(__dirname, '../dist/background.js');
    assert.ok(fs.existsSync(bgPath), 'dist/background.js should exist');
    const stat = fs.statSync(bgPath);
    assert.ok(stat.size > 500, `background.js should be >500B, got ${stat.size}`);
  });

  it('popup.js should exist and be non-empty', () => {
    const fs = require('fs');
    const path = require('path');
    const popupPath = path.resolve(__dirname, '../dist/popup/popup.js');
    assert.ok(fs.existsSync(popupPath), 'dist/popup/popup.js should exist');
    const stat = fs.statSync(popupPath);
    assert.ok(stat.size > 500, `popup.js should be >500B, got ${stat.size}`);
  });

  it('manifest.json should be valid JSON with correct structure', () => {
    const fs = require('fs');
    const path = require('path');
    const manifestPath = path.resolve(__dirname, '../dist/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.manifest_version, 3);
    assert.ok(manifest.permissions.includes('activeTab'));
    assert.ok(manifest.permissions.includes('clipboardWrite'));
    assert.ok(manifest.permissions.includes('scripting'));
    assert.ok(manifest.permissions.includes('storage'));
    assert.ok(manifest.action.default_popup);
    assert.ok(manifest.background.service_worker);
    assert.ok(manifest.commands['convert-page']);
  });

  it('total bundle size should be under 500KB', () => {
    const fs = require('fs');
    const path = require('path');
    const files = ['dist/content.js', 'dist/background.js', 'dist/popup/popup.js'];
    let total = 0;
    for (const f of files) {
      total += fs.statSync(path.resolve(__dirname, '..', f)).size;
    }
    assert.ok(total < 500 * 1024, `Total bundle ${total} should be <512KB`);
  });
});

describe('manifest references', () => {
  it('all referenced files should exist in dist/', () => {
    const fs = require('fs');
    const path = require('path');
    const distDir = path.resolve(__dirname, '../dist');
    const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8'));

    // Check service worker
    assert.ok(fs.existsSync(path.join(distDir, manifest.background.service_worker)),
      `${manifest.background.service_worker} should exist`);

    // Check popup
    assert.ok(fs.existsSync(path.join(distDir, manifest.action.default_popup)),
      `${manifest.action.default_popup} should exist`);

    // Check icons
    for (const [size, iconPath] of Object.entries(manifest.icons)) {
      assert.ok(fs.existsSync(path.join(distDir, iconPath)),
        `Icon ${iconPath} should exist`);
    }
  });
});
