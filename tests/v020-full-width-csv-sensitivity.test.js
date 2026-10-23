'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const html = read('index.html');
const app = read('app.js');
const css = read('styles.css');

test('V0.20 exposes a direct action for manual X/Y CSV scatter plots', () => {
  assert.match(html, /id="drawGenericScatterBtn"[^>]*>Desenhar gráfico X × Y/);
  assert.match(app, /el\('drawGenericScatterBtn'\)\?\.addEventListener\('click'/);
  assert.match(app, /dataset\.userSelected='true'/);
  assert.match(app, /genericManuallySelected/);
});

test('sensitivity band selection always selects a valid eligible option', () => {
  assert.match(app, /const eligibleIndexes=\[\]/);
  assert.match(app, /const targetIndex=eligibleIndexes\.includes\(requestedIndex\)\?requestedIndex:\(eligibleIndexes\[0\]\?\?-1\)/);
  assert.match(app, /SENSITIVITY_MAX_POINTS = 1200/);
  assert.match(app, /finally \{ const current=state\.results\[Number\(select\?\.value\)\]/);
});

test('fullscreen charts are resized on panel changes and kept inside responsive containers', () => {
  assert.match(app, /chart\.resize\(\);chart\.update\('none'\)/);
  assert.match(app, /new ResizeObserver/);
  assert.match(css, /\.chart-panel-fullscreen \.chart-container > canvas\s*\{[^}]*inset:0!important/s);
  assert.match(css, /height:clamp\(230px, 27vw, 350px\)/);
  assert.match(css, /overflow:hidden!important/);
});

test('current analysis has one-click bridge to the advanced gallery and CSV downloads', () => {
  for (const id of ['useMainRawBatchBtn','downloadMainRawBatchCsvBtn','useMainMetricsBatchBtn','downloadMainMetricsBatchCsvBtn']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(app, /function useMainAnalysisInBatch\(mode='metrics'\)/);
  assert.match(app, /function downloadMainAnalysisCsv\(mode='metrics'\)/);
});

test('numeric column discovery samples across the entire CSV instead of only its beginning', () => {
  assert.match(app, /Sample the whole file, not only its first rows/);
  assert.match(app, /limitPointsForDisplay\(parsed\.rows,Math\.min\(parsed\.rows\.length,300\)\)/);
});
