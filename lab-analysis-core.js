/*
 * BlazarLab privado 13.02 — núcleo de cálculo experimental.
 * Convenções de SampEn e modulação intrínseca alinhadas à documentação da V0.22.
 * Fisher–Shannon usa KDE gaussiana; MSE-WPE/CI usa WPE ponderada por variância,
 * coarse-graining por médias de blocos e CI = soma das escalas válidas.
 * Esta implementação requer validação numérica externa antes de uso em publicação.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BlazarResearchCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '13.02-core.1';
  const BAND_COUNT = 8;
  const DEFAULT_EMBEDDING = 2;
  const DEFAULT_TOLERANCE = 0.2;
  const WPE_DIMENSION = 4;
  const SCALE_COUNT = 8;

  function finiteSeries(values) {
    return Array.from(values ?? []).map(Number).filter(Number.isFinite);
  }
  function mean(values) {
    if (!values.length) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
  function populationStd(values) {
    if (!values.length) return null;
    const m = mean(values);
    return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
  }
  function sampleVariance(values) {
    if (values.length < 2) return null;
    const m = mean(values);
    return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  }
  function median(values) {
    if (!values.length) return null;
    const s = values.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function getNeighborOffsets(dimensions) {
    const offsets = [], current = Array(dimensions).fill(0);
    function build(depth) {
      if (depth === dimensions) { offsets.push(current.slice()); return; }
      for (let step = -1; step <= 1; step++) { current[depth] = step; build(depth + 1); }
    }
    build(0);
    return offsets;
  }
  function bruteForceMatches(z, dimension, radius, nTemplates) {
    let matches = 0;
    for (let i = 0; i < nTemplates; i++) {
      for (let j = i + 1; j < nTemplates; j++) {
        let match = true;
        for (let k = 0; k < dimension; k++) {
          if (Math.abs(z[i + k] - z[j + k]) > radius) { match = false; break; }
        }
        if (match) matches++;
      }
    }
    return matches;
  }
  function gridMatches(z, dimension, radius, nTemplates) {
    const offsets = getNeighborOffsets(dimension), buckets = new Map();
    let matches = 0;
    for (let i = 0; i < nTemplates; i++) {
      const cell = Array.from({ length: dimension }, (_, k) => Math.floor(z[i + k] / radius));
      for (const offset of offsets) {
        const neighborKey = cell.map((value, k) => value + offset[k]).join(',');
        const candidates = buckets.get(neighborKey);
        if (!candidates) continue;
        for (const j of candidates) {
          let match = true;
          for (let k = 0; k < dimension; k++) {
            if (Math.abs(z[i + k] - z[j + k]) > radius) { match = false; break; }
          }
          if (match) matches++;
        }
      }
      const key = cell.join(',');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }
    return matches;
  }
  function countMatches(z, dimension, radius, nTemplates) {
    if (nTemplates < 2) return 0;
    return nTemplates < 700
      ? bruteForceMatches(z, dimension, radius, nTemplates)
      : gridMatches(z, dimension, radius, nTemplates);
  }
  const T975_DF_1_TO_30 = [
    12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
    2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
    2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042
  ];
  function studentTCritical975(df) {
    if (!Number.isFinite(df) || df < 1) return null;
    if (df <= T975_DF_1_TO_30.length) return T975_DF_1_TO_30[df - 1];
    const z = 1.959963984540054, v = df;
    const z2 = z * z, z3 = z2 * z, z5 = z3 * z2, z7 = z5 * z2;
    return z + (z3 + z) / (4 * v) + (5 * z5 + 16 * z3 + 3 * z) / (96 * v * v) + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * v * v * v);
  }
  function sampleEntropyConfidenceInterval(A, B) {
    if (!Number.isFinite(A) || !Number.isFinite(B) || B < 2 || A <= 0 || A > B) {
      return { level: 0.95, method: 'Aproximação t para p=A/B (indicativa)', status: 'not_estimable', lower: null, upper: null, probability: B > 0 ? A / B : null, probabilityLower: null, probabilityUpper: null, degreesFreedom: Number.isFinite(B) ? B - 1 : null };
    }
    const probability = A / B;
    if (A === B) return { level: 0.95, method: 'Aproximação t para p=A/B (indicativa)', status: 'boundary_probability', lower: 0, upper: null, probability, probabilityLower: null, probabilityUpper: 1, degreesFreedom: B - 1 };
    const df = B - 1, tCritical = studentTCritical975(df);
    const standardError = Math.sqrt(probability * (1 - probability) / df);
    const margin = tCritical * standardError;
    const probabilityLower = Math.max(0, probability - margin), probabilityUpper = Math.min(1, probability + margin);
    return { level: 0.95, method: 'Aproximação t para p=A/B (indicativa)', status: probabilityLower === 0 ? 'open_upper' : 'ok', lower: Object.is(-Math.log(probabilityUpper), -0) ? 0 : -Math.log(probabilityUpper), upper: probabilityLower > 0 ? -Math.log(probabilityLower) : null, probability, probabilityLower, probabilityUpper, standardError, degreesFreedom: df, tCritical };
  }
  /** Richman & Moorman convention: N-m starts used for both B and A; non-ordered pairs, no self-pairs. */
  function sampleEntropy(series, m = DEFAULT_EMBEDDING, toleranceMultiplier = DEFAULT_TOLERANCE) {
    const x = finiteSeries(series), n = x.length;
    if (!Number.isInteger(m) || m < 1) throw new RangeError('m_SE deve ser um inteiro positivo.');
    if (!Number.isFinite(toleranceMultiplier) || toleranceMultiplier <= 0) throw new RangeError('r/σ deve ser positivo.');
    if (n < m + 2) return { value: null, reason: 'Poucos pontos para formar pares', sigma: null, r: null, A: 0, B: 0, n, templateCount: Math.max(0, n - m), ci95: sampleEntropyConfidenceInterval(0, 0) };
    const center = mean(x), sigma = populationStd(x);
    if (!Number.isFinite(sigma) || sigma === 0) return { value: null, reason: 'Série constante ou escala não finita', sigma, r: 0, A: 0, B: 0, n, templateCount: Math.max(0, n - m), ci95: sampleEntropyConfidenceInterval(0, 0) };
    const r = toleranceMultiplier * sigma, z = x.map(v => (v - center) / sigma), templateCount = n - m;
    const B = countMatches(z, m, toleranceMultiplier, templateCount);
    const A = countMatches(z, m + 1, toleranceMultiplier, templateCount);
    if (B === 0) return { value: null, reason: 'B = 0 (nenhum par semelhante)', sigma, r, A, B, n, templateCount, ci95: sampleEntropyConfidenceInterval(A, B) };
    if (A === 0) return { value: null, reason: 'A = 0 (nenhuma extensão semelhante)', sigma, r, A, B, n, templateCount, ci95: sampleEntropyConfidenceInterval(A, B) };
    if (A > B) return { value: null, reason: 'Inconsistência numérica: A > B', sigma, r, A, B, n, templateCount, ci95: sampleEntropyConfidenceInterval(A, B) };
    const value = -Math.log(A / B);
    return { value: Object.is(value, -0) ? 0 : value, reason: 'OK', sigma, r, A, B, n, templateCount, conditionalProbability: A / B, ci95: sampleEntropyConfidenceInterval(A, B) };
  }
  function intrinsicModulation(points, hasErrorColumn = true) {
    const all = Array.from(points ?? []).filter(p => Number.isFinite(p?.y));
    if (!hasErrorColumn) return { value: null, reason: 'Coluna de incerteza não selecionada', status: 'missing_error_column', nRate: all.length, nUsed: 0, nErrorExcluded: all.length };
    const valid = all.filter(p => Number.isFinite(p?.error) && p.error >= 0);
    const flux = valid.map(p => p.y), errors = valid.map(p => p.error), n = flux.length, avg = mean(flux);
    const base = { value: null, reason: '', status: 'unavailable', nRate: all.length, nUsed: n, nErrorExcluded: all.length - n, meanFlux: avg, observedVariance: null, noiseVariance: null, intrinsicVariance: null, rmsIntrinsic: null };
    if (n < 2) return { ...base, reason: 'Menos de dois pontos com fluxo e incerteza válidos', status: 'insufficient_paired_data' };
    const varianceObserved = sampleVariance(flux), varianceNoise = mean(errors.map(e => e * e));
    let varianceIntrinsic = varianceObserved - varianceNoise;
    const tol = 1e-12 * Math.max(Number.MIN_VALUE, Math.abs(varianceObserved), Math.abs(varianceNoise));
    if (varianceIntrinsic < 0 && Math.abs(varianceIntrinsic) <= tol) varianceIntrinsic = 0;
    const calculated = { ...base, observedVariance: varianceObserved, noiseVariance: varianceNoise, intrinsicVariance: varianceIntrinsic };
    if (!Number.isFinite(avg) || avg <= 0) return { ...calculated, reason: 'Fluxo médio não positivo; o índice percentual não é definido', status: 'nonpositive_mean' };
    if (![varianceObserved, varianceNoise, varianceIntrinsic].every(Number.isFinite)) return { ...calculated, reason: 'Variância não finita', status: 'nonfinite_variance' };
    if (varianceIntrinsic < 0) return { ...calculated, reason: 'Variância intrínseca corrigida pelo ruído negativa', status: 'negative_intrinsic_variance' };
    const rmsIntrinsic = Math.sqrt(varianceIntrinsic), value = 100 * rmsIntrinsic / avg;
    const partial = all.length !== valid.length;
    return { ...calculated, value, rmsIntrinsic, reason: partial ? 'Calculado com subconjunto: algumas incertezas faltam ou são inválidas' : (varianceIntrinsic === 0 ? 'Variância intrínseca estimada igual a zero' : 'OK'), status: partial ? 'partial_uncertainties' : (varianceIntrinsic === 0 ? 'zero_intrinsic_variance' : 'OK') };
  }
  function timeSeriesDiagnostics(times, gapFactor = 3) {
    const finite = Array.from(times ?? []).map(Number).filter(Number.isFinite);
    let orderReversals = 0;
    for (let i = 1; i < finite.length; i++) if (finite[i] < finite[i - 1]) orderReversals++;
    const sorted = finite.slice().sort((a, b) => a - b), unique = [];
    let duplicateCount = 0;
    for (const v of sorted) { if (unique.length && v === unique[unique.length - 1]) duplicateCount++; else unique.push(v); }
    const intervals = [];
    for (let i = 1; i < unique.length; i++) { const delta = unique[i] - unique[i - 1]; if (delta > 0 && Number.isFinite(delta)) intervals.push(delta); }
    const cadence = median(intervals), gaps = Number.isFinite(cadence) ? intervals.filter(d => d > gapFactor * cadence) : [];
    const avg = mean(intervals), sd = populationStd(intervals);
    return { nInput: finite.length, nUniqueTimes: unique.length, duplicateCount, orderReversals, intervalCount: intervals.length, medianCadence: cadence, meanCadence: avg, cadenceCv: avg > 0 && sd != null ? sd / avg : null, gapFactor, gapThreshold: Number.isFinite(cadence) ? gapFactor * cadence : null, gapCount: gaps.length, maxGap: intervals.length ? Math.max(...intervals) : null, maxGapRatio: Number.isFinite(cadence) && cadence > 0 && intervals.length ? Math.max(...intervals) / cadence : null };
  }
  function fisherShannonKDE(series) {
    const x = finiteSeries(series), n = x.length, sd = populationStd(x);
    if (n < 8 || !Number.isFinite(sd) || sd <= 0) return { H: null, fisher: null, entropyPower: null, product: null, bandwidth: null, status: 'insufficient_or_constant' };
    const sorted = x.slice().sort((a, b) => a - b), q1 = sorted[Math.floor((n - 1) * 0.25)], q3 = sorted[Math.floor((n - 1) * 0.75)], iqr = q3 - q1;
    const robustSd = iqr > 0 ? Math.min(sd, iqr / 1.349) : sd;
    const bandwidth = Math.max(Number.EPSILON * Math.max(1, Math.abs(sorted[0]), Math.abs(sorted[n - 1])), 0.9 * robustSd * Math.pow(n, -0.2));
    const minX = sorted[0] - 3.5 * bandwidth, maxX = sorted[n - 1] + 3.5 * bandwidth, count = 241, step = (maxX - minX) / (count - 1);
    const density = new Array(count).fill(0), derivative = new Array(count).fill(0), invSqrt2Pi = 1 / Math.sqrt(2 * Math.PI);
    for (let i = 0; i < count; i++) {
      const px = minX + i * step; let f = 0, df = 0;
      for (const sample of x) { const z = (px - sample) / bandwidth, kernel = invSqrt2Pi * Math.exp(-0.5 * z * z); f += kernel / bandwidth; df += -z * kernel / (bandwidth * bandwidth); }
      density[i] = f / n; derivative[i] = df / n;
    }
    let integral = 0;
    for (let i = 0; i < count - 1; i++) integral += (density[i] + density[i + 1]) * step / 2;
    if (!Number.isFinite(integral) || integral <= 0) return { H: null, fisher: null, entropyPower: null, product: null, bandwidth, status: 'density_not_estimable' };
    for (let i = 0; i < count; i++) { density[i] /= integral; derivative[i] /= integral; }
    let H = 0, fisher = 0;
    for (let i = 0; i < count - 1; i++) {
      const f0 = Math.max(density[i], 1e-14), f1 = Math.max(density[i + 1], 1e-14), d0 = derivative[i], d1 = derivative[i + 1];
      H += (-f0 * Math.log(f0) - f1 * Math.log(f1)) * step / 2;
      fisher += (d0 * d0 / f0 + d1 * d1 / f1) * step / 2;
    }
    const entropyPower = Math.exp(2 * H) / (2 * Math.PI * Math.E), product = entropyPower * fisher;
    return { H, fisher, entropyPower, product, bandwidth, gridPoints: count, status: Number.isFinite(product) ? 'ok' : 'nonfinite' };
  }
  function ordinalPattern(values) {
    return values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value || a.index - b.index).map(p => p.index).join('');
  }
  function weightedPermutationEntropy(series, dimension = WPE_DIMENSION, delay = 1) {
    const patternWeights = new Map(), totalLength = series.length - (dimension - 1) * delay;
    if (totalLength <= 0) return { value: null, count: 0, distinctPatterns: 0, status: 'insufficient' };
    let totalWeight = 0;
    for (let i = 0; i < totalLength; i++) {
      const vector = [];
      for (let k = 0; k < dimension; k++) vector.push(series[i + k * delay]);
      const localMean = mean(vector), weight = vector.reduce((sum, v) => sum + (v - localMean) ** 2, 0) / dimension;
      const key = ordinalPattern(vector); patternWeights.set(key, (patternWeights.get(key) || 0) + weight); totalWeight += weight;
    }
    if (totalWeight <= Number.EPSILON) return { value: null, count: totalLength, distinctPatterns: 0, status: 'zero-weight' };
    let entropy = 0;
    for (const weight of patternWeights.values()) { const p = weight / totalWeight; if (p > 0) entropy -= p * Math.log(p); }
    return { value: entropy, count: totalLength, distinctPatterns: patternWeights.size, status: 'ok' };
  }
  function coarseGrain(series, scale) {
    const count = Math.floor(series.length / scale), result = [];
    for (let j = 0; j < count; j++) { let sum = 0; for (let k = 0; k < scale; k++) sum += series[j * scale + k]; result.push(sum / scale); }
    return result;
  }
  function calculateMSE(series, scales = SCALE_COUNT, dimension = WPE_DIMENSION) {
    const points = [];
    for (let scale = 1; scale <= scales; scale++) {
      const coarse = coarseGrain(series, scale), wpe = weightedPermutationEntropy(coarse, dimension, 1), value = Number.isFinite(wpe.value) ? wpe.value : null;
      points.push({ scale, value, n: coarse.length, patterns: wpe.distinctPatterns || 0, status: Number.isFinite(value) ? 'ok' : (wpe.status || 'undefined') });
    }
    const validScales = points.filter(p => Number.isFinite(p.value)).length, CI = validScales === scales ? points.reduce((sum, p) => sum + p.value, 0) : null;
    let factorial = 1; for (let i = 2; i <= dimension; i++) factorial *= i;
    return { points, CI, validScales, status: validScales === scales ? 'ok' : 'incomplete', maxPerScale: Math.log(factorial), maxCI: scales * Math.log(factorial), dimension, scales };
  }
  function analyzeBand(points, options = {}) {
    const raw = Array.from(points ?? []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    // Diagnostica a ordem original antes de ordenar para as métricas temporais.
    const timeDiagnostics = timeSeriesDiagnostics(raw.map(p => p.x));
    const sorted = raw.slice().sort((a, b) => a.x - b.x);
    const values = sorted.map(p => p.y);
    const sampen = sampleEntropy(values, options.m ?? DEFAULT_EMBEDDING, options.rFactor ?? DEFAULT_TOLERANCE);
    const modulation = intrinsicModulation(sorted, options.hasErrorColumn !== false);
    const fisherShannon = fisherShannonKDE(values);
    const mseWpe = calculateMSE(values, options.scales ?? SCALE_COUNT, options.wpeDimension ?? WPE_DIMENSION);
    return { n: values.length, sampen, modulation, fisherShannon, mseWpe, timeDiagnostics, seriesLength: values.length };
  }
  return { VERSION, BAND_COUNT, DEFAULT_EMBEDDING, DEFAULT_TOLERANCE, WPE_DIMENSION, SCALE_COUNT, mean, populationStd, sampleEntropy, sampleEntropyConfidenceInterval, intrinsicModulation, timeSeriesDiagnostics, fisherShannonKDE, weightedPermutationEntropy, calculateMSE, analyzeBand };
});
