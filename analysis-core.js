/*
 * Multiband Entropy Lab — núcleo científico testável.
 * SampEn segue H_SE = -ln(A/B), distância de Chebyshev e exclusão de auto-pares.
 * O índice de modulação usa a definição intrínseca do artigo de referência.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EntropyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.6.0';

  function finiteSeries(values) {
    return Array.from(values ?? []).filter(Number.isFinite).map(Number);
  }

  function mean(values) {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function populationStd(values) {
    if (!values.length) return null;
    const center = mean(values);
    return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / values.length);
  }

  function getNeighborOffsets(dimensions) {
    const offsets = [];
    const current = Array(dimensions).fill(0);
    function build(depth) {
      if (depth === dimensions) {
        offsets.push(current.slice());
        return;
      }
      for (let step = -1; step <= 1; step++) {
        current[depth] = step;
        build(depth + 1);
      }
    }
    build(0);
    return offsets;
  }

  function createPairSampler(limit, seed) {
    return limit > 0 ? { limit, pairs: [], seen: 0, seed: seed >>> 0 } : null;
  }

  // Deterministic reservoir sampling keeps a representative, bounded set of
  // real matches for visualization without storing every pair in dense series.
  function rememberPair(sampler, i, j) {
    if (!sampler) return;
    sampler.seen++;
    if (sampler.pairs.length < sampler.limit) {
      sampler.pairs.push([i, j]);
      return;
    }
    sampler.seed = (Math.imul(sampler.seed, 1664525) + 1013904223) >>> 0;
    const slot = Math.floor((sampler.seed / 4294967296) * sampler.seen);
    if (slot < sampler.limit) sampler.pairs[slot] = [i, j];
  }

  function bruteForceMatches(z, dimension, radius, sampler = null, requestedTemplateCount = null) {
    const availableTemplates = z.length - dimension + 1;
    const nTemplates = requestedTemplateCount == null ? availableTemplates : Math.max(0, Math.min(availableTemplates, requestedTemplateCount));
    let matches = 0;
    for (let i = 0; i < nTemplates; i++) {
      for (let j = i + 1; j < nTemplates; j++) {
        let match = true;
        for (let k = 0; k < dimension; k++) {
          if (Math.abs(z[i + k] - z[j + k]) > radius) {
            match = false;
            break;
          }
        }
        if (match) { matches++; rememberPair(sampler, i, j); }
      }
    }
    return matches;
  }

  // Uniform-grid search counts all pairs for a fixed embedding dimension. B
  // and A are counted separately for dimensions m and m+1, matching the
  // project's reference Python/cKDTree routine. Equivalence to EntropyHub v2.0
  // still requires a direct numerical comparison on identical series.
  function gridMatches(z, dimension, radius, sampler = null, requestedTemplateCount = null) {
    const availableTemplates = z.length - dimension + 1;
    const nTemplates = requestedTemplateCount == null ? availableTemplates : Math.max(0, Math.min(availableTemplates, requestedTemplateCount));
    const offsets = getNeighborOffsets(dimension);
    const buckets = new Map();
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
            if (Math.abs(z[i + k] - z[j + k]) > radius) {
              match = false;
              break;
            }
          }
          if (match) { matches++; rememberPair(sampler, j, i); }
        }
      }
      const key = cell.join(',');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }
    return matches;
  }

  function countMatches(z, dimension, radius, sampler = null, requestedTemplateCount = null) {
    const availableTemplates = z.length - dimension + 1;
    const nTemplates = requestedTemplateCount == null ? availableTemplates : Math.max(0, Math.min(availableTemplates, requestedTemplateCount));
    if (nTemplates < 2) return 0;
    return nTemplates < 700
      ? bruteForceMatches(z, dimension, radius, sampler, nTemplates)
      : gridMatches(z, dimension, radius, sampler, nTemplates);
  }

  // Two-sided 95% Student-t critical value. Values through 30 d.f. use a
  // reference table; larger d.f. use a Cornish-Fisher expansion near the normal
  // quantile. This follows the approximate t interval described by Richman &
  // Moorman (2000), rather than presenting a Wilson interval as if it were theirs.
  const T975_DF_1_TO_30 = [
    12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
    2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
    2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042
  ];
  function studentTCritical975(df) {
    if (!Number.isFinite(df) || df < 1) return null;
    if (df <= T975_DF_1_TO_30.length) return T975_DF_1_TO_30[df - 1];
    const z = 1.959963984540054;
    const v = df, z2 = z*z, z3 = z2*z, z5 = z3*z2, z7 = z5*z2;
    return z + (z3 + z)/(4*v) + (5*z5 + 16*z3 + 3*z)/(96*v*v) + (3*z7 + 19*z5 + 17*z3 - 15*z)/(384*v*v*v);
  }

  /**
   * Approximate 95% confidence interval for SampEn, based on the t interval for
   * the binary conditional-match probability p=A/B described in Richman &
   * Moorman (2000). The Bernoulli sample SD is sqrt(B/(B-1)*p*(1-p)); its SE
   * is therefore sqrt(p*(1-p)/(B-1)). Transform the probability interval by
   * -ln(p). Overlapping templates/pairs are dependent, so this is an approximate
   * indicator of uncertainty, not a guarantee of nominal coverage for all series.
   */
  function sampleEntropyConfidenceInterval(A, B) {
    if (!Number.isFinite(A) || !Number.isFinite(B) || B < 2 || A <= 0 || A > B) {
      return { level: 0.95, method: 'Richman-Moorman t approximation for p=A/B', status: 'not_estimable', lower: null, upper: null, probability: B > 0 ? A / B : null, probabilityLower: null, probabilityUpper: null, degreesFreedom: Number.isFinite(B) ? B - 1 : null };
    }
    const probability = A / B;
    if (A === B) {
      return { level: 0.95, method: 'Richman-Moorman t approximation for p=A/B', status: 'boundary_probability', lower: 0, upper: null, probability, probabilityLower: null, probabilityUpper: 1, degreesFreedom: B - 1, note: 'A=B: o intervalo t degeneraria em largura zero e não é informativo no limite.' };
    }
    const df = B - 1;
    const tCritical = studentTCritical975(df);
    const standardError = Math.sqrt(probability * (1 - probability) / df);
    const margin = tCritical * standardError;
    const probabilityLower = Math.max(0, probability - margin);
    const probabilityUpper = Math.min(1, probability + margin);
    return {
      level: 0.95, method: 'Richman-Moorman t approximation for p=A/B', status: probabilityLower === 0 ? 'open_upper' : 'ok',
      lower: Object.is(-Math.log(probabilityUpper), -0) ? 0 : -Math.log(probabilityUpper), upper: probabilityLower > 0 ? -Math.log(probabilityLower) : null,
      probability, probabilityLower, probabilityUpper, standardError, degreesFreedom: df, tCritical,
      note: probabilityLower === 0 ? 'O limite inferior de p alcança zero; o limite superior transformado de SampEn não é finito.' : ''
    };
  }

  /**
   * Descriptive diagnostics for timestamps. Does not reorder or remove the user's
   * actual series; it reports order reversals, duplicate times, median positive
   * cadence, cadence CV and heuristic gaps (> gapFactor × median cadence).
   */
  function timeSeriesDiagnostics(times, options = {}) {
    const gapFactor = Number.isFinite(options.gapFactor) && options.gapFactor > 1 ? options.gapFactor : 3;
    const input = Array.from(times ?? []);
    const finite = input.map(value => (typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN))).filter(Number.isFinite);
    let orderReversals = 0;
    for (let i = 1; i < finite.length; i++) if (finite[i] < finite[i - 1]) orderReversals++;
    const sorted = finite.slice().sort((a, b) => a - b);
    const unique = [];
    let duplicateCount = 0;
    for (const value of sorted) {
      if (unique.length && value === unique[unique.length - 1]) duplicateCount++;
      else unique.push(value);
    }
    const intervals = [];
    for (let i = 1; i < unique.length; i++) {
      const delta = unique[i] - unique[i - 1];
      if (delta > 0 && Number.isFinite(delta)) intervals.push(delta);
    }
    intervals.sort((a, b) => a - b);
    const median = intervals.length ? (intervals.length % 2 ? intervals[(intervals.length - 1) / 2] : (intervals[intervals.length / 2 - 1] + intervals[intervals.length / 2]) / 2) : null;
    const average = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : null;
    const sd = intervals.length ? Math.sqrt(intervals.reduce((sum, value) => sum + (value - average) ** 2, 0) / intervals.length) : null;
    const gapLimit = Number.isFinite(median) ? median * gapFactor : null;
    const gaps = Number.isFinite(gapLimit) ? intervals.filter(delta => delta > gapLimit) : [];
    return { nInput: input.length, nFinite: finite.length, nUniqueTimes: unique.length, duplicateCount, orderReversals, intervalCount: intervals.length, medianCadence: median, meanCadence: average, cadenceCv: average > 0 && sd != null ? sd / average : null, gapFactor, gapThreshold: gapLimit, gapCount: gaps.length, maxGap: intervals.length ? intervals[intervals.length - 1] : null, maxGapRatio: Number.isFinite(median) && median > 0 && intervals.length ? intervals[intervals.length - 1] / median : null };
  }

  /**
   * Sample Entropy H_SE = -ln(A/B), using the Richman & Moorman (2000)
   * convention: the same N-m template start positions are used for dimensions
   * m and m+1. This makes every A match a subset of B and guarantees A <= B.
   * r = toleranceMultiplier * population SD(series); this SD convention is
   * explicitly recorded because library defaults can differ. Auto-pairs are
   * excluded, each unordered pair is counted once, and equality at r is included.
   */
  function sampleEntropy(series, m = 2, toleranceMultiplier = 0.2, options = {}) {
    const x = finiteSeries(series);
    const requestedPairLimit = Number.isInteger(options?.maxMatchPairs) ? options.maxMatchPairs : 0;
    const pairLimit = Math.max(0, Math.min(100, requestedPairLimit));
    const emptyMatchPairs = pairLimit > 0 ? { m: [], mPlus1: [], maxStoredPerDimension: pairLimit } : undefined;
    if (!Number.isInteger(m) || m < 1) throw new RangeError('A dimensão m deve ser um inteiro positivo.');
    if (!Number.isFinite(toleranceMultiplier) || toleranceMultiplier <= 0) throw new RangeError('A tolerância deve ser maior que zero.');

    const n = x.length;
    if (n < m + 2) {
      return { value: null, reason: 'Poucos pontos para formar pares', sigma: null, r: null, A: 0, B: 0, n, templateCount: Math.max(0, n - m), ci95: sampleEntropyConfidenceInterval(0, 0), ...(emptyMatchPairs ? { matchPairs: emptyMatchPairs } : {}) };
    }
    const center = mean(x);
    const sigma = populationStd(x);
    if (sigma === 0) {
      return { value: null, reason: 'Série constante (σ = 0)', sigma, r: 0, A: 0, B: 0, n, templateCount: Math.max(0, n - m), ci95: sampleEntropyConfidenceInterval(0, 0), ...(emptyMatchPairs ? { matchPairs: emptyMatchPairs } : {}) };
    }
    if (!Number.isFinite(sigma) || !Number.isFinite(center)) {
      return { value: null, reason: 'Escala numérica não finita', sigma, r: null, A: 0, B: 0, n, templateCount: Math.max(0, n - m), ci95: sampleEntropyConfidenceInterval(0, 0), ...(emptyMatchPairs ? { matchPairs: emptyMatchPairs } : {}) };
    }
    const r = toleranceMultiplier * sigma;
    const radius = toleranceMultiplier;
    const z = x.map(value => (value - center) / sigma);
    const mSampler = createPairSampler(pairLimit, 0x13579bdf);
    const mPlus1Sampler = createPairSampler(pairLimit, 0x2468ace0);

    // Richman & Moorman use the first N-m templates for both dimensions so
    // that m and m+1 comparisons have identical start positions. This differs
    // from a common alternative that counts N-m+1 templates for B.
    const templateCount = n - m;
    // Visual pair sampling is bounded and never changes scientific A/B counts.
    const B = countMatches(z, m, radius, mSampler, templateCount);
    const A = countMatches(z, m + 1, radius, mPlus1Sampler, templateCount);
    const matchPairs = pairLimit > 0
      ? { m: mSampler.pairs, mPlus1: mPlus1Sampler.pairs, maxStoredPerDimension: pairLimit }
      : undefined;
    if (B === 0) return { value: null, reason: 'B = 0 (nenhum par semelhante)', sigma, r, A, B, n, templateCount, ci95: sampleEntropyConfidenceInterval(A, B), ...(matchPairs ? { matchPairs } : {}) };
    if (A === 0) return { value: null, reason: 'A = 0 (nenhuma extensão semelhante)', sigma, r, A, B, n, templateCount, ci95: sampleEntropyConfidenceInterval(A, B), ...(matchPairs ? { matchPairs } : {}) };
    const estimate = -Math.log(A / B);
    return { value: Object.is(estimate, -0) ? 0 : estimate, reason: 'OK', sigma, r, A, B, n, templateCount, conditionalProbability: A / B, ci95: sampleEntropyConfidenceInterval(A, B), ...(matchPairs ? { matchPairs } : {}) };
  }

  /**
   * Intrinsic modulation index, in percent:
   * m = 100 * sqrt(S^2 - mean(error^2)) / mean(flux).
   * S^2 uses sample variance (N-1), matching the user's reference script;
   * the source article gives the formula but does not specify this divisor.
   * Only observations with finite flux and finite non-negative uncertainties
   * enter this estimate. Mean flux is not replaced by its absolute value.
   */
  function intrinsicModulation(points, hasErrorColumn = true) {
    const all = Array.from(points ?? []).filter(p => Number.isFinite(p?.y));
    if (!hasErrorColumn) {
      return {
        value: null, reason: 'Coluna de incerteza não selecionada', status: 'missing_error_column',
        nRate: all.length, nUsed: 0, nErrorExcluded: all.length, meanFlux: mean(all.map(p => p.y)),
        observedVariance: null, noiseVariance: null, intrinsicVariance: null, rmsIntrinsic: null
      };
    }
    const valid = all.filter(p => Number.isFinite(p?.error) && p.error >= 0);
    const nErrorExcluded = all.length - valid.length;
    const flux = valid.map(p => p.y);
    const errors = valid.map(p => p.error);
    const n = flux.length;
    const avg = mean(flux);
    const base = {
      value: null, reason: '', status: 'unavailable', nRate: all.length, nUsed: n,
      nErrorExcluded, meanFlux: avg, observedVariance: null, noiseVariance: null,
      intrinsicVariance: null, rmsIntrinsic: null
    };
    if (n < 2) {
      return { ...base, reason: 'Menos de 2 pontos com fluxo e incerteza válidos', status: 'insufficient_paired_data' };
    }
    const varianceObserved = flux.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (n - 1);
    const varianceNoise = mean(errors.map(error => error ** 2));
    let varianceIntrinsic = varianceObserved - varianceNoise;
    const varianceScale = Math.max(Number.MIN_VALUE, Math.abs(varianceObserved), Math.abs(varianceNoise));
    const numericalTolerance = 1e-12 * varianceScale;
    if (varianceIntrinsic < 0 && Math.abs(varianceIntrinsic) <= numericalTolerance) varianceIntrinsic = 0;
    const calculated = { ...base, observedVariance: varianceObserved, noiseVariance: varianceNoise, intrinsicVariance: varianceIntrinsic };

    if (!Number.isFinite(avg) || avg <= 0) {
      return { ...calculated, reason: 'Fluxo médio não positivo; a fórmula do artigo não define um índice percentual válido', status: 'nonpositive_mean' };
    }
    if (![varianceObserved, varianceNoise, varianceIntrinsic].every(Number.isFinite)) {
      return { ...calculated, reason: 'Variância observada/corrigida não finita', status: 'nonfinite_variance' };
    }
    if (varianceIntrinsic < 0) {
      return { ...calculated, reason: 'Variância corrigida pelo ruído negativa', status: 'negative_intrinsic_variance' };
    }
    const rmsIntrinsic = Math.sqrt(varianceIntrinsic);
    const value = 100 * rmsIntrinsic / avg;
    if (!Number.isFinite(value)) {
      return { ...calculated, rmsIntrinsic, reason: 'O índice percentual não é finito para esta média de fluxo', status: 'nonfinite_result' };
    }
    const partial = nErrorExcluded > 0;
    return {
      ...calculated, value, rmsIntrinsic,
      reason: partial ? 'Calculado com subconjunto: algumas incertezas faltam ou são inválidas' : (varianceIntrinsic === 0 ? 'Variância intrínseca estimada igual a zero' : 'OK'),
      status: partial ? 'partial_uncertainties' : (varianceIntrinsic === 0 ? 'zero_intrinsic_variance' : 'OK')
    };
  }

  return { VERSION, mean, populationStd, sampleEntropy, sampleEntropyConfidenceInterval, timeSeriesDiagnostics, intrinsicModulation };
});
