# Truth-Recovery Validation — prognostic-meta

**Date:** 2026-06-14
**Engine under test:** `js/meta-analysis.js` (`poolCStatistics`, `poolOERatios`) + `js/statistics.js`
**Method:** Standalone seeded known-truth Monte Carlo. We inject a TRUE population
performance metric (C-statistic / O:E ratio), generate `k` studies with logit-/log-scale
between-study heterogeneity (`tau`) and realistic within-study sampling SE, pool with the
repo's OWN functions, and measure whether the pooled CI recovers the true value.

## Verdict: GENUINE ENGINE — POINT ESTIMATES SOUND; DEFAULT CI UNDER-COVERS UNDER HETEROGENEITY

The transforms and back-transforms are **correct**. `poolCStatistics` pools on the
logit scale with delta-method SE `SE_logit = SE_C / (C(1-C))` and back-transforms with
`invLogit` — verified. `poolOERatios` pools on the log scale and back-transforms with `exp`
— verified. Point estimates are essentially **unbiased** (|bias| < 0.003 in C-units,
< 0.006 in O:E across all cells).

Substantive finding: **`poolCStatistics` / `poolOERatios` build their CI with a fixed
`±1.96` z-interval** (via `randomEffects`), NOT the HKSJ t-interval. The pooled-performance
CI **under-covers the true value when between-study heterogeneity is present**, worst at
small `k`. The repo already implements `randomEffectsHKSJ` (q≥1 truncation, IntHout 2014)
but **does not wire it into the prediction-model pooling paths.**

## Results — C-statistic recovery (C_true = 0.75, 2000 reps/cell)

| tau  | k  | cov (z, default) | cov (HKSJ) | bias(C) | width(z) | width(HKSJ) |
|------|----|------------------|------------|---------|----------|-------------|
| 0.00 | 5  | 96.2%            | 99.6%      | -0.0007 | 0.0431   | 0.0612      |
| 0.15 | 5  | 92.0%            | 97.8%      | -0.0015 | 0.0611   | 0.0868      |
| 0.35 | 5  | 88.4%            | 94.7%      | -0.0022 | 0.1145   | 0.1622      |
| 0.00 | 10 | 96.0%            | 97.8%      | -0.0010 | 0.0299   | 0.0346      |
| 0.15 | 10 | 91.8%            | 95.1%      | -0.0012 | 0.0431   | 0.0501      |
| 0.35 | 10 | 92.3%            | 95.5%      | -0.0026 | 0.0835   | 0.0967      |
| 0.00 | 20 | 96.3%            | 97.1%      | -0.0011 | 0.0207   | 0.0221      |
| 0.15 | 20 | 92.0%            | 93.8%      | -0.0016 | 0.0309   | 0.0331      |
| 0.35 | 20 | 93.5%            | 95.5%      | -0.0015 | 0.0595   | 0.0638      |

Nominal target = 95%. Default z-interval lands at **88-93%** whenever `tau > 0`. HKSJ
restores it to ~94-98%. (HKSJ over-covers slightly at tau=0/small k, expected since the
true model is then homogeneous.)

## Results — O:E calibration ratio recovery (O:E_true = 1.0, k=10, 2000 reps)

| tau  | coverage (z) | bias(O:E) |
|------|--------------|-----------|
| 0.00 | 96.6%        | +0.0009   |
| 0.20 | 91.4%        | +0.0015   |

Same signature: unbiased point estimate, z-interval under-covers under heterogeneity.

## What is CORRECT
- logit / invLogit round-trip exact; engine genuinely pools on logit scale for C, log scale for O:E.
- Delta-method SE on the logit scale is the textbook form (Debray 2017).
- Back-transformation of point + CI bounds is correct (transform endpoints, not the SE).
- Point estimates unbiased across all heterogeneity levels.
- REML tau-squared estimator used by default (no DL-at-small-k problem in these paths).

## What is a BUG / risk
- **Z-interval (`±1.96`) in `poolCStatistics`/`poolOERatios` instead of HKSJ.** Under-covers
  the true performance metric by ~3-7 points whenever heterogeneity exists — exactly the
  regime prediction-model reviews live in.

## Recommendation
Route `poolCStatistics` and `poolOERatios` through `randomEffectsHKSJ` (truncated, t-interval
with df = k-1) instead of `randomEffects`, OR expose an HKSJ toggle defaulted ON for the
prediction-model metrics. The HKSJ machinery already exists in the repo; this is a one-line
dispatch change in each pooling function, not new statistics. After the change, re-run
`node truth-recovery/harness.mjs` and confirm coverage >= 94% across the tau sweep.

## Reproduce
```
node truth-recovery/harness.mjs             # full coverage sweep
node truth-recovery/test-truth-recovery.mjs # 6 assertions, exit 0 on pass
```
All code is ADDITIVE; no source function was modified. `engine.mjs` imports the repo's
`statistics.js` + `meta-analysis.js` VERBATIM (installs the `Statistics` global the way
`index.html` does) and re-exports the pooling functions.
