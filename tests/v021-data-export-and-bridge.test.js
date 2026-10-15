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
const citation = read('CITATION.cff');

test('loaded curve exposes a CSV download action before scientific calculation', () => {
  assert.match(html, /id="preparedCurveExport"[^>]*prepared-curve-export hidden/);
  assert.match(html, /id="downloadPreparedCurveCsvBtn"[^>]*>↓ Baixar CSV inicial/);
  assert.match(app, /function syncPreparedCurveExport\(\)/);
  assert.match(app, /const timeReady=Number\(el\('timeColumn'\)\?\.value\?\?-1\)>=0/);
  assert.match(app, /syncPreparedCurveExport\(\);/);
  assert.match(app, /function buildPreparedCurveCsv\(\)/);
  assert.match(app, /const header=\['source','class','band','time','flux','error'\]/);
});

test('sensitivity grid has visible PNG and CSV export controls after a successful calculation', () => {
  assert.match(html, /id="sensitivityExportActions" class="sensitivity-export-actions hidden"/);
  assert.match(html, /id="downloadSensitivityPngBtn"/);
  assert.match(html, /id="downloadSensitivityCsvBtn"/);
  assert.match(app, /function downloadSensitivityPng\(\)/);
  assert.match(app, /function downloadSensitivityCsv\(\)/);
  assert.match(app, /sensitivityExportActions'\)\?\.classList\.remove\('hidden'\)/);
  assert.match(css, /\.sensitivity-export-actions \.button \{ min-height:44px/);
});

test('advanced gallery has integration shortcuts above the CSV uploader', () => {
  const bridge = html.indexOf('id="batchTopBridgeHeading"');
  const uploader = html.indexOf('id="batchDataFile"');
  assert.ok(bridge >= 0 && uploader > bridge, 'top bridge should be before the file uploader');
  for (const id of ['useLoadedCurveBatchTopBtn','useMainCombinedBatchTopBtn','downloadMainCombinedBatchCsvTopBtn']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /el\('useMainCombinedBatchTopBtn'\)\?\.addEventListener\('click',\(\)=>useMainAnalysisInBatch\('combined'\)\)/);
});

test('combined bridge contains raw time/flux for each observation and global metrics once per band', () => {
  assert.match(app, /if\(mode==='combined'\)\{\s*const header=\['source','class','band','time','flux','error','sampen','modulation_index_percent','sigma','r_absolute','n_points'\]/);
  assert.match(app, /const includeMetrics=!metricsWritten;metricsWritten=true/);
  assert.match(app, /function useLoadedCurveInBatch\(\)/);
  assert.match(app, /function currentLoadedCurveParsed\(\)/);
  assert.match(app, /batchTimeColumn/);
  assert.match(app, /batchFluxColumn/);
});

test('multiband profile legend is brighter and easier to read', () => {
  assert.match(app, /color: '#ffffff', font: \{ family: 'system-ui, sans-serif', size: 13, weight: '700' \}, boxWidth: 17, boxHeight: 13, padding: 18/);
  assert.match(css, /#batchBandProfilePanel \.chart-footnote \{ color:#d4def0; font-size:12px/);
});

test('release metadata points to V0.22', () => {
  assert.match(html, /Multiband Entropy Lab V0\.22/);
  assert.match(citation, /version: "0\.22"/);
  assert.match(read('README.md'), /V0\.22 \(auditoria metodológica da Sample Entropy\)/);
});
