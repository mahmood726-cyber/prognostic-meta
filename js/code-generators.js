/**
 * PrognosisMeta - Enhanced Code Generators
 * Generates comprehensive R, Stata, and Python code
 */

const CodeGenerators = (function() {
    'use strict';

    function getEffectLabel(effectMeasure) {
        const labels = {
            'HR': 'Hazard Ratio',
            'OR': 'Odds Ratio',
            'RR': 'Risk Ratio',
            'beta': 'Coefficient',
            'cstat': 'C-statistic',
            'SMD': 'Standardized Mean Difference'
        };
        return labels[effectMeasure] || 'Effect Size';
    }

    /**
     * Generate comprehensive R code
     */
    function generateRCode(data, settings = {}, options = {}) {
        const {
            effectMeasure = 'HR',
            tau2Method = 'REML',
            hksjAdjustment = false
        } = settings;

        const {
            includeBayesian = true,
            includeSelectionModels = true,
            includeSensitivity = true
        } = options;

        const studyNames = data.map(d => d.study || `Study ${d.id || ''}`);
        const effects = data.map(d => d.yi || d.effect || 0);
        const ses = data.map(d => d.sei || d.se || Math.sqrt(d.vi || d.variance || 0.01));

        let code = `# ============================================================
# PrognosisMeta - Reproducible R Code
# ============================================================
# Generated: ${new Date().toISOString()}
# Effect Measure: ${effectMeasure}
# Tau² Estimator: ${tau2Method}
# ============================================================

# Install required packages
required <- c("metafor", "meta")
new_pkgs <- required[!(required %in% installed.packages()[,"Package"])]
if(length(new_pkgs)) install.packages(new_pkgs, repos = "https://cloud.r-project.org")

library(metafor)
library(meta)

# ============================================================
# 1. DATA
# ============================================================

study <- c(${studyNames.map(s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/[\n\r\t]/g, ' ')}"`).join(', ')})
yi <- c(${effects.map(e => (e || 0).toFixed(6)).join(', ')})
sei <- c(${ses.map(s => (s || 0.1).toFixed(6)).join(', ')})
vi <- sei^2

dat <- data.frame(study, yi, sei, vi, stringsAsFactors = FALSE)
print(dat)

# ============================================================
# 2. META-ANALYSIS
# ============================================================

# Random-effects model
res <- rma(yi = yi, vi = vi, data = dat,
           method = "${tau2Method}"${hksjAdjustment ? ', test = "knha"' : ''})
summary(res)

# Results
cat("\n=== Pooled Estimate ===\n")
`;

        if (['HR', 'OR', 'RR'].includes(effectMeasure)) {
            code += `cat("${effectMeasure}:", round(exp(coef(res)), 3),
    "95% CI: [", round(exp(res$ci.lb), 3), ",", round(exp(res$ci.ub), 3), "]\n")
`;
        } else {
            code += `cat("Effect:", round(coef(res), 4),
    "95% CI: [", round(res$ci.lb, 4), ",", round(res$ci.ub, 4), "]\n")
`;
        }

        code += `
# Heterogeneity
cat("\nI² =", round(res$I2, 1), "%")
cat("\ntau² =", round(res$tau2, 4))
cat("\nQ =", round(res$QE, 2), ", p =", format.pval(res$QEp))

# ============================================================
# 3. FOREST PLOT
# ============================================================

forest(res, slab = dat$study,
       ${['HR', 'OR', 'RR'].includes(effectMeasure) ? 'atransf = exp,' : ''}
       xlab = "${getEffectLabel(effectMeasure)}",
       header = c("Study", "Estimate [95% CI]"))

# ============================================================
# 4. PUBLICATION BIAS
# ============================================================

# Funnel plot
funnel(res, main = "Funnel Plot")

# Egger's test
regtest(res)

# Trim and fill
trimfill(res)

# ============================================================
# 5. SENSITIVITY ANALYSIS
# ============================================================

# Leave-one-out
leave1out(res)

# Influence diagnostics
influence(res)

# ============================================================
# 6. PREDICTION INTERVAL
# ============================================================

predict(res)
`;

        if (includeBayesian) {
            code += `
# ============================================================
# 7. BAYESIAN (requires brms)
# ============================================================

if (require("brms", quietly = TRUE)) {
    bayes <- brm(yi | se(sei) ~ 1 + (1|study),
                 data = dat,
                 prior = c(prior(normal(0, 10), class = "Intercept"),
                          prior(cauchy(0, 0.5), class = "sd")),
                 iter = 4000, chains = 4, cores = 4)
    summary(bayes)
}
`;
        }

        if (includeSelectionModels) {
            code += `
# ============================================================
# 8. SELECTION MODELS
# ============================================================

# PET-PEESE
pet <- rma(yi, vi, mods = ~ sei, data = dat)
peese <- rma(yi, vi, mods = ~ vi, data = dat)
cat("PET intercept:", round(coef(pet)[1], 4), "p =", format.pval(pet$pval[1]), "\n")
cat("PEESE intercept:", round(coef(peese)[1], 4), "p =", format.pval(peese$pval[1]), "\n")

# Copas (requires metasens)
if (require("metasens", quietly = TRUE)) {
    copas(res)
}
`;
        }

        code += `
# ============================================================
# SESSION INFO
# ============================================================

