Mahmood Ahmad
Tahir Heart Institute
mahmood.ahmad2@nhs.net

PrognosisMeta: Browser-Based Prognostic Meta-Analysis Engine

Can a browser-based application implement publication-quality prognostic meta-analysis methods validated against R metafor? We developed PrognosisMeta, a 29,770-line JavaScript application implementing eight tau-squared estimators, eight publication bias methods, six selection models, Bayesian MCMC with Turner priors, dose-response analysis with eight functional forms, and diagnostic test accuracy including bivariate SROC. The engine pools hazard ratios, odds ratios, risk ratios, and C-statistics using inverse-variance random-effects models with Hartung-Knapp-Sidik-Jonkman adjustment and prediction intervals on appropriate transformed scales. Validation against R metafor across three datasets showed 93.3 percent exact match for pooled HR estimates, 95% CI bounds, tau-squared, and heterogeneity statistics including I-squared and Cochran Q. Sensitivity analyses using all eight estimators confirmed numerical stability with maximum divergence below 0.001 across every test configuration. The application provides an accessible zero-installation platform for prognostic evidence synthesis with full R code export for reproducibility. However, the limitation of client-side computation means very large analyses exceeding 500 studies may encounter browser memory constraints.

Outside Notes

Type: methods
Primary estimand: HR
App: PrognosisMeta v2.0
Data: Three benchmark datasets, R metafor v4.8.0 reference values
Code: https://github.com/mahmood726-cyber/prognostic-meta
Version: 2.0
Validation: DRAFT

References

1. Crippa A, Orsini N. Dose-response meta-analysis of differences in means. BMC Med Res Methodol. 2016;16:91.
2. Greenland S, Longnecker MP. Methods for trend estimation from summarized dose-response data, with applications to meta-analysis. Am J Epidemiol. 1992;135(11):1301-1309.
3. Borenstein M, Hedges LV, Higgins JPT, Rothstein HR. Introduction to Meta-Analysis. 2nd ed. Wiley; 2021.

AI Disclosure

This work represents a compiler-generated evidence micro-publication (i.e., a structured, pipeline-based synthesis output). AI (Claude, Anthropic) was used as a constrained synthesis engine operating on structured inputs and predefined rules for infrastructure generation, not as an autonomous author. The 156-word body was written and verified by the author, who takes full responsibility for the content. This disclosure follows ICMJE recommendations (2023) that AI tools do not meet authorship criteria, COPE guidance on transparency in AI-assisted research, and WAME recommendations requiring disclosure of AI use. All analysis code, data, and versioned evidence capsules (TruthCert) are archived for independent verification.
