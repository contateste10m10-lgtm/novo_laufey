# Results — SampEn Validation Battery v1.0

## Baseline
- Site snapshot: Multiband Entropy Lab V0.22 (separate from production files).
- Node runtime used: v22.16.0
- SHA-256 of candidate/analysis-core.js: `fdd39c3d4711caeaf015720f825c60c4398a127c4d53cf572afbb6019b082e01`

## Automated outcome
- **12 tests passed, 0 failed** using Node's built-in test runner.
- Candidate optimized counts agreed with a separate brute-force O(N²) reference on deterministic and seeded series, including sizes around the candidate's switch from brute-force to grid counting.
- Stored golden cases matched their expected A/B counts and SampEn values.
- Boundary, constant, too-short, invalid-value, scale-invariance and approximate-interval behaviors passed their stated contracts.

## Uniform-iid analytical benchmark
Using 20 seeded realizations, each with N=600, m=2 and tolerance multiplier 0.2:
- Analytical probability: `0.11213672050459184`
- Theoretical SampEn: `2.188036433367429`
- Observed mean SampEn: `2.189900508484448`
- Absolute difference: `0.0018640751170191372`
- Acceptance threshold for this diagnostic: `0.10`
- Outcome: **PASS**

For X,Y independent uniform on [0,1], the analytical probability uses `P(|X-Y| <= delta) = 2 delta - delta^2`, with `delta = 0.2/sqrt(12)` because SD(U[0,1]) = 1/sqrt(12). This is one theory benchmark, not a universal accuracy claim for arbitrary data.

## Interpretation and limits
Passing shows that the optimized candidate agrees with the independent brute-force implementation for the tested cases and that its uniform-iid behavior is consistent with the selected analytical benchmark. It does **not** prove that every SampEn estimate is scientifically reliable, and it does **not** yet represent a numerical comparison with EntropyHub or observational validation against Swift-BAT curves.

The t-based 95% interval follows the approximation described by Richman & Moorman. Because overlapping template pairs can be dependent, nominal 95% coverage is not guaranteed for all data. The paper also discusses finite-sample bias and instability when matches are sparse. See the uploaded article, pp. H2044–H2046.
