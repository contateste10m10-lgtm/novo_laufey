# Baseline under test

- Project version: Multiband Entropy Lab V0.22 — SampEn methodology
- Candidate file: `candidate/analysis-core.js`
- Candidate API under test: `EntropyCore.sampleEntropy`, `EntropyCore.sampleEntropyConfidenceInterval`, `EntropyCore.timeSeriesDiagnostics`
- Reference: `reference/sampen-reference.js`, implemented independently by direct O(N²) pair enumeration.
- Article basis: Joshua S. Richman & J. Randall Moorman (2000), *Physiological time-series analysis using approximate entropy and sample entropy*, American Journal of Physiology — Heart and Circulatory Physiology, 278, H2039–H2049.
- Chosen convention: population-SD scaling; Chebyshev distance; inclusive threshold; no self-pairs; each unordered pair counted once; same `N-m` template starts for both dimensions; undefined result when A or B is zero.

This package is separate from the production website. It is intended to be run against a candidate core before integrating changes. For an actual EntropyHub comparison, first match the library's `m`, `r`, distance metric, standard-deviation convention, and finite-N/template-count convention rather than comparing default outputs blindly.
