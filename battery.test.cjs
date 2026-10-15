'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../candidate/analysis-core.js');
const Ref = require('../reference/sampen-reference.js');
const fs = require('node:fs');
const fixtures = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../fixtures/golden-counts.json'), 'utf8'));

function seededUniform(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function seededNormal(seed) {
  const uniform = seededUniform(seed);
  return () => {
    const u1 = Math.max(Number.MIN_VALUE, uniform());
    const u2 = uniform();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
}
function close(a, b, tolerance = 1e-12) {
  assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b} (tol ${tolerance})`);
}

test('golden hand-check: [0,0,1,1,0,0], m=1, r=0.2 gives A=1, B=4 and ln(4)', () => {
  const x = [0, 0, 1, 1, 0, 0];
  const actual = Core.sampleEntropy(x, 1, 0.2);
  const ref = Ref.sampleEntropyReference(x, 1, 0.2);
  assert.equal(actual.templateCount, 5);
  assert.equal(actual.A, 1);
  assert.equal(actual.B, 4);
  close(actual.value, Math.log(4));
  assert.deepEqual({ A: actual.A, B: actual.B }, { A: ref.A, B: ref.B });
});

test('all stored golden fixtures match the candidate implementation', () => {
  for (const fixture of fixtures) {
    const result = Core.sampleEntropy(fixture.series, fixture.m, fixture.toleranceMultiplier);
    assert.equal(result.n, fixture.N, fixture.name);
    assert.equal(result.templateCount, fixture.templateCount, fixture.name);
    assert.equal(result.A, fixture.A, fixture.name);
    assert.equal(result.B, fixture.B, fixture.name);
    assert.equal(result.reason, fixture.reason, fixture.name);
    if (fixture.sampen == null) assert.equal(result.value, null, fixture.name);
    else close(result.value, fixture.sampen, 1e-12);
  }
});

test('optimized core agrees with independent brute force around the algorithm-switch boundary', () => {
  for (const n of [6, 9, 24, 99, 699, 701, 702, 703, 850, 1000]) {
    for (const m of [1, 2, 3]) {
      if (n < m + 2) continue;
      const random = seededNormal(n * 101 + m * 37);
      const x = Array.from({ length: n }, random);
      const actual = Core.sampleEntropy(x, m, 0.2);
      const ref = Ref.sampleEntropyReference(x, m, 0.2);
      assert.equal(actual.A, ref.A, `A mismatch at N=${n}, m=${m}`);
      assert.equal(actual.B, ref.B, `B mismatch at N=${n}, m=${m}`);
      assert.equal(actual.templateCount, n - m);
      if (ref.value == null) assert.equal(actual.value, null);
      else close(actual.value, ref.value, 1e-12);
    }
  }
});

test('inclusive tolerance boundary counts exact-distance matches (distance <= r)', () => {
  // Alternating zeros and ones have population SD=0.5 and normalized values ±1.
  // With tolerance multiplier 2, every Chebyshev distance is <= the threshold,
  // including pairs exactly on the boundary. K=N-m=6; choose(6,2)=15 pairs.
  const result = Core.sampleEntropy([0, 1, 0, 1, 0, 1, 0, 1], 2, 2);
  assert.equal(result.templateCount, 6);
  assert.equal(result.B, 15);
  assert.equal(result.A, 15);
  assert.equal(result.value, 0);
});

test('all m+1 matches are a subset of m matches, SampEn is -ln(A/B), and self-pairs are excluded', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const random = seededUniform(seed * 99991);
    const x = Array.from({ length: 60 }, random);
    const result = Core.sampleEntropy(x, 2, 0.3);
    assert.ok(result.A <= result.B);
    if (result.A > 0 && result.B > 0) close(result.value, -Math.log(result.A / result.B));
    assert.equal(result.templateCount, x.length - 2);
    assert.ok(result.B <= result.templateCount * (result.templateCount - 1) / 2);
  }
});

test('constant, too-short and no-match cases are reported as undefined instead of false zero', () => {
  assert.equal(Core.sampleEntropy([2, 2, 2, 2, 2], 2, 0.2).value, null);
  assert.equal(Core.sampleEntropy([1, 2, 3], 2, 0.2).value, null);
  const noMatch = Core.sampleEntropy([0, 1, 4, 9, 16, 25, 36, 49], 2, 0.001);
  assert.equal(noMatch.value, null);
  assert.ok(['A = 0 (nenhuma extensão semelhante)', 'B = 0 (nenhum par semelhante)'].includes(noMatch.reason));
});

test('non-finite observations are counted explicitly by the chosen finite-value policy', () => {
  const cleaned = Core.sampleEntropy([0, 1, NaN, 2, Infinity, 3, 4, 5], 2, 0.2);
  const ref = Ref.sampleEntropyReference([0, 1, NaN, 2, Infinity, 3, 4, 5], 2, 0.2);
  assert.equal(cleaned.n, 6);
  assert.equal(cleaned.A, ref.A);
  assert.equal(cleaned.B, ref.B);
});

test('population-SD scaling is invariant to positive affine rescaling', () => {
  const x = Array.from({ length: 90 }, (_, i) => Math.sin(i * 0.31) + 0.3 * Math.cos(i * 0.07));
  const scaled = x.map(v => 13.7 * v + 82.1);
  const a = Core.sampleEntropy(x, 2, 0.2);
  const b = Core.sampleEntropy(scaled, 2, 0.2);
  assert.equal(a.A, b.A);
  assert.equal(a.B, b.B);
  if (a.value != null) close(a.value, b.value, 1e-10);
});

test('approximate confidence interval is monotone-transformed and flags non-estimable boundary cases', () => {
  const ci = Core.sampleEntropyConfidenceInterval(10, 100);
  assert.equal(ci.level, 0.95);
  assert.ok(ci.lower != null && Number.isFinite(ci.lower));
  assert.ok(ci.upper == null || ci.upper >= ci.lower);
  assert.equal(Core.sampleEntropyConfidenceInterval(0, 100).status, 'not_estimable');
  assert.equal(Core.sampleEntropyConfidenceInterval(100, 100).status, 'boundary_probability');
});

test('uniform-iid Monte Carlo agrees with the analytical conditional-probability benchmark', () => {
  const n = 600;
  const repetitions = 20;
  const values = [];
  for (let rep = 0; rep < repetitions; rep++) {
    const random = seededUniform(0x51a7 + rep * 7919);
    const x = Array.from({ length: n }, random);
    const result = Core.sampleEntropy(x, 2, 0.2);
    assert.ok(Number.isFinite(result.value), `undefined SampEn in uniform trial ${rep}`);
    values.push(result.value);
  }
  // For iid U(0,1), P(|X-Y| <= delta)=2 delta-delta^2, delta=r*SD(U)=0.2/sqrt(12).
  const delta = 0.2 / Math.sqrt(12);
  const p = 2 * delta - delta * delta;
  const theoretical = -Math.log(p);
  const observed = values.reduce((s, v) => s + v, 0) / values.length;
  assert.ok(Math.abs(observed - theoretical) < 0.10, `Monte Carlo mean ${observed}; theoretical ${theoretical}`);
});

test('periodic signal is more repeatable than seeded white noise for the chosen parameter case', () => {
  const n = 900;
  const periodic = Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * i / 30));
  const random = seededNormal(20261015);
  const noise = Array.from({ length: n }, random);
  const hPeriodic = Core.sampleEntropy(periodic, 2, 0.2).value;
  const hNoise = Core.sampleEntropy(noise, 2, 0.2).value;
  assert.ok(Number.isFinite(hPeriodic) && Number.isFinite(hNoise));
  assert.ok(hPeriodic < hNoise, `periodic=${hPeriodic}, noise=${hNoise}`);
});

test('time diagnostics identify duplicate timestamps and cadence gaps without changing the series', () => {
  const times = [1, 2, 3, 3, 4, 20, 5];
  const copy = times.slice();
  const d = Core.timeSeriesDiagnostics(times);
  assert.equal(d.duplicateCount, 1);
  assert.equal(d.orderReversals, 1);
  assert.ok(d.gapCount >= 1);
  assert.deepEqual(times, copy);
});
