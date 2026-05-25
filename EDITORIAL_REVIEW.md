# Editorial Review: PrognosisMeta
## A Browser-Based Meta-Analysis Tool for Prognostic Factors and Prediction Models

**Reviewer**: Research Synthesis Methods Editorial Perspective
**Date**: December 2024
**Recommendation**: Major Revisions Required (Conditional Accept)

---

## Executive Summary

PrognosisMeta represents an ambitious attempt to create a comprehensive browser-based meta-analysis platform. The scope is impressive, incorporating methods typically scattered across multiple R packages. However, before publication/release, several methodological and implementation concerns require attention.

**Overall Assessment**: 7.5/10 - Strong foundation requiring validation

---

## Strengths

### 1. Comprehensive Method Coverage (Excellent)

The tool implements an unusually complete set of methods:

- **8 tau² estimators**: DL, REML, PM, ML, HS, SJ, HE, EB (matching metafor)
- **Selection models**: Copas, Vevea-Hedges, 3PSM, PET-PEESE, Limit MA, p-uniform* - more comprehensive than any single R package
- **Advanced methods**: RVE (CR0/CR1/CR2), Network MA, Dose-response MA
- **Quality assessment integration**: ROB-2, ROBINS-I, PROBAST, QUADAS-2, Newcastle-Ottawa, GRADE

This breadth exceeds what any single R package provides.

### 2. Accessibility (Excellent)

Browser-based operation eliminates R installation barriers, making advanced methods accessible to systematic reviewers without programming experience.

### 3. Integrated Quality Assessment (Novel)

Embedding ROB tools directly into the analysis workflow is a genuine innovation. No R package provides this integration.

### 4. Selection Model Averaging (Novel)

The model averaging approach for publication bias adjustment is methodologically sophisticated and not widely available elsewhere.

---

## Critical Issues Requiring Attention

### Issue 1: Numerical Validation Incomplete

**Severity**: High

The benchmark against R shows DL estimates match to 6 decimal places, but:

1. **REML/ML convergence**: No diagnostic output for iteration count or convergence status
2. **Edge cases**: No evidence of testing with:
   - Single-study scenarios
   - Zero-variance studies
   - Extremely heterogeneous data (I² > 99%)
   - Negative tau² estimates (should be truncated to 0)

**Required Action**:
```
- Add convergence diagnostics to all iterative estimators
- Create comprehensive test suite with edge cases
- Document numerical precision limits
```

### Issue 2: Confidence Interval Methods Need Clarification

**Severity**: High

The code implements multiple CI approaches but documentation is unclear:

1. **Standard Wald CI**: Uses z-distribution (normal approximation)
2. **HKSJ adjustment**: Uses t-distribution with k-1 df
3. **Profile likelihood CI**: Not implemented for tau²

**Concerns**:
- HKSJ can produce *narrower* CIs than standard when q < 1 (see IntHout et al. 2014). doi:10.1186/1471-2288-14-25
- No option for Jackson's Q-profile CI for tau²
- Prediction intervals use simplified formula (Riley et al. 2011 recommended). doi:10.1136/bmj.d549

**Required Action**:
```
- Implement HKSJ with optional truncation (q ≥ 1)
- Add Q-profile CI for tau² (Viechtbauer 2007)
- Document which formulas are used with references
```

### Issue 3: Selection Models Need Sensitivity Analysis

**Severity**: Medium-High

The Copas model implementation uses grid search, but:

1. No automatic sensitivity analysis over gamma range
2. No diagnostic plots for selection function
3. Missing standard errors for adjusted estimates

**Required Action**:
```
- Add contour-enhanced sensitivity analysis (Copas & Jackson 2004)
- Implement proper variance estimation for adjusted effects
- Add selection function diagnostic visualization
```

### Issue 4: Network Meta-Analysis Validation

**Severity**: Medium-High

The NMA implementation needs verification against netmeta:

1. **Inconsistency testing**: Implementation unclear
2. **SUCRA/P-scores**: Need validation against published datasets
3. **Multi-arm trials**: Handling not documented

**Required Action**:
```
- Validate against Senn2013 dataset with netmeta
- Document inconsistency test methodology
- Add node-splitting for local inconsistency
```

### Issue 5: Bayesian Implementation Incomplete

**Severity**: Medium

The Bayesian module references MCMC but:

1. No convergence diagnostics (Rhat, ESS)
2. Prior specification interface unclear
3. No posterior predictive checks

**Required Action**:
```
- Add MCMC diagnostics (Gelman-Rubin, ESS, trace plots)
- Document default priors with references
- Implement posterior predictive p-values
```

---

## Methodological Recommendations

### Recommendation 1: Add Formula References

Every statistical calculation should reference the source:

```javascript
/**
 * DerSimonian-Laird estimator
 * Reference: DerSimonian R, Laird N. (1986). Meta-analysis in clinical trials.
 * Controlled Clinical Trials, 7(3), 177-188.
 * Formula: tau² = max(0, (Q - df) / C)
 * where C = Σwi - Σwi²/Σwi
 */
```

### Recommendation 2: Implement Diagnostics Panel

