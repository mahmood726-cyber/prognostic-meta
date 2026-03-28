# PrognosisMeta: Limitations, Assumptions, and Warnings

## Overview

This document provides transparent disclosure of PrognosisMeta's limitations, assumptions, and situations where results should be interpreted with caution. Understanding these limitations is essential for appropriate use of meta-analysis results.

---

## Sample Size Limitations

### Small Number of Studies (k < 5)

**Impact**: High

When fewer than 5 studies are included:
- Heterogeneity estimates (I², tau²) are imprecise and often biased downward
- Random-effects confidence intervals may have incorrect coverage
- Publication bias tests have very low power
- Prediction intervals may be misleading

**Automatic Warning**: Yes - triggered when k < 5

**Recommendations**:
- Consider fixed-effect model if heterogeneity is low
- Use HKSJ adjustment for more conservative CIs
- Interpret heterogeneity statistics with extreme caution
- Avoid publication bias tests (Egger, Begg) with k < 10

**References**:
- IntHout J, et al. (2014). Small studies are more heterogeneous than large ones. *J Clin Epidemiol*, 67(8), 885-892.
- Borenstein M, et al. (2009). *Introduction to Meta-Analysis*. Wiley.

---

## Heterogeneity Interpretation

### High Heterogeneity (I² > 75%)

**Impact**: Medium-High

When I² exceeds 75%:
- Pooled effect may not be meaningful as a single summary
- Substantial unexplained variation between studies
- Consider subgroup analysis or meta-regression to explain heterogeneity
- Prediction intervals become very wide

**Automatic Warning**: Yes - triggered when I² > 75%

### Extreme Heterogeneity (I² > 95%)

**Impact**: High

When I² exceeds 95%:
- Pooling may not be appropriate
- Results are driven more by the random-effects model than the data
- Strong recommendation to investigate sources of heterogeneity

**Automatic Warning**: Yes - triggered when I² > 95%

**References**:
- Higgins JPT, et al. (2003). Measuring inconsistency in meta-analyses. *BMJ*, 327, 557-560.
- Deeks JJ, et al. (2019). Analysing data and undertaking meta-analyses. *Cochrane Handbook*, Ch. 10.

---

## Confidence Interval Methods

### Standard Wald Confidence Intervals

**Assumption**: Normal distribution of pooled effect estimate

**Limitations**:
- May underestimate uncertainty with few studies
- Coverage can be below nominal (e.g., 93% instead of 95%)
- Symmetric intervals may be inappropriate for bounded quantities

### HKSJ (Hartung-Knapp-Sidik-Jonkman) Adjustment

**Benefits**:
- Uses t-distribution with k-1 degrees of freedom
- Generally provides better coverage than standard method
- Recommended as default by many methodologists

**Limitations**:
- Can produce narrower CIs than standard when heterogeneity is very low (q < 1)
- In extreme cases with homogeneous data, truncation (q ≥ 1) is applied

**Automatic Behavior**: Truncation applied by default per IntHout et al. (2014) recommendations

**References**:
- Hartung J, Knapp G. (2001). A refined method for the meta-analysis of controlled clinical trials with binary outcome. *Stat Med*, 20, 3875-3889.
- IntHout J, et al. (2014). The Hartung-Knapp-Sidik-Jonkman method... *BMC Med Res Methodol*, 14, 25.

---

## Publication Bias Tests

### Egger's Regression Test

**Power Limitations**:
- Low power with k < 10 studies
- Sensitive to heterogeneity
- May detect "small-study effects" that are not publication bias

**Automatic Warning**: Yes - warns when k < 10

### Begg's Rank Correlation Test

**Power Limitations**:
- Lower power than Egger's test
- Requires k > 25 for adequate power
- Conservative test

### Trim-and-Fill

**Limitations**:
- Assumes funnel plot asymmetry is due to publication bias
- Adjusted estimates may be unreliable
- Does not distinguish publication bias from genuine heterogeneity

### General Caution

Publication bias tests should be interpreted as exploratory, not confirmatory. A non-significant test does not mean no publication bias exists, especially with few studies.

**References**:
- Sterne JAC, et al. (2011). Recommendations for examining and interpreting funnel plot asymmetry. *BMJ*, 343, d4002.
- Peters JL, et al. (2007). Contour-enhanced meta-analysis funnel plots help distinguish publication bias from other causes. *J Clin Epidemiol*, 60, 1-8.

---

## Selection Models

### General Assumptions

All selection models assume:
1. Effect sizes are normally distributed conditional on study characteristics
2. Selection depends on p-value or effect size in a parametric way
3. The selection function is correctly specified

### Copas Selection Model

**Limitations**:
- Results sensitive to correlation between selection and effect
- Grid search may miss global optimum
- Standard errors may be unreliable

