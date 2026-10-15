# Validation report — baseline V0.22

## Scope

This battery was run against the V0.22 `analysis-core.js` copied into `candidate/analysis-core.js`. It was not integrated into the production web app.

## Tests

1. Hand-checkable deterministic case: `[0,0,1,1,0,0]`, `m=1`, tolerance multiplier `0.2` gives `A=1`, `B=4`, SampEn `ln(4)` under the project's normalization and template convention.
2. Candidate vs independent brute-force reference at sizes across both sides of the candidate's algorithm switch, including 699/701/702/703 points and dimensions `m=1,2,3`.
3. Pair-count invariants: `A <= B`, no self-pairs, at most `K(K-1)/2` pairs for `K=N-m` starts, formula consistency.
4. Degenerate cases: constant input, too-short input, no B matches, no A extensions.
5. Non-finite values and the documented finite-observation policy.
6. Invariance to positive affine scaling when tolerance is defined by the population standard deviation.
7. Approximate confidence-interval boundary handling.
8. Statistical reference benchmark using uniform iid data.
9. Periodic vs seeded white-noise demonstration case.
10. Time-stamp diagnostic invariants.

## Uniform-iid analytical benchmark

For X,Y independently uniform on [0,1], with delta = 0.2 / sqrt(12), the probability `P(|X-Y| <= delta) = 2 delta - delta^2`. The theoretical entropy benchmark is `-ln(p)`. The test averages 20 seeded realizations of N=600 and accepts a difference below 0.10. This is a diagnostic benchmark, not a universal accuracy claim for arbitrary data.

## Interpretation

A pass provides a good, independently checkable baseline for the counting implementation. It does not yet constitute a published-package comparison or observational validation. Because templates overlap, pair events are dependent; the article itself discusses residual finite-sample bias and cautions that SampEn may become unstable when matches are sparse (Richman & Moorman, 2000, especially H2044–H2046).