Add a dedicated diagnostics section showing:
- Convergence status for iterative methods
- Influence diagnostics (DFBETAS, Cook's distance)
- Outlier detection (externally studentized residuals)
- Normality tests for random effects

### Recommendation 3: Effect Measure Transformations

Document all transformations explicitly:

| Measure | Transformation | Back-transformation | SE Transformation |
|---------|----------------|---------------------|-------------------|
| OR | log(OR) | exp(pooled) | Delta method |
| RR | log(RR) | exp(pooled) | Delta method |
| HR | log(HR) | exp(pooled) | Delta method |
| C-stat | logit(C) | expit(pooled) | SE/(C×(1-C)) |
| Correlation | Fisher's z | tanh(pooled) | 1/√(n-3) |

### Recommendation 4: Add Method Comparison Feature

Allow users to run multiple estimators simultaneously and compare:
- Point estimates across methods
- CI width comparison
- Sensitivity to estimator choice

### Recommendation 5: Transparent Limitations

Add explicit warnings for:
- Small sample meta-analysis (k < 5)
- High heterogeneity (I² > 75%)
- Publication bias detection power
- Selection model assumptions

---

## Code Quality Assessment

### Statistical Implementation: B+

**Strengths**:
- Correct formula implementation for core methods
- Appropriate use of numerical optimization
- Good handling of special cases (e.g., negative tau² truncation)

**Weaknesses**:
- Inconsistent error handling
- Missing input validation in some functions
- No unit tests visible in repository

### Documentation: C+

**Strengths**:
- Code comments explain purpose
- JSDoc-style function documentation

**Weaknesses**:
- No mathematical appendix
- Missing worked examples
- No methodology documentation for users

### Software Engineering: B

**Strengths**:
- Modular architecture
- Clean separation of concerns
- Export functionality well-designed

**Weaknesses**:
- No automated testing framework
- Version control for formulas not evident
- No continuous integration

---

## Comparison with Existing Tools

| Feature | PrognosisMeta | metafor | meta | RevMan |
|---------|---------------|---------|------|--------|
| Tau² estimators | 8 | 8 | 3 | 1 |
| Selection models | 7 | 0* | 0 | 0 |
| Network MA | Yes | No | No | Yes |
| RVE | Yes | No | No | No |
| Quality assessment | Yes | No | No | Yes |
| Browser-based | Yes | No | No | No |
| Free/Open | Yes | Yes | Yes | No |
| Validated | Partial | Yes | Yes | Yes |

*metafor requires additional packages (metasens, weightr)

---

## Required Revisions Before Publication

### Priority 1 (Must Fix)

1. [ ] Complete numerical validation against R for all 8 tau² estimators
2. [ ] Add convergence diagnostics to iterative methods
3. [ ] Document all formulas with published references
4. [ ] Test edge cases (k=1, k=2, extreme heterogeneity)
5. [ ] Implement proper HKSJ adjustment (with q≥1 truncation option)

### Priority 2 (Should Fix)

6. [ ] Add automated test suite
7. [ ] Implement Q-profile CI for tau²
8. [ ] Validate network MA against netmeta
9. [ ] Add selection model sensitivity diagnostics
10. [ ] Complete Bayesian convergence diagnostics

### Priority 3 (Nice to Have)

11. [ ] Add methodological documentation (LaTeX/PDF)
12. [ ] Implement multivariate dose-response
13. [ ] Add IPD meta-analysis support
14. [ ] Create video tutorials

---

## Conclusion

PrognosisMeta has the potential to be a significant contribution to the meta-analysis toolkit. The scope is impressive, and the browser-based approach addresses real accessibility barriers. However, the current implementation requires additional validation and documentation before it can be recommended for production use.

The tool should not be released without:
1. Comprehensive numerical validation
2. Proper documentation of statistical methods
3. Clear statement of limitations
4. At minimum, validation against standard datasets

With these revisions, PrognosisMeta could become a valuable resource for systematic reviewers, particularly those without R programming experience.

---

## References for Implementation Verification

1. Viechtbauer W. (2010). Conducting meta-analyses in R with the metafor package. *Journal of Statistical Software*, 36(3), 1-48. doi:10.18637/jss.v036.i03
2. Hedges LV, Tipton E, Johnson MC. (2010). Robust variance estimation in meta-regression with dependent effect size estimates. *Research Synthesis Methods*, 1(1), 39-65. doi:10.1002/jrsm.5
3. IntHout J, Ioannidis JP, Borm GF. (2014). The Hartung-Knapp-Sidik-Jonkman method for random effects meta-analysis is straightforward and considerably outperforms the standard DerSimonian-Laird method. *BMC Medical Research Methodology*, 14, 25. doi:10.1186/1471-2288-14-25
4. Copas JB, Jackson D. (2004). A bound for publication bias based on the fraction of unpublished studies. *Biometrics*, 60(1), 146-153. doi:10.1111/j.0006-341X.2004.00161.x
5. Riley RD, Higgins JP, Deeks JJ. (2011). Interpretation of random effects meta-analyses. *BMJ*, 342, d549. doi:10.1136/bmj.d549

---

*Review completed by Editorial Standards Committee*
*Research Synthesis Methods - Methodological Quality Assessment*
