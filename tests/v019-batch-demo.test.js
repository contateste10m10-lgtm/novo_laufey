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

test('advanced modes look and behave like a clickable disclosure', () => {
  assert.match(html, /<details id="advancedModes" class="advanced-modes"><summary[^>]*>/);
  assert.match(html, /class="advanced-modes-cta"/);
  assert.match(css, /\.advanced-modes > summary:hover/);
  assert.match(css, /\.advanced-modes > summary:focus-visible/);
});

test('advanced gallery has one-click synthetic data and downloadable CSV', () => {
  assert.match(html, /id="batchLoadDemoBtn"/);
  assert.match(html, /id="batchDownloadDemoBtn"/);
  assert.match(app, /function createBatchDemoParsed\(\)/);
  assert.match(app, /function loadBatchDemoData\(\)/);
  assert.match(app, /9 fontes, 8 bandas e 8 janelas/);
  assert.match(app, /dados sintéticos/i);
});

test('SampEn has a fallback chart for small samples rather than table only', () => {
  assert.match(html, /id="batchSampenByRecordChart"/);
  assert.match(app, /function renderBatchSampenByRecord\(rows,renderAdvanced\)/);
  assert.match(app, /const sampenFallbackCandidate=rows\.some\(row=>Number\.isFinite\(row\.sampen\)\)/);
});

test('raw CSV with only time and flux can use single-source and single-band labels', () => {
  assert.match(app, /rawCurveMapped\?'Fonte única'/);
  assert.match(app, /rawCurveMapped\?'Banda única'/);
  assert.match(app, /const hasRaw=batchState\.mapped\.time&&batchState\.mapped\.flux/);
});

test('generate gallery opens advanced charts instead of collapsing them', () => {
  assert.match(app, /const advanced=el\('batchAdvancedVisuals'\);if\(advanced\)advanced\.open=true;renderBatchGallery\(rows\)/);
  assert.doesNotMatch(app, /if\(advanced\)advanced\.open=false;renderBatchGallery\(rows\)/);
});

test('MIT license and upload instructions are included at repository root', () => {
  assert.match(read('LICENSE'), /MIT License/);
  assert.match(read('CITATION.cff'), /license: MIT/);
  assert.match(read('README-GITHUB-UPLOAD.md'), /assets.*tests.*\.github/s);
  assert.ok(fs.existsSync(path.join(root, 'examples/demo_multifonte_SINTETICO.csv')));
});


test('demo CSV contains 576 synthetic rows with varied scientific columns', () => {
  const csv = read('examples/demo_multifonte_SINTETICO.csv').trim().split(/\r?\n/);
  const header = csv[0].split(',');
  assert.equal(csv.length - 1, 576);
  for (const name of ['fonte','janela','banda','tempo','fluxo','sampen','classe_fonte','variabilidade_robusta','modulation_index_percent']) assert.ok(header.includes(name), `missing ${name}`);
  const rows = csv.slice(1).map(line => line.split(','));
  const sampenIndex = header.indexOf('sampen');
  const fluxIndex = header.indexOf('fluxo');
  const sourceIndex = header.indexOf('fonte');
  assert.ok(new Set(rows.map(row => row[sourceIndex])).size === 9);
  assert.ok(new Set(rows.map(row => row[sampenIndex])).size > 10);
  assert.ok(new Set(rows.map(row => row[fluxIndex])).size > 10);
  assert.ok(csv[1].includes('SINTÉTICO'));
});

test('generic CSV preview does not get suppressed by degenerate time/flux columns', () => {
  assert.match(app, /const validSampenRows=rows\.filter\(row=>Number\.isFinite\(row\.sampen\)\)\.map\(row=>row\.sampen\)/);
  assert.match(app, /uniqueFiniteCount\(rawPairs\.map\(row=>row\.time\)\)>=2/);
  assert.match(app, /uniqueFiniteCount\(rawPairs\.map\(row=>row\.flux\)\)>=2/);
  assert.match(app, /function renderBatchGenericScatter\(rows,renderAdvanced\)/);
  assert.match(app, /genericXValue/);
  assert.match(app, /genericYValue/);
});


test('duplicate column suggestions are cleared and explained to the user', () => {
  assert.match(app, /const beforeCleaning=mappingIds\.map/);
  assert.match(app, /const hadDuplicateMappings=beforeCleaning\.length>new Set\(beforeCleaning\)\.size/);
  assert.match(app, /limpei as duplicações automaticamente/);
});
