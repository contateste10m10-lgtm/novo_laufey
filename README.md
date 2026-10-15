# SampEn Validation Battery v1.0

A validation harness kept separate from the Multiband Entropy Lab website. It is intended to test a candidate Sample Entropy implementation before changing the production site.

## Why this is separate

The candidate implementation is copied into `candidate/analysis-core.js`. `reference/sampen-reference.js` is a deliberately straightforward O(N²) implementation that independently enumerates all unordered template pairs. It does not reuse the candidate's grid-search counting algorithm. This reduces the risk of the same bug being present in both implementations.

The battery validates this explicit finite-N convention:

- remove non-finite values before calculation;
- population standard deviation for scaling;
- tolerance `r = toleranceMultiplier × population SD`;
- Chebyshev distance and inclusive match criterion `distance <= r`;
- no self-matches and each unordered pair counted once;
- same `N-m` template start positions for dimensions `m` and `m+1`;
- `SampEn = -ln(A/B)` where both counts are positive.

The convention for template starts follows Richman & Moorman (2000), pages H2041–H2042. The paper's approximate t-based uncertainty discussion is checked structurally; this battery does not assert that nominal 95% coverage holds for overlapping/dependent templates.

## Run

Requires Node.js 18 or later; no third-party packages are needed. On Windows, double-click `run-validation.bat`.

```bash
node --test tests/battery.test.cjs
node scripts/run-uniform-benchmark.cjs
```

On Windows, run those commands in a terminal opened in this folder. GitHub Actions also runs the same tests automatically when this folder is uploaded into a test repository.

## What passing means—and does not mean

Passing means the candidate's optimized pair counts agree with an independent brute-force reference on tested deterministic/seeded series, boundary cases are handled as expected, and a Monte Carlo uniform-iid benchmark is consistent with its analytical conditional probability within the stated tolerance.

It does **not** establish full scientific validity for every astrophysical light curve. A separate comparison against EntropyHub or another independently maintained package using identical settings and finite-N conventions is still recommended. Irregular cadence, gaps, observation errors and choices of r/m require domain-specific interpretation.

See `RESULTS.md` for the measured outcome and `ENTROPYHUB-COMPARISON-NEXT.md` for the external comparison still to be performed before claiming cross-library agreement.
