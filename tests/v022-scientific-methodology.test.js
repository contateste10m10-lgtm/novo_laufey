'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Core = require('../analysis-core.js');
const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const worker = fs.readFileSync('analysis-worker.js', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');

test('V0.22 counts the first N-m template starts at both m and m+1', () => {
  const result = Core.sampleEntropy([0, 0, 1, 1, 0, 0], 1, 0.2);
  assert.equal(result.templateCount, 5);
  assert.equal(result.B, 4);
  assert.equal(result.A, 1);
  assert.equal(result.A <= result.B, true);
  assert.ok(Math.abs(result.value - Math.log(4)) < 1e-12);
});

test('confidence interval is transformed from conditional probability and boundary cases are flagged', () => {
  const series = Array.from({ length: 1200 }, (_, i) => Math.sin(i * 0.19) + 0.4 * Math.sin(i * 0.037) + 0.16 * Math.cos(i * 0.71));
  const r = Core.sampleEntropy(series, 2, 0.2);
  assert.ok(r.ci95 && r.ci95.level === 0.95);
  assert.ok(Number.isFinite(r.ci95.lower));
  assert.ok(r.ci95.upper == null || r.ci95.upper >= r.ci95.lower);
  const boundary = Core.sampleEntropy([0, 0, 1, 1, 0, 0], 1, 2);
  if (boundary.A === boundary.B) assert.equal(boundary.ci95.status, 'boundary_probability');
});

test('temporal diagnostics report duplicate timestamps, order reversals and heuristic gaps', () => {
  const d = Core.timeSeriesDiagnostics([0, 1, 2, 2, 3, 20, 4]);
  assert.equal(d.duplicateCount, 1);
  assert.equal(d.orderReversals, 1);
  assert.ok(d.gapCount > 0);
  assert.equal(d.nInput, 7);
});

test('results and CSV expose A/B, template convention and approximate 95% interval', () => {
  assert.match(html, /IC aprox\. 95%/);
  assert.match(html, /Qualidade da amostragem temporal/);
  assert.match(app, /Richman & Moorman \(2000\): same N-m template starts/);
  assert.match(app, /SampEn_CI95_lower/);
  assert.match(app, /temporalQualityTableBody/);
});

test('sensitivity export includes interval fields and worker forwards them', () => {
  assert.match(app, /IC95_SampEn_inferior/);
  assert.match(app, /cell\.ci95\?\.lower/);
  assert.match(worker, /ci95: sample\.ci95/);
});

test('source documents limits of approximate confidence intervals and time sampling', () => {
  assert.match(readme, /pares de templates sobrepostos podem ser dependentes/i);
  assert.match(readme, /lacunas acima de `3 × Δt` mediano/i);
  assert.match(readme, /não substitui uma comparação externa completa com EntropyHub/i);
});