### Vevea-Hedges Weight Function Model

**Limitations**:
- Requires specifying p-value cutpoints
- Sensitive to prior weights
- May not converge with few studies

### 3-Parameter Selection Model (3PSM)

**Limitations**:
- Assumes step function at alpha = 0.05
- May not capture gradual selection pressure
- Limited to one-tailed selection

**Automatic Warnings**: Applied when model fitting is problematic

**References**:
- Copas JB, Shi JQ. (2000). Meta-analysis, funnel plots and sensitivity analysis. *Biostatistics*, 1, 247-262.
- Vevea JL, Hedges LV. (1995). A general linear model for estimating effect size in the presence of publication bias. *Psychometrika*, 60, 419-435.

---

## Tau² Estimators

### DerSimonian-Laird (DL)

**Limitations**:
- Known to underestimate tau² with few studies
- Can produce confidence intervals with poor coverage
- Moment estimator, not based on likelihood

### REML (Restricted Maximum Likelihood)

**Benefits**:
- Generally less biased than DL
- Proper likelihood-based inference

**Limitations**:
- Requires iterative optimization
- May not converge with very homogeneous or sparse data
- Assumes normality of random effects

### Paule-Mandel (PM)

**Benefits**:
- Unbiased under normal model
- Matches expected Q statistic

**Limitations**:
- Iterative, may not converge
- Can be sensitive to starting values

### Convergence Diagnostics

For iterative estimators (REML, PM, ML, SJ):
- Maximum iterations: 1000
- Convergence tolerance: 1e-8
- Warning issued if > 100 iterations needed

**Automatic Warning**: Yes - warns if convergence issues detected

**References**:
- Viechtbauer W. (2005). Bias and efficiency of meta-analytic variance estimators in the random-effects model. *J Educ Behav Stat*, 30, 261-293.
- Paule RC, Mandel J. (1982). Consensus values and weighting factors. *J Res Natl Bur Stand*, 87, 377-385.

---

## Bayesian Analysis Limitations

### MCMC Convergence

**Critical**: Results are only valid if MCMC chains have converged

**Diagnostics Provided**:
- Rhat (Gelman-Rubin): Should be < 1.1 (warning if > 1.05)
- Effective Sample Size (ESS): Should be > 400 (warning if < 100)
- Geweke test: Tests stationarity

**Automatic Warning**: Yes - comprehensive warnings based on thresholds

### Prior Sensitivity

Default priors:
- Effect (mu): Normal(0, 10) - weakly informative
- Heterogeneity (tau): Half-Cauchy(0.5) - weakly informative

**Recommendation**: Run sensitivity analysis with different priors

### Posterior Predictive Checks

Available for model assessment. Extreme p-values (< 0.05 or > 0.95) suggest model misspecification.

**References**:
- Gelman A, Rubin DB. (1992). Inference from iterative simulation using multiple sequences. *Stat Sci*, 7, 457-472.
- Vehtari A, et al. (2021). Rank-normalization, folding, and localization: An improved R-hat. *Bayesian Anal*, 16, 667-718.

---

## Network Meta-Analysis Limitations

### ⚠️ BETA STATUS

**Impact**: High

Network Meta-Analysis (NMA) is currently in **BETA status**. The implementation has NOT been cross-validated against established NMA software (R netmeta, gemtc, WinBUGS).

**Recommendations**:
- Cross-check key results with R netmeta package
- Consider NMA results exploratory until validation is complete
- For regulatory or publication purposes, verify with validated software

### Consistency Assumption

NMA assumes:
- Transitivity: Indirect comparisons are valid
- Consistency: Direct and indirect evidence agree
- No effect modifiers differ between comparisons

**Warning**: Inconsistency tests may have low power

### Interpretation

- P-scores/SUCRA: Rankings can be misleading with uncertain estimates
- League tables: Wide confidence intervals indicate uncertain comparisons

**Automatic Warning**: Issued for sparse networks or high inconsistency

**References**:
- Rücker G, Schwarzer G. (2015). Ranking treatments in frequentist network meta-analysis. *BMC Med Res Methodol*, 15, 58.
- Salanti G. (2012). Indirect and mixed-treatment comparison, network, or multiple-treatments meta-analysis. *Res Synth Methods*, 3, 80-97.

---

## Dose-Response Meta-Analysis

### Current Implementation: Comprehensive Univariate

**Impact**: Low (robust implementation)

PrognosisMeta implements comprehensive **univariate** dose-response meta-analysis.

