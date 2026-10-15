'use strict';

/**
 * Deliberately simple, independent O(N^2) reference implementation.
 *
 * Convention used for comparison with the candidate core:
 * - discard non-finite values;
 * - standardize by the population standard deviation;
 * - use exactly N-m template start positions for both dimensions m and m+1;
 * - compare with Chebyshev distance, accepting distance <= tolerance multiplier;
 * - count unordered pairs i<j only (no self matches);
 * - SampEn = -ln(A/B), undefined when B=0 or A=0.
 *
 * This is a transparent reference for the selected convention, not a claim that
 * every SampEn software package adopts the same finite-N convention.
 */
function mean(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}
function populationStd(values) {
  if (!values.length) return null;
  const mu = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - mu) ** 2, 0) / values.length);
}
function countPairs(z, dimension, radius, templateCount) {
  let total = 0;
  for (let i = 0; i < templateCount; i++) {
    for (let j = i + 1; j < templateCount; j++) {
      let within = true;
      for (let k = 0; k < dimension; k++) {
        if (Math.abs(z[i + k] - z[j + k]) > radius) {
          within = false;
          break;
        }
      }
      if (within) total++;
    }
  }
  return total;
}
function sampleEntropyReference(input, m = 2, toleranceMultiplier = 0.2) {
  if (!Number.isInteger(m) || m < 1) throw new RangeError('m must be a positive integer');
  if (!Number.isFinite(toleranceMultiplier) || toleranceMultiplier <= 0) throw new RangeError('tolerance must be > 0');
  const x = Array.from(input ?? []).filter(Number.isFinite).map(Number);
  const n = x.length;
  const empty = { value: null, A: 0, B: 0, n, templateCount: Math.max(0, n - m), sigma: null, reason: '' };
  if (n < m + 2) return { ...empty, reason: 'too_short' };
  const mu = mean(x);
  const sigma = populationStd(x);
  if (!(sigma > 0) || !Number.isFinite(sigma)) return { ...empty, sigma, reason: 'constant_or_invalid_scale' };
  const z = x.map(v => (v - mu) / sigma);
  const radius = toleranceMultiplier;
  const templateCount = n - m;
  const B = countPairs(z, m, radius, templateCount);
  const A = countPairs(z, m + 1, radius, templateCount);
  const value = A > 0 && B > 0 ? -Math.log(A / B) : null;
  const reason = B === 0 ? 'B_zero' : A === 0 ? 'A_zero' : 'ok';
  return { value, A, B, n, templateCount, sigma, radius: toleranceMultiplier * sigma, reason };
}
module.exports = { mean, populationStd, countPairs, sampleEntropyReference };