cat("\n=== Session Info ===\n")
sessionInfo()
`;

        return code;
    }

    /**
     * Generate comprehensive Stata code
     */
    function generateStataCode(data, settings = {}) {
        const { effectMeasure = 'HR', tau2Method = 'REML' } = settings;

        let code = `/*
============================================================
PrognosisMeta - Stata Code
Generated: ${new Date().toISOString()}
============================================================
*/

clear all
set more off

* Input data
input str50 study yi sei
`;

        data.forEach(d => {
            const study = String(d.study || 'Study').replace(/"/g, "'");  // Escape quotes for Stata
            const yi = d.yi || d.effect || 0;
            const sei = d.sei || d.se || Math.sqrt(d.vi || 0.01);
            code += `"${study}" ${yi.toFixed(6)} ${sei.toFixed(6)}
`;
        });

        code += `end

gen vi = sei^2

* Meta-analysis
metan yi sei, random ${tau2Method === 'REML' ? 'reml' : ''} ///
    label(namevar=study) ///
    ${['HR', 'OR', 'RR'].includes(effectMeasure) ? 'eform' : ''} ///
    effect("${getEffectLabel(effectMeasure)}")

* Publication bias
metafunnel yi sei ${['HR', 'OR', 'RR'].includes(effectMeasure) ? ', eform' : ''}
metabias yi sei, egger
metabias yi sei, begg
metatrim yi sei

* Sensitivity
metainf yi sei, random
`;

        return code;
    }

    /**
     * Generate comprehensive Python code
     */
    function generatePythonCode(data, settings = {}) {
        const { effectMeasure = 'HR' } = settings;

        let code = `"""
============================================================
PrognosisMeta - Python Code
Generated: ${new Date().toISOString()}
============================================================
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy import stats

# Data
data = pd.DataFrame({
    'study': [${data.map(d => `'${String(d.study || "Study").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`).join(', ')}],
    'yi': [${data.map(d => (d.yi || d.effect || 0).toFixed(6)).join(', ')}],
    'sei': [${data.map(d => (d.sei || d.se || 0.1).toFixed(6)).join(', ')}]
})
data['vi'] = data['sei'] ** 2
data['wi'] = 1 / data['vi']

print("Study Data:")
print(data)

# Fixed-effect
w_sum = data['wi'].sum()
effect_fe = (data['wi'] * data['yi']).sum() / w_sum
se_fe = np.sqrt(1 / w_sum)

# Q and I²
Q = ((data['wi'] * (data['yi'] - effect_fe)**2)).sum()
df = len(data) - 1
C = w_sum - (data['wi']**2).sum() / w_sum
tau2 = max(0, (Q - df) / C)
I2 = max(0, 100 * (Q - df) / Q) if Q > df else 0

# Random-effects
data['wi_re'] = 1 / (data['vi'] + tau2)
w_sum_re = data['wi_re'].sum()
effect_re = (data['wi_re'] * data['yi']).sum() / w_sum_re
se_re = np.sqrt(1 / w_sum_re)
z = effect_re / se_re
p = 2 * (1 - stats.norm.cdf(abs(z)))

print(f"\nRandom-Effects Results:")
print(f"Effect: {effect_re:.4f} [{effect_re - 1.96*se_re:.4f}, {effect_re + 1.96*se_re:.4f}]")
print(f"z = {z:.2f}, p = {p:.4f}")
print(f"tau² = {tau2:.4f}, I² = {I2:.1f}%")
${['HR', 'OR', 'RR'].includes(effectMeasure) ? `print(f"${effectMeasure}: {np.exp(effect_re):.3f} [{np.exp(effect_re - 1.96*se_re):.3f}, {np.exp(effect_re + 1.96*se_re):.3f}]")` : ''}

# Forest plot
fig, ax = plt.subplots(figsize=(10, 6))
y_pos = range(len(data))
for i, row in data.iterrows():
    ax.errorbar(row['yi'], i,
                xerr=1.96*row['sei'],
                fmt='s', color='blue', capsize=3)
ax.axvline(x=effect_re, color='red', linestyle='-', label='Pooled')
ax.axvline(x=0, color='gray', linestyle='--', alpha=0.5)
ax.set_yticks(list(y_pos))
ax.set_yticklabels(data['study'])
ax.set_xlabel('Effect Size')
ax.set_title('Forest Plot')
plt.tight_layout()
plt.savefig('forest_plot.png', dpi=300)
plt.show()

# Funnel plot
fig, ax = plt.subplots(figsize=(8, 6))
ax.scatter(data['yi'], data['sei'])
ax.axvline(x=effect_re, color='red')
se_range = np.linspace(0, data['sei'].max() * 1.1, 100)
ax.plot(effect_re - 1.96 * se_range, se_range, 'k--', alpha=0.5)
ax.plot(effect_re + 1.96 * se_range, se_range, 'k--', alpha=0.5)
ax.invert_yaxis()
ax.set_xlabel('Effect')
ax.set_ylabel('SE')
ax.set_title('Funnel Plot')
plt.savefig('funnel_plot.png', dpi=300)
plt.show()

# Egger's test
precision = 1 / data['sei']
standardized = data['yi'] / data['sei']
slope, intercept, r, p_egger, se = stats.linregress(precision, standardized)
print(f"\nEgger's test: intercept = {intercept:.3f}, p = {p_egger:.4f}")
`;

        return code;
    }

    return {
        generateRCode,
        generateStataCode,
        generatePythonCode,
        getEffectLabel
    };

})();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeGenerators;
}
