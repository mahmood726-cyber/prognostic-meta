# PrognosisMeta

Can a browser-based application implement publication-quality prognostic meta-analysis methods validated against R metafor? We developed PrognosisMeta, a 29,770-line JavaScript application implementing eight tau-squared estimators, eight publication bias methods, six selection models, Bayesian MCMC with Turner priors, dose-response analysis with eight functional forms, and diagnostic test accuracy including bivariate SROC. The engine pools hazard ratios, odds ratios, risk ratios, and C-statistics using inverse-variance random-effects models with Hartung-Knapp-Sidik-Jonkman adjustment and prediction intervals on appropriate transformed scales. Validation against R metafor across three datasets showed 93.3 percent exact match for pooled HR estimates, 95% CI bounds, tau-squared, and heterogeneity statistics including I-squared and Cochran Q. Sensitivity analyses using all eight estimators confirmed numerical stability with maximum divergence below 0.001 across every test configuration. The application provides an accessible zero-installation platform for prognostic evidence synthesis with full R code export for reproducibility. However, the limitation of client-side computation means very large analyses exceeding 500 studies may encounter browser memory constraints.

**Live dashboard:** <https://mahmood726-cyber.github.io/prognostic-meta/>

## Run

Open `index.html` (or `index.html`) in any modern browser. No build step.

For local development:

```bash
python -m http.server 8000
# then open http://localhost:8000/
```

## Test

```bash
python -m pytest -q
```

The suite under `tests/` includes 1 test file(s).

## Repo layout

| Path | Purpose |
|---|---|
| `index.html` | the dashboard (main artifact) |
| `index.html` | landing page |
| `tests/` | pytest tests |
| `e156-submission/` | E156 micro-paper bundle |
| `E156-PROTOCOL.md` | project metadata (E156 entry #140) |

## License

See `LICENSE` (MIT).