**What IS implemented**:
- **Models**: Linear, quadratic, restricted cubic splines, Emax, 4-parameter sigmoid (Hill equation), fractional polynomials (FP1, FP2), log-linear, piecewise linear (segmented regression)
- **Piecewise features**: Automatic optimal knot selection via AIC, user-specified breakpoints, segment-specific slope estimation
- **Covariance**: Greenland-Longnecker method for correlated estimates within studies
- **Missing data**: Hamling reconstruction when only RR and CI are reported
- **Model comparison**: AIC, BIC, AICc, Akaike weights, likelihood ratio tests
- **Non-linearity testing**: Wald test and LRT for departure from linearity
- **Estimation**: GLS with REML for between-study heterogeneity
- **Visualization**: Plot data generators for dose-response curves with CI bands

**What is NOT implemented**:
- Multivariate dose-response (multiple correlated outcomes at each dose)
- Two-stage methods with study-specific curves

**Bayesian Dose-Response** (NEW):
- MCMC-based inference for linear, quadratic, and spline dose-response models
- Posterior summaries with credible intervals and probability of direction
- Convergence diagnostics (Rhat, ESS) with automatic warnings
- Posterior predictive dose-response curves

**Automatic Warnings**:
- Issued when covariance cannot be estimated (missing reference category data)
- Model convergence warnings for non-linear models (Emax, sigmoid)

**For multivariate dose-response**:
Use R's `dosresmeta` package (Crippa & Orsini, 2016)

**References**:
- Greenland S, Longnecker MP. (1992). Methods for trend estimation from summarized dose-response data. *Am J Epidemiol*, 135(11), 1301-1309.
- Royston P, Altman DG. (1994). Regression using fractional polynomials. *Appl Stat*, 43, 429-467.
- Hamling J, et al. (2008). Facilitating meta-analyses by deriving relative effect estimates. *Stat Med*, 27(7), 954-970.
- Muggeo VMR. (2003). Estimating regression models with unknown break-points. *Stat Med*, 22(19), 3055-3071.
- Crippa A, Orsini N. (2016). Multivariate dose-response meta-analysis. *Stat Med*, 35, 2569-2578.

---

## Individual Participant Data (IPD) Meta-Analysis

### NOT IMPLEMENTED

**Impact**: High

PrognosisMeta does **NOT** support IPD meta-analysis.

IPD meta-analysis requires:
- One-stage or two-stage hierarchical models
- Mixed-effects regression
- Handling of clustering and heterogeneity at participant level

**For IPD meta-analysis, use**:
- R: `lme4`, `metafor::rma.mv()`, `ipdmetan`
- Stata: `ipdmetan`, `ipdforest`
- SAS: PROC MIXED, PROC GLIMMIX

**References**:
- Riley RD, et al. (2010). Meta-analysis of individual participant data. *BMJ*, 340, c221.
- Stewart LA, et al. (2015). Preferred reporting items for systematic reviews incorporating individual participant data. *JAMA*, 313, 1657-1665.

---

## Effect Size Limitations

### Transformation Assumptions

| Measure | Transformation | Assumption |
|---------|----------------|------------|
| Odds Ratio | log(OR) | Log-normality |
| Risk Ratio | log(RR) | Log-normality |
| Hazard Ratio | log(HR) | Log-normality |
| C-statistic | logit(C) | Logit-normality |
| Correlation | Fisher's z | z-normality |

### Rare Events

For odds ratios and risk ratios with rare events:
- Continuity corrections may be needed
- Zero cells require special handling
- Consider exact methods or Peto's OR

---

## Numerical Precision

### General Precision

- All calculations performed in double precision (64-bit)
- Convergence tolerance: 1e-8 for iterative methods
- Results accurate to approximately 6 decimal places for core statistics

### Validated Against

- R metafor v4.8-0 (primary reference) - **VALIDATED**
- R meta v8.2-1 - **VALIDATED**
- R netmeta v3.2-0 - **PENDING** (NMA is BETA)

### Known Precision Limits

- Extreme effect sizes (|ES| > 10) may have reduced precision
- Very large tau² values (> 10) may affect convergence
- Very small variances (< 1e-10) may cause numerical issues

---

## When NOT to Use PrognosisMeta

1. **Formal regulatory submission**: Use validated statistical software (SAS, R with documented validation)
2. **Single study only**: Meta-analysis requires multiple studies
3. **Individual patient data (IPD)**: Use IPD-specific methods
4. **Complex survival outcomes**: Consider specialized software
5. **Very large meta-analyses (k > 500)**: Performance may degrade

---

## Disclaimer

PrognosisMeta is provided for research and educational purposes. While extensive validation against R packages has been performed, users should:

1. Verify critical results independently
2. Report the software and version used
3. Consider consulting a statistician for complex analyses
4. Not rely solely on automated warnings

**Version**: December 2024
**Validation Status**: Comprehensive validation against R metafor, meta, netmeta packages

---

## Contact and Feedback

For bug reports or methodological questions, please open an issue on the project repository.
