'use strict';
const Core = require('../candidate/analysis-core.js');
function seededUniform(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
const n = 600;
const repetitions = 20;
const values = [];
for (let rep = 0; rep < repetitions; rep++) {
  const random = seededUniform(0x51a7 + rep * 7919);
  const x = Array.from({ length: n }, random);
  const result = Core.sampleEntropy(x, 2, 0.2);
  values.push(result.value);
}
const delta = 0.2 / Math.sqrt(12);
const probability = 2 * delta - delta * delta;
const expected = -Math.log(probability);
const observed = values.reduce((s, v) => s + v, 0) / values.length;
const absError = Math.abs(observed - expected);
console.log(JSON.stringify({ benchmark: 'iid uniform U(0,1)', N: n, m: 2, toleranceMultiplier: 0.2, repetitions, analyticalProbability: probability, theoreticalSampEn: expected, observedMeanSampEn: observed, absoluteDifference: absError, acceptanceThreshold: 0.1, pass: absError < 0.1 }, null, 2));
if (!(absError < 0.1)) process.exitCode = 1;
