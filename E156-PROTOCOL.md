# E156 Protocol — `prognostic-meta`

This repository is the source code and dashboard backing an E156 micro-paper on the [E156 Student Board](https://mahmood726-cyber.github.io/e156/students.html).

---

## `[140]` PrognosisMeta: Browser-Based Prognostic Meta-Analysis Engine

**Type:** methods  |  ESTIMAND: HR  
**Data:** Three benchmark datasets, R metafor v4.8.0 reference values

### 156-word body

Can a browser-based application implement publication-quality prognostic meta-analysis methods validated against R metafor? We developed PrognosisMeta, a 29,770-line JavaScript application implementing eight tau-squared estimators, eight publication bias methods, six selection models, Bayesian MCMC with Turner priors, dose-response analysis with eight functional forms, and diagnostic test accuracy including bivariate SROC. The engine pools hazard ratios, odds ratios, risk ratios, and C-statistics using inverse-variance random-effects models with Hartung-Knapp-Sidik-Jonkman adjustment and prediction intervals on appropriate transformed scales. Validation against R metafor across three datasets showed 93.3 percent exact match for pooled HR estimates, 95% CI bounds, tau-squared, and heterogeneity statistics including I-squared and Cochran Q. Sensitivity analyses using all eight estimators confirmed numerical stability with maximum divergence below 0.001 across every test configuration. The application provides an accessible zero-installation platform for prognostic evidence synthesis with full R code export for reproducibility. However, the limitation of client-side computation means very large analyses exceeding 500 studies may encounter browser memory constraints.

### Submission metadata

```
Corresponding author: Mahmood Ahmad <mahmood.ahmad2@nhs.net>
ORCID: 0000-0001-9107-3704
Affiliation: Tahir Heart Institute, Rabwah, Pakistan

Links:
  Code:      https://github.com/mahmood726-cyber/prognostic-meta
  Protocol:  https://github.com/mahmood726-cyber/prognostic-meta/blob/main/E156-PROTOCOL.md
  Dashboard: https://mahmood726-cyber.github.io/prognostic-meta/

References (topic pack: diagnostic meta-analysis (DTA)):
  1. Reitsma JB et al. 2005. Bivariate analysis of sensitivity and specificity produces informative summary measures in diagnostic reviews. J Clin Epidemiol. 58(10):982-990. doi:10.1016/j.jclinepi.2005.02.022
  2. Rutter CM, Gatsonis CA. 2001. A hierarchical regression approach to meta-analysis of diagnostic test accuracy evaluations. Stat Med. 20(19):2865-2884. doi:10.1002/sim.942

Data availability: No patient-level data used. Analysis derived exclusively
  from publicly available aggregate records. All source identifiers are in
  the protocol document linked above.

Ethics: Not required. Study uses only publicly available aggregate data; no
  human participants; no patient-identifiable information; no individual-
  participant data. No institutional review board approval sought or required
  under standard research-ethics guidelines for secondary methodological
  research on published literature.

Funding: None.

Competing interests: MA serves on the editorial board of Synthēsis (the
  target journal); MA had no role in editorial decisions on this
  manuscript, which was handled by an independent editor of the journal.

Author contributions (CRediT):
  [STUDENT REWRITER, first author] — Writing – original draft, Writing –
    review & editing, Validation.
  [SUPERVISING FACULTY, last/senior author] — Supervision, Validation,
    Writing – review & editing.
  Mahmood Ahmad (middle author, NOT first or last) — Conceptualization,
    Methodology, Software, Data curation, Formal analysis, Resources.

AI disclosure: Computational tooling (including AI-assisted coding via
  Claude Code [Anthropic]) was used to develop analysis scripts and assist
  with data extraction. The final manuscript was human-written, reviewed,
  and approved by the author; the submitted text is not AI-generated. All
  quantitative claims were verified against source data; cross-validation
  was performed where applicable. The author retains full responsibility for
  the final content.

Preprint: Not preprinted.

Reporting checklist: PRISMA 2020 (methods-paper variant — reports on review corpus).

Target journal: ◆ Synthēsis (https://www.synthesis-medicine.org/index.php/journal)
  Section: Methods Note — submit the 156-word E156 body verbatim as the main text.
  The journal caps main text at ≤400 words; E156's 156-word, 7-sentence
  contract sits well inside that ceiling. Do NOT pad to 400 — the
  micro-paper length is the point of the format.

Manuscript license: CC-BY-4.0.
Code license: MIT.

SUBMITTED: [ ]
```


---

_Auto-generated from the workbook by `C:/E156/scripts/create_missing_protocols.py`. If something is wrong, edit `rewrite-workbook.txt` and re-run the script — it will overwrite this file via the GitHub API._