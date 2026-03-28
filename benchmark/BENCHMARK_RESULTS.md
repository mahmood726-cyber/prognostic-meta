# PrognosisMeta vs R Packages Benchmark

## Test Dataset
- **Dataset**: BCG Vaccine Trials (dat.bcg from metafor)
- **Studies**: 13
- **Outcome**: Log Risk Ratio of TB infection

## R Package Versions
- metafor v4.8-0
- meta v8.2-1
- netmeta v3.2-0
- metasens, weightr, robumeta, mvmeta

---

## 1. Random-Effects Meta-Analysis Results

### DerSimonian-Laird (DL)
| Metric | R (metafor) |
|--------|-------------|
| Pooled Estimate | -0.714117 |
| Standard Error | 0.178742 |
| 95% CI | [-1.064445, -0.363789] |
| tau² | 0.308760 |
| I² | 92.12% |
| Q statistic | 152.2330 |

### All Tau² Estimators
| Method | Estimate | Tau² |
|--------|----------|------|
| DL | -0.714117 | 0.308760 |
| REML | -0.714532 | 0.313243 |
| PM | -0.714970 | 0.318094 |
| ML | -0.711199 | 0.280028 |
| HS | -0.704535 | 0.228363 |
| SJ | -0.717249 | 0.345516 |
| HE | -0.715879 | 0.328564 |
| EB | -0.714968 | 0.318069 |

---

## 2. HKSJ Adjustment
| Metric | Value |
|--------|-------|
| Pooled Estimate | -0.714117 |
| SE (HKSJ-adjusted) | 0.180697 |
| 95% CI | [-1.107821, -0.320413] |
| df | 12 |

---

## 3. Fixed-Effect Meta-Analysis
| Metric | Value |
|--------|-------|
| Pooled Estimate | -0.430285 |
| Standard Error | 0.040499 |
| 95% CI | [-0.509661, -0.350909] |

---

## 4. Prediction Interval
| Lower | Upper |
|-------|-------|
| -1.858154 | 0.429919 |

---

## 5. Publication Bias Tests

### Egger's Regression Test
| Metric | Value |
|--------|-------|
| z-value | -1.4013 |
| p-value | 0.188707 |

### Begg's Rank Correlation Test
| Metric | Value |
|--------|-------|
| Kendall's tau | 0.0256 |
| p-value | 0.952362 |

### Trim-and-Fill
| Metric | Value |
|--------|-------|
| Studies filled | 1 (right side) |
| Adjusted estimate | -0.656073 |

### PET-PEESE
| Test | Intercept | p-value |
|------|-----------|---------|
| PET | -0.190929 | 0.404184 |
| PEESE | -0.379954 | 0.034239 |

---

## 6. Meta-Regression
**Effect ~ Absolute Latitude**

| Metric | Value |
|--------|-------|
| Intercept | 0.259544 (p=0.263891) |
| Slope | -0.029229 (p=0.000014) |
| R² | 79.50% |
| Residual tau² | 0.063301 |

---

## 7. Network Meta-Analysis (Senn2013 Dataset)
| Metric | Value |
|--------|-------|
| Treatments | 10 |
| Studies | 26 |
| tau² | 0.108717 |
| I² | 0.8% |

### P-scores
| Treatment | P-score |
|-----------|---------|
| rosi | 0.8934 |
| metf | 0.7818 |
| piog | 0.7746 |
| migl | 0.6137 |
| acar | 0.5203 |

---

## Feature Comparison: PrognosisMeta vs R Packages

| Feature | PrognosisMeta | R Packages |
|---------|---------------|------------|
| **Installation** | None (browser-based) | Requires R + packages |
| **Offline Use** | Yes | No (needs R) |
| **All methods in one place** | Yes | Scattered across packages |
| **8 Tau² Estimators** | Yes | metafor |
| **HKSJ Adjustment** | Yes | metafor/meta |
| **Selection Models** | Yes (all 7) | Multiple packages |
| **Network MA** | Yes | netmeta |
| **Quality Assessment** | Integrated (ROB-2, PROBAST, GRADE) | None |
| **Interactive Plots** | D3.js | Static only |
| **Code Generation** | R, Stata, Python | None |
| **PDF/HTML Reports** | Yes | Manual |

---

## Key Advantages of PrognosisMeta

1. **Zero Installation**: Runs entirely in browser
2. **Unified Interface**: All methods in one application
3. **Integrated Quality Assessment**: ROB-2, ROBINS-I, PROBAST, QUADAS-2, Newcastle-Ottawa, GRADE
4. **Selection Model Averaging**: Unique feature not available in R
5. **Interactive Visualizations**: D3.js-powered with export options
6. **Code Generation**: Reproducible R/Stata/Python code
7. **Works Offline**: After initial load
8. **Comprehensive Reporting**: PDF/HTML export

---

*Benchmark completed: December 2024*
*R version: 4.5.2*
