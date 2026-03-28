/**
 * Selection Models for Publication Bias
 * State-of-the-art methods used by methodologists
 * - Copas Selection Model
 * - Vevea-Hedges Weight Function Models
 * - Three-Parameter Selection Model (3PSM)
 * - PET-PEESE
 * - Limit Meta-Analysis
 * - WAAP-WLS
 * - p-uniform / p-uniform*
 * - Selection Model Averaging
 */

const SelectionModels = (function() {
    'use strict';

    // Module dependency checks
    if (typeof Statistics === 'undefined') {
        throw new Error('Statistics module must be loaded before SelectionModels');
    }
    if (typeof MetaAnalysis === 'undefined') {
        throw new Error('MetaAnalysis module must be loaded before SelectionModels');
    }

    // ============================================
    // Seedable PRNG for reproducibility
    // (xoshiro128** algorithm, matches BayesianMA)
    // ============================================

    let _prngState = null;

    function setSeed(seed) {
        function splitmix32(a) {
            return function() {
                a |= 0; a = a + 0x9e3779b9 | 0;
                let t = a ^ a >>> 16; t = Math.imul(t, 0x21f0aaad);
                t = t ^ t >>> 15; t = Math.imul(t, 0x735a2d97);
                return (t ^ t >>> 15) >>> 0;
            };
        }
        const sm = splitmix32(seed);
        _prngState = [sm(), sm(), sm(), sm()];
    }

    function clearSeed() {
        _prngState = null;
    }

    function random() {
        if (!_prngState) return Math.random();
        const s = _prngState;
        const result = Math.imul(((s[1] * 5) << 7 | (s[1] * 5) >>> 25) >>> 0, 9);
        const t = s[1] << 9;
        s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
        s[2] ^= t;
        s[3] = (s[3] << 11 | s[3] >>> 21) >>> 0;
        return (result >>> 0) / 4294967296;
    }

    // ============================================
    // COPAS SELECTION MODEL
    // Models correlation between study effect and selection
    // ============================================

    /**
     * Copas Selection Model
     * Joint model for effect size and selection probability
     * Copas & Shi (2001), Copas & Jackson (2004)
     */
    function copasSelectionModel(data, options = {}) {
        const {
            gammaRange = [-2, 0.5],  // Range for gamma (selection strength)
            nGrid = 20,
            rhoRange = [-0.99, 0.99]  // Correlation between effect and selection
        } = options;

        const yi = data.map(d => d.yi);
        const sei = data.map(d => Math.sqrt(d.vi));
        const n = yi.length;

        // Grid search over gamma and rho
        const results = [];

        for (let g = 0; g < nGrid; g++) {
            const gamma0 = gammaRange[0] + g * (gammaRange[1] - gammaRange[0]) / (nGrid - 1);

            for (let r = 0; r < nGrid; r++) {
                const rho = rhoRange[0] + r * (rhoRange[1] - rhoRange[0]) / (nGrid - 1);

                // Estimate mu and tau given gamma0 and rho
                const est = estimateCopasParams(yi, sei, gamma0, rho);

                if (est.converged) {
                    results.push({
                        gamma0: gamma0,
                        rho: rho,
                        mu: est.mu,
                        tau: est.tau,
                        loglik: est.loglik,
                        aic: -2 * est.loglik + 8,  // 4 parameters
                        pSelected: est.pSelected
                    });
                }
            }
        }

        // Find best fit by AIC
        results.sort((a, b) => a.aic - b.aic);
        const best = results[0];

        // Guard: if no models converged, return unadjusted result
        if (!best) {
            // Reuse outer-scope yi; compute variances for API call
            const variances = data.map(d => d.vi);
            const unadjustedResult = MetaAnalysis.randomEffects(yi, variances, 'DL');
        

    return {
                unadjusted: {
                    mu: unadjustedResult.effect,
                    tau2: unadjustedResult.tau2
                },
                adjusted: null,
                selectionParams: null,
                fit: null,
                sensitivity: null,
                allResults: [],
                warning: 'No models converged'
            };
        }

        // Calculate adjusted estimate
        const adjustedMu = best.mu;
        const adjustedSE = calculateCopasVariance(yi, sei, best);

        // Sensitivity analysis: how does estimate change with selection strength?
        const sensitivity = analyzeCopaSensitivity(yi, sei, gammaRange);

        // Calculate unadjusted using correct function signature
        const variances = sei.map(s => s * s);
        const unadjustedResult = MetaAnalysis.randomEffects(yi, variances, 'DL');

    

    return {
            unadjusted: {
                mu: unadjustedResult.effect,
                tau2: unadjustedResult.tau2
            },
            adjusted: {
                mu: adjustedMu,
                se: Math.sqrt(adjustedSE),
                tau: best.tau,
                tau2: best.tau * best.tau
            },
            selectionParams: {
                gamma0: best.gamma0,
                rho: best.rho,
                proportionSelected: best.pSelected
            },
            fit: {
                loglik: best.loglik,
                aic: best.aic
            },
            sensitivity: sensitivity,
            allResults: results.slice(0, 20)  // Top 20 models
        };
    }

    function estimateCopasParams(yi, sei, gamma0, rho) {
        const n = yi.length;

        // Calculate selection probabilities
        const pi = sei.map(se => {
            const u = gamma0 + 0.5 / se;  // Probability of selection
            return Statistics.pnorm(u);
        });

        // Check if selection is plausible
        if (Math.min(...pi) < 0.01 || Math.max(...pi) > 0.99) {
        

    return { converged: false };
        }

        // EM algorithm for mu and tau
        let mu = yi.reduce((a, b) => a + b, 0) / n;
        const vi_temp = sei.map(s => s * s);
        let tau = Math.sqrt(MetaAnalysis.tau2DL(yi, vi_temp));

        const maxIter = 100;
        const tol = 1e-6;

        for (let iter = 0; iter < maxIter; iter++) {
            const muOld = mu;
            const tauOld = tau;

            // E-step: calculate expected values under selection
            let sumW = 0;
            let sumWY = 0;
            let sumWSq = 0;

            for (let i = 0; i < n; i++) {
                const sigma2 = sei[i] * sei[i] + tau * tau;
                const sigma = Math.sqrt(sigma2);

                // Selection adjustment
                const z = (yi[i] - mu) / sigma;
                const lambda = lambdaFunc(gamma0 + 0.5 / sei[i], rho, z);

                const wi = 1 / sigma2;
                const yAdj = yi[i] - rho * sigma * lambda;

                sumW += wi;
                sumWY += wi * yAdj;
                sumWSq += wi * Math.pow(yAdj - mu, 2);
            }

            // M-step
            mu = sumW > 0 ? sumWY / sumW : 0;
            tau = sumW > 0 ? Math.sqrt(Math.max(0, sumWSq / n - 1 / sumW)) : 0;

            if (Math.abs(mu - muOld) < tol && Math.abs(tau - tauOld) < tol) {
                break;
            }
        }

        // Calculate log-likelihood
        let loglik = 0;
        for (let i = 0; i < n; i++) {
            const sigma2 = sei[i] * sei[i] + tau * tau;
            loglik -= 0.5 * Math.log(2 * Math.PI * sigma2);
            loglik -= 0.5 * Math.pow(yi[i] - mu, 2) / sigma2;
            loglik += Math.log(pi[i]);  // Selection component
        }

    

    return {
            converged: true,
            mu: mu,
            tau: tau,
            loglik: loglik,
            pSelected: pi.reduce((a, b) => a + b, 0) / n
        };
    }

    function lambdaFunc(a, rho, z) {
        // Hazard function for selection model
        const arg = a + rho * z;
        if (arg > 6) return 0;
        if (arg < -6) return -arg;
        const p = Statistics.pnorm(arg); return p > 0 ? Statistics.dnorm(arg) / p : 0;
    }

    function calculateCopasVariance(yi, sei, params) {
        // Delta method variance
        const n = yi.length;
        let info = 0;

        for (let i = 0; i < n; i++) {
            const sigma2 = sei[i] * sei[i] + params.tau * params.tau;
            info += 1 / sigma2;
        }

        return info > 0 ? 1 / info : Infinity;
    }

    function analyzeCopaSensitivity(yi, sei, gammaRange) {
        // How does adjusted estimate change as selection increases?
        const sensitivity = [];
        const nPoints = 10;

        for (let g = 0; g < nPoints; g++) {
            const gamma0 = gammaRange[0] + g * (gammaRange[1] - gammaRange[0]) / (nPoints - 1);

            // Average selection probability at this gamma
            const avgPi = sei.reduce((sum, se) => {
                return sum + Statistics.pnorm(gamma0 + 0.5 / se);
            }, 0) / sei.length;

            // Estimate with rho = 0.5 (moderate selection-effect correlation)
            const est = estimateCopasParams(yi, sei, gamma0, 0.5);

            if (est.converged) {
                sensitivity.push({
                    gamma0: gamma0,
                    proportionSelected: avgPi,
                    adjustedMu: est.mu,
                    adjustedTau: est.tau
                });
            }
        }

        return sensitivity;
    }

    // ============================================
    // VEVEA-HEDGES WEIGHT FUNCTION MODEL
    // ============================================

    /**
     * Vevea & Hedges (1995) Weight Function Model
     * Models selection as function of p-value
     */
    /**
     * Vevea-Hedges weight-function selection model
     * Reference: Vevea JL, Hedges LV. (1995). A general linear model for
     * estimating effect size in the presence of publication bias.
     * Psychometrika, 60(3), 419-435.
     */
    function veveaHedgesModel(data, options = {}) {
        const {
            steps = [0.025, 0.05, 0.1, 0.5, 1],  // p-value cutpoints
            weights = null,  // If null, estimate weights
            onesided = true
        } = options;

        const yi = data.map(d => d.yi);
        const vi = data.map(d => d.vi);
        const n = yi.length;

        // Calculate p-values for each study
        const pvals = yi.map((y, i) => {
            const z = y / Math.sqrt(vi[i]);
            return onesided ? 1 - Statistics.pnorm(z) : 2 * (1 - Statistics.pnorm(Math.abs(z)));
        });

        // Assign studies to intervals
        const intervals = assignToIntervals(pvals, steps);

        // If weights not provided, estimate them
        let w;
        if (weights) {
            w = weights;
        } else {
            w = estimateVHWeights(yi, vi, intervals, steps);
        }

        // Weighted meta-analysis with selection correction
        const result = weightedMAWithSelection(yi, vi, intervals, w);

        // Likelihood ratio test for selection
        const lrt = likelihoodRatioTest(yi, vi, intervals, w);

    

    return {
            unadjusted: (() => {
                const yiData = data.map(d => d.yi || d.effect);
                const viData = data.map(d => d.vi || d.variance);
                return MetaAnalysis.randomEffects(yiData, viData, 'DL');
            })(),
            adjusted: {
                mu: result.mu,
                se: result.se,
                tau2: result.tau2,
                ci: [result.mu - Statistics.qnorm(0.975) * result.se, result.mu + Statistics.qnorm(0.975) * result.se]
            },
            weights: w,
            steps: steps,
            intervalCounts: countIntervals(intervals, steps.length),
            lrt: lrt,
            interpretation: interpretWeights(w)
        };
    }

    function assignToIntervals(pvals, steps) {
        return pvals.map(p => {
            for (let i = 0; i < steps.length; i++) {
                if (p <= steps[i]) return i;
            }
            return steps.length - 1;
        });
    }

    function countIntervals(intervals, nIntervals) {
        const counts = Array(nIntervals).fill(0);
        intervals.forEach(i => counts[i]++);
        return counts;
    }

    function estimateVHWeights(yi, vi, intervals, steps) {
        const nIntervals = steps.length;
        let w = Array(nIntervals).fill(1);

        // Maximum likelihood estimation of weights
        const maxIter = 100;
        const tol = 1e-6;

        for (let iter = 0; iter < maxIter; iter++) {
            const wOld = [...w];

            // E-step: estimate mu and tau2 given weights
            const { mu, tau2 } = estimateREWithWeights(yi, vi, intervals, w);

            // M-step: update weights
            for (let j = 1; j < nIntervals; j++) {  // w[0] = 1 (reference)
                let sumW = 0;
                let expected = 0;

                yi.forEach((y, i) => {
                    const sigma2 = vi[i] + tau2;
                    if (intervals[i] === j) {
                        sumW += w[j];
                    }
                    // Expected count under no selection
                    const pLow = j === 0 ? 0 : steps[j - 1];
                    const pHigh = steps[j];
                    expected += (pHigh - pLow);  // Simplified
                });

                w[j] = Math.max(0.01, sumW / expected);
            }

            // Normalize (first interval = 1)
            const w0 = w[0];
            w = w.map(wj => wj / w0);

            // Check convergence
            const diff = w.reduce((sum, wj, j) => sum + Math.pow(wj - wOld[j], 2), 0);
            if (diff < tol) break;
        }

        return w;
    }

    function estimateREWithWeights(yi, vi, intervals, w) {
        const n = yi.length;

        // Weighted DL estimator
        let sumW = 0;
        let sumWY = 0;
        let sumWSq = 0;

        yi.forEach((y, i) => {
            const wi = vi[i] > 0 ? w[intervals[i]] / vi[i] : 0;
            sumW += wi;
            sumWY += wi * y;
        });

        const mu = sumW > 0 ? sumWY / sumW : 0;

        yi.forEach((y, i) => {
            const wi = vi[i] > 0 ? w[intervals[i]] / vi[i] : 0;
            sumWSq += wi * Math.pow(y - mu, 2);
        });

        // Simplified tau2 estimation
        const tau2 = Math.max(0, (sumWSq - (n - 1)) / sumW);

    

    return { mu, tau2 };
    }

    function weightedMAWithSelection(yi, vi, intervals, w) {
        const { mu, tau2 } = estimateREWithWeights(yi, vi, intervals, w);

        // Standard error accounting for selection
        let sumW = 0;
        yi.forEach((y, i) => {
            const wi = w[intervals[i]] / (vi[i] + tau2);
            sumW += wi;
        });

        const se = Math.sqrt(1 / sumW);

    

    return { mu, se, tau2 };
    }

    function likelihoodRatioTest(yi, vi, intervals, w) {
        // Test H0: all weights = 1
        const n = yi.length;

        // Log-likelihood under H1 (estimated weights)
        const { mu: mu1, tau2: tau21 } = estimateREWithWeights(yi, vi, intervals, w);
        let ll1 = 0;
        yi.forEach((y, i) => {
            const sigma2 = vi[i] + tau21;
            ll1 -= 0.5 * Math.log(2 * Math.PI * sigma2);
            ll1 -= 0.5 * Math.pow(y - mu1, 2) / sigma2;
            ll1 += Math.log(w[intervals[i]]);
        });

        // Log-likelihood under H0 (no selection)
        const wNull = Array(w.length).fill(1);
        const { mu: mu0, tau2: tau20 } = estimateREWithWeights(yi, vi, intervals, wNull);
        let ll0 = 0;
        yi.forEach((y, i) => {
            const sigma2 = vi[i] + tau20;
            ll0 -= 0.5 * Math.log(2 * Math.PI * sigma2);
            ll0 -= 0.5 * Math.pow(y - mu0, 2) / sigma2;
        });

        const lrt = 2 * (ll1 - ll0);
        const df = w.length - 1;
        const pvalue = 1 - Statistics.pchisq(Math.max(0, lrt), df);

    

    return { statistic: lrt, df: df, pvalue: pvalue };
    }

    function interpretWeights(w) {
        const interpretations = [];
        for (let i = 1; i < w.length; i++) {
            if (w[i] < 0.5) {
                interpretations.push(`Interval ${i}: Strong selection (${((1-w[i])*100).toFixed(0)}% suppressed)`);
            } else if (w[i] < 0.8) {
                interpretations.push(`Interval ${i}: Moderate selection`);
            } else if (w[i] > 1.2) {
                interpretations.push(`Interval ${i}: Possible inflation`);
            }
        }
        return interpretations;
    }

    // ============================================
    // THREE-PARAMETER SELECTION MODEL (3PSM)
    // ============================================

    /**
     * Three-Parameter Selection Model
     * McShane, Böckenholt & Hansen (2016)
     */
    function threeParameterSM(data, options = {}) {
        const {
            alpha = 0.05,  // Significance threshold
            onesided = true
        } = options;

        const yi = data.map(d => d.yi);
        const vi = data.map(d => d.vi);
        const n = yi.length;

        // Classify studies as significant or not
        const pvals = yi.map((y, i) => {
            const z = y / Math.sqrt(vi[i]);
            return onesided ? 1 - Statistics.pnorm(z) : 2 * (1 - Statistics.pnorm(Math.abs(z)));
        });
        const significant = pvals.map(p => p < alpha);

        // Maximum likelihood estimation
        // Parameters: mu, tau2, eta (selection probability ratio)
        const result = estimate3PSM(yi, vi, significant, alpha, onesided);

        // Sensitivity analysis over eta
        const sensitivity = [];
        for (let eta = 0.1; eta <= 1; eta += 0.1) {
            const res = estimate3PSMFixed(yi, vi, significant, eta, alpha, onesided);
            sensitivity.push({
                eta: eta,
                mu: res.mu,
                tau2: res.tau2
            });
        }

    

    return {
            unadjusted: (() => {
                const yiData = data.map(d => d.yi || d.effect);
                const viData = data.map(d => d.vi || d.variance);
                return MetaAnalysis.randomEffects(yiData, viData, 'DL');
            })(),
            adjusted: {
                mu: result.mu,
                se: result.se,
                tau2: result.tau2,
                eta: result.eta,
                ci: [result.mu - Statistics.qnorm(0.975) * result.se, result.mu + Statistics.qnorm(0.975) * result.se]
            },
            nSignificant: significant.filter(s => s).length,
            nTotal: n,
            proportionSignificant: significant.filter(s => s).length / n,
            fit: {
                loglik: result.loglik,
                aic: result.aic,
                bic: result.bic
            },
            lrt: result.lrt,
            sensitivity: sensitivity
        };
    }

    function estimate3PSM(yi, vi, significant, alpha, onesided) {
        const n = yi.length;

        // Grid search for eta, then optimize mu and tau2
        let bestResult = null;
        let bestLoglik = -Infinity;

        for (let eta = 0.05; eta <= 1; eta += 0.05) {
            const result = estimate3PSMFixed(yi, vi, significant, eta, alpha, onesided);

            if (result.loglik > bestLoglik) {
                bestLoglik = result.loglik;
                bestResult = { ...result, eta: eta };
            }
        }

        // Refine with continuous optimization
        const refinedEta = goldenSectionMin((eta) => {
            const res = estimate3PSMFixed(yi, vi, significant, eta, alpha, onesided);
            return -res.loglik;
        }, Math.max(0.01, bestResult.eta - 0.1), Math.min(1, bestResult.eta + 0.1));

        const finalResult = estimate3PSMFixed(yi, vi, significant, refinedEta, alpha, onesided);

        // Standard errors via observed information
        const se = calculate3PSMSE(yi, vi, significant, refinedEta, finalResult.mu, finalResult.tau2);

        // LRT for selection (H0: eta = 1)
        const nullResult = estimate3PSMFixed(yi, vi, significant, 1, alpha, onesided);
        const lrtStat = 2 * (finalResult.loglik - nullResult.loglik);
        const lrtPval = 1 - Statistics.pchisq(Math.max(0, lrtStat), 1);

    

    return {
            mu: finalResult.mu,
            tau2: finalResult.tau2,
            eta: refinedEta,
            se: se,
            loglik: finalResult.loglik,
            aic: -2 * finalResult.loglik + 6,
            bic: -2 * finalResult.loglik + 3 * Math.log(n),
            lrt: { statistic: lrtStat, pvalue: lrtPval }
        };
    }

    function estimate3PSMFixed(yi, vi, significant, eta, alpha, onesided) {
        const n = yi.length;

        // EM algorithm for mu and tau2 given eta
        let mu = yi.reduce((a, b) => a + b, 0) / n;
        let tau2 = vi.reduce((a, b) => a + b, 0) / n;

        for (let iter = 0; iter < 50; iter++) {
            const muOld = mu;
            const tau2Old = tau2;

            // Calculate weights accounting for selection
            let sumW = 0;
            let sumWY = 0;
            let sumWR = 0;

            yi.forEach((y, i) => {
                const sigma2 = vi[i] + tau2;
                const wi = 1 / sigma2;
                const selectionProb = significant[i] ? 1 : eta;

                sumW += wi * selectionProb;
                sumWY += wi * selectionProb * y;
                sumWR += wi * selectionProb * Math.pow(y - mu, 2);
            });

            mu = sumW > 0 ? sumWY / sumW : 0;
            tau2 = Math.max(0, sumWR / n - 1 / sumW);

            if (Math.abs(mu - muOld) < 1e-6 && Math.abs(tau2 - tau2Old) < 1e-6) break;
        }

        // Log-likelihood
        let loglik = 0;
        yi.forEach((y, i) => {
            const sigma2 = vi[i] + tau2;
            loglik -= 0.5 * Math.log(2 * Math.PI * sigma2);
            loglik -= 0.5 * Math.pow(y - mu, 2) / sigma2;
            loglik += Math.log(significant[i] ? 1 : eta);
        });

    

    return { mu, tau2, loglik };
    }

    function calculate3PSMSE(yi, vi, significant, eta, mu, tau2) {
        // Numerical approximation of SE via finite differences
        const h = 1e-5;

        const loglikMu = (m) => {
            let ll = 0;
            yi.forEach((y, i) => {
                const sigma2 = vi[i] + tau2;
                ll -= 0.5 * Math.pow(y - m, 2) / sigma2;
            });
            return ll;
        };

        const d2 = (loglikMu(mu + h) - 2 * loglikMu(mu) + loglikMu(mu - h)) / (h * h);
        // d2 should be negative for log-likelihood concavity; guard against positive/zero
        return d2 < 0 ? Math.sqrt(-1 / d2) : Infinity;
    }

    // ============================================
    // PET-PEESE
    // ============================================

    /**
     * PET-PEESE (Stanley & Doucouliagos)
     * Precision-Effect Test / Precision-Effect Estimate with Standard Error
     */
    function petPeese(data, options = {}) {
        const {
            petCutoff = 0.10  // p-value cutoff to switch from PET to PEESE
        } = options;

        const yi = data.map(d => d.yi);
        const vi = data.map(d => d.vi);
        const sei = vi.map(v => Math.sqrt(v));
        const n = yi.length;

        // PET: regress effect on SE (weighted by precision)
        const pet = wlsRegression(yi, sei, vi.map(v => 1/v), true);

        // PEESE: regress effect on variance
        const peese = wlsRegression(yi, vi, vi.map(v => 1/v), true);

        // Conditional estimate
        const usePeese = pet.pvalue < petCutoff;
        const conditional = usePeese ? peese : pet;

        // FAT-PET-PEESE interpretation
        let interpretation;
        if (pet.pvalue >= 0.10) {
            interpretation = 'No evidence of publication bias (FAT p >= 0.10)';
        } else if (pet.interceptPvalue >= 0.10) {
            interpretation = 'Publication bias detected, but no genuine effect (PET intercept p >= 0.10)';
        } else {
            interpretation = 'Both publication bias and genuine effect detected';
        }

    

    return {
            pet: {
                intercept: pet.intercept,
                interceptSE: pet.interceptSE,
                interceptPvalue: pet.interceptPvalue,
                slope: pet.slope,
                slopeSE: pet.slopeSE,
                slopePvalue: pet.pvalue,
                r2: pet.r2
            },
            peese: {
                intercept: peese.intercept,
                interceptSE: peese.interceptSE,
                interceptPvalue: peese.interceptPvalue,
                slope: peese.slope,
                slopeSE: peese.slopeSE,
                slopePvalue: peese.pvalue,
                r2: peese.r2
            },
            conditional: {
                method: usePeese ? 'PEESE' : 'PET',
                estimate: conditional.intercept,
                se: conditional.interceptSE,
                pvalue: conditional.interceptPvalue,
                ci: [conditional.intercept - Statistics.qnorm(0.975) * conditional.interceptSE,
                     conditional.intercept + Statistics.qnorm(0.975) * conditional.interceptSE]
            },
            interpretation: interpretation
        };
    }

    function wlsRegression(y, x, w, returnFull = false) {
        const n = y.length;

        // Need at least 3 observations for meaningful regression with SE
        if (n < 3) {
            console.warn('wlsRegression: Need at least 3 observations for valid standard errors');
            return {
                intercept: NaN, interceptSE: Infinity, interceptPvalue: 1,
                slope: NaN, slopeSE: Infinity, pvalue: 1, r2: 0
            };
        }

        // Weighted means
        const sumW = w.reduce((a, b) => a + b, 0);
        const meanY = y.reduce((s, yi, i) => s + w[i] * yi, 0) / sumW;
        const meanX = x.reduce((s, xi, i) => s + w[i] * xi, 0) / sumW;

        // Weighted covariance and variance
        let covXY = 0;
        let varX = 0;
        let varY = 0;

        for (let i = 0; i < n; i++) {
            covXY += w[i] * (x[i] - meanX) * (y[i] - meanY);
            varX += w[i] * Math.pow(x[i] - meanX, 2);
            varY += w[i] * Math.pow(y[i] - meanY, 2);
        }

        const slope = varX !== 0 ? covXY / varX : 0;
        const intercept = meanY - slope * meanX;

        // Residuals and MSE
        let ssr = 0;
        let sst = 0;
        for (let i = 0; i < n; i++) {
            const pred = intercept + slope * x[i];
            ssr += w[i] * Math.pow(y[i] - pred, 2);
            sst += w[i] * Math.pow(y[i] - meanY, 2);
        }
        const mse = (n - 2) > 0 ? ssr / (n - 2) : ssr;
        const r2 = sst !== 0 ? 1 - ssr / sst : 0;

        // Standard errors (guard against varX === 0 and sumW === 0)
        const slopeVar = varX > 0 ? mse / varX : 0;
        const interceptVar = (varX > 0 && sumW > 0) ? mse * (1/sumW + meanX * meanX / varX) : 0;

        const slopeSE = Math.sqrt(slopeVar);
        const interceptSE = Math.sqrt(interceptVar);

        // t-tests
        const tSlope = slopeSE > 0 ? slope / slopeSE : 0;
        const tIntercept = interceptSE > 0 ? intercept / interceptSE : 0;
        const pSlope = 2 * (1 - Statistics.pt(Math.abs(tSlope), n - 2));
        const pIntercept = 2 * (1 - Statistics.pt(Math.abs(tIntercept), n - 2));

    

    return {
            intercept: intercept,
            interceptSE: interceptSE,
            interceptPvalue: pIntercept,
            slope: slope,
            slopeSE: slopeSE,
            pvalue: pSlope,
            r2: r2
        };
    }

    // ============================================
    // LIMIT META-ANALYSIS
    // ============================================

    /**
     * Limit Meta-Analysis (Rücker et al. 2011)
     * Extrapolates to infinite precision
     */
    function limitMetaAnalysis(data, options = {}) {
        const {
            method = 'MM'  // 'MM' or 'ML'
        } = options;

        const yi = data.map(d => d.yi);
        const vi = data.map(d => d.vi);
        const sei = vi.map(v => Math.sqrt(v));
        const n = yi.length;

        // Fit random-effects model
        const yi_limit = data.map(d => d.yi || d.effect);
        const vi_limit = data.map(d => d.vi || d.variance);
        const re = MetaAnalysis.randomEffects(yi_limit, vi_limit, 'DL');
        const tau2 = re.tau2;

        // Weighted regression: y on 1/sqrt(v + tau2)
        const x = vi.map(v => 1 / Math.sqrt(v + tau2));
        const w = vi.map(v => 1 / (v + tau2));

        // Calculate weighted means
        const sumW = w.reduce((a, b) => a + b, 0);
        const meanY = yi.reduce((s, y, i) => s + w[i] * y, 0) / sumW;
        const meanX = x.reduce((s, xi, i) => s + w[i] * xi, 0) / sumW;

        // Regression coefficients
        let cov = 0, varX = 0;
        for (let i = 0; i < n; i++) {
            cov += w[i] * (x[i] - meanX) * (yi[i] - meanY);
            varX += w[i] * Math.pow(x[i] - meanX, 2);
        }
        const beta1 = varX !== 0 ? cov / varX : 0;
        const beta0 = meanY - beta1 * meanX;  // Limit estimate (at x=0)

        // Standard error of limit estimate
        let sse = 0;
        for (let i = 0; i < n; i++) {
            const pred = beta0 + beta1 * x[i];
            sse += w[i] * Math.pow(yi[i] - pred, 2);
        }
        const mse = (n - 2) > 0 ? sse / (n - 2) : sse;
        const seBeta0 = (varX > 0 && sumW > 0) ? Math.sqrt(mse * (1/sumW + meanX*meanX/varX)) : 0;

        // Test for small-study effects
        const seBeta1 = varX > 0 ? Math.sqrt(mse / varX) : 0;
        const tBeta1 = seBeta1 > 0 ? beta1 / seBeta1 : 0;
        const pBeta1 = 2 * (1 - Statistics.pt(Math.abs(tBeta1), n - 2));

        // Adjusted estimator (shrinkage)
        const denom = mse * sumW;
        const adjFactor = denom > 0 ? 1 / (1 + beta1 * beta1 * varX / denom) : 1;
        const adjEstimate = re.effect + adjFactor * (beta0 - re.effect);

    

    return {
            unadjusted: {
                estimate: re.effect,
                se: re.se,
                tau2: tau2
            },
            limit: {
                estimate: beta0,
                se: seBeta0,
                ci: [beta0 - Statistics.qnorm(0.975) * seBeta0, beta0 + Statistics.qnorm(0.975) * seBeta0]
            },
            adjusted: {
                estimate: adjEstimate,
                shrinkageFactor: adjFactor
            },
            smallStudyTest: {
                coefficient: beta1,
                tstat: tBeta1,
                pvalue: pBeta1
            }
        };
    }

    // ============================================
    // P-UNIFORM / P-UNIFORM*
    // ============================================

    /**
     * p-uniform and p-uniform*
     * Van Assen, van Aert & Wicherts (2015)
     */
    function pUniform(data, options = {}) {
        const {
            alpha = 0.05,
            onesided = true,
            method = 'puniform*'  // 'puniform' or 'puniform*'
        } = options;

        const yi = data.map(d => d.yi);
        const vi = data.map(d => d.vi);
        const sei = vi.map(v => Math.sqrt(v));
        const n = yi.length;

        // Calculate p-values and select significant studies
        const results = yi.map((y, i) => {
            const z = sei[i] > 0 ? y / sei[i] : 0;
            const p = onesided ? 1 - Statistics.pnorm(z) : 2 * (1 - Statistics.pnorm(Math.abs(z)));
        

    return { yi: y, vi: vi[i], sei: sei[i], z: z, p: p, sig: p < alpha };
        });

        const sigStudies = results.filter(r => r.sig);
        const nSig = sigStudies.length;

        if (nSig === 0) {
            // Return consistent API with NaN values
            return {
                estimate: NaN,
                se: NaN,
                ci: [NaN, NaN],
                nSignificant: 0,
                nTotal: n,
                method: method,
                error: 'No significant studies found',
                publicationBiasTest: { ks: NaN, pvalue: NaN }
            };
        }

        // p-uniform: estimate effect using only significant studies
        // Conditional p-values (p | p < alpha)
        let estimate;
        if (method === 'puniform*') {
            estimate = pUniformStar(sigStudies, alpha, onesided);
        } else {
            estimate = pUniformBasic(sigStudies, alpha, onesided);
        }

        // Publication bias test: are conditional p-values uniform?
        const condP = sigStudies.map(s => s.p / alpha);
        const ksTest = kolmogorovSmirnovTest(condP);

    

    return {
            estimate: estimate.mu,
            se: estimate.se,
            ci: [estimate.mu - Statistics.qnorm(0.975) * estimate.se, estimate.mu + Statistics.qnorm(0.975) * estimate.se],
            nSignificant: nSig,
            nTotal: n,
            method: method,
            publicationBiasTest: {
                ks: ksTest.statistic,
                pvalue: ksTest.pvalue
            }
        };
    }

    function pUniformBasic(sigStudies, alpha, onesided) {
        // Simple p-uniform: median conditional p-value
        const nSig = sigStudies.length;

        // Find mu such that median conditional p = 0.5
        const targetMedian = 0.5;

        const objective = (mu) => {
            const condP = sigStudies.map(s => {
                const z = (s.yi - mu) / s.sei;
                const p = onesided ? 1 - Statistics.pnorm(z) : 2 * (1 - Statistics.pnorm(Math.abs(z)));
                const pCrit = onesided ? Statistics.qnorm(1 - alpha) : Statistics.qnorm(1 - alpha/2);
                const pCond = p / alpha;  // Simplified
                return pCond;
            });
            condP.sort((a, b) => a - b);
            const mid = Math.floor(nSig / 2);
            const median = nSig % 2 === 0 ?
                (condP[mid - 1] + condP[mid]) / 2 :
                condP[mid];
            return Math.pow(median - targetMedian, 2);
        };

        const mu = goldenSectionMin(objective, -5, 5);

        // Bootstrap SE (using seedable PRNG for reproducibility)
        const bootstrapMu = [];
        for (let b = 0; b < 1000; b++) {
            const sample = [];
            for (let i = 0; i < nSig; i++) {
                sample.push(sigStudies[Math.floor(random() * nSig)]);
            }
            const bMu = goldenSectionMin((m) => {
                const condP = sample.map(s => {
                    const z = (s.yi - m) / s.sei;
                    return (1 - Statistics.pnorm(z)) / alpha;
                });
                condP.sort((a, b) => a - b);
                const med = condP[Math.floor(nSig/2)];
                return Math.pow(med - 0.5, 2);
            }, -5, 5);
            bootstrapMu.push(bMu);
        }

        // Use (n-1) for unbiased variance estimation (Bessel's correction)
        const se = Math.sqrt(bootstrapMu.reduce((s, m) => s + Math.pow(m - mu, 2), 0) / Math.max(1, bootstrapMu.length - 1));

    

    return { mu, se };
    }

    function pUniformStar(sigStudies, alpha, onesided) {
        // p-uniform*: uses likelihood approach
        const nSig = sigStudies.length;

        // Maximize likelihood under selection
        const loglik = (mu) => {
            let ll = 0;
            sigStudies.forEach(s => {
                const z = (s.yi - mu) / s.sei;
                // Truncated normal likelihood
                ll += Math.log(Statistics.dnorm(z, 0, 1));  // log density
                // Guard against log(0) when truncation prob approaches 0
                const truncProb = 1 - Statistics.pnorm(Statistics.qnorm(1 - alpha) - mu / s.sei);
                ll -= Math.log(Math.max(1e-300, truncProb));  // Truncation (mu-dependent)
            });
            return ll;
        };

        const mu = goldenSectionMin((m) => -loglik(m), -5, 5);

        // Fisher information for SE
        let info = 0;
        sigStudies.forEach(s => {
            info += 1 / (s.vi);
        });
        const se = Math.sqrt(1 / info);

    

    return { mu, se };
    }

    function kolmogorovSmirnovTest(x) {
        // Test if x ~ Uniform(0,1)
        // Sort a copy to avoid mutating input array
        const sorted = [...x].sort((a, b) => a - b);
        const n = sorted.length;

        let dPlus = 0;
        let dMinus = 0;

        for (let i = 0; i < n; i++) {
            const empirical = (i + 1) / n;
            const theoretical = sorted[i];
            dPlus = Math.max(dPlus, empirical - theoretical);
            dMinus = Math.max(dMinus, theoretical - (i / n));
        }

        const d = Math.max(dPlus, dMinus);

        // Approximate p-value
        const sqrtN = Math.sqrt(n);
        const lambda = (sqrtN + 0.12 + 0.11 / sqrtN) * d;
        let pvalue = 0;
        for (let k = 1; k <= 100; k++) {
            pvalue += 2 * Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambda * lambda);
        }
        pvalue = Math.max(0, Math.min(1, pvalue));

    

    return { statistic: d, pvalue: pvalue };
    }

    // ============================================
    // SELECTION MODEL AVERAGING
    // ============================================

    /**
     * Selection Model Averaging
     * Combines multiple selection models using model averaging
     */
    function selectionModelAveraging(data, options = {}) {
        const {
            models = ['none', '3psm', 'vevea', 'petpeese']
        } = options;

        const results = [];
        let totalWeight = 0;

        // Fit each model and calculate weights (based on AIC)
        if (models.includes('none')) {
            const yi_limit = data.map(d => d.yi || d.effect);
        const vi_limit = data.map(d => d.vi || d.variance);
        const re = MetaAnalysis.randomEffects(yi_limit, vi_limit, 'DL');
            const n = data.length;
            const aic = n * Math.log(re.tau2 + 0.001) + 2 * 2;  // 2 parameters
            results.push({
                model: 'Random Effects (no adjustment)',
                estimate: re.effect,
                se: re.se,
                aic: aic,
                weight: 0
            });
        }

        if (models.includes('3psm')) {
            try {
                const res = threeParameterSM(data);
                results.push({
                    model: 'Three-Parameter Selection Model',
                    estimate: res.adjusted.mu,
                    se: res.adjusted.se,
                    aic: res.fit.aic,
                    weight: 0
                });
            } catch (e) {}
        }

        if (models.includes('vevea')) {
            try {
                const res = veveaHedgesModel(data);
                results.push({
                    model: 'Vevea-Hedges Selection Model',
                    estimate: res.adjusted.mu,
                    se: res.adjusted.se,
                    aic: NaN,  // No standard AIC for this model
                    weight: 0
                });
            } catch (e) {}
        }

        if (models.includes('petpeese')) {
            try {
                const res = petPeese(data);
                results.push({
                    model: 'PET-PEESE',
                    estimate: res.conditional.estimate,
                    se: res.conditional.se,
                    aic: NaN,  // No AIC for regression approach
                    weight: 0
                });
            } catch (e) {}
        }

        // Calculate Akaike weights
        const aics = results.filter(r => !isNaN(r.aic)).map(r => r.aic);
        if (aics.length > 0) {
            const minAIC = Math.min(...aics);
            let sumExp = 0;

            results.forEach(r => {
                if (!isNaN(r.aic)) {
                    r.deltaAIC = r.aic - minAIC;
                    r.expWeight = Math.exp(-0.5 * r.deltaAIC);
                    sumExp += r.expWeight;
                } else {
                    r.deltaAIC = NaN;
                    r.expWeight = 0;
                }
            });

            results.forEach(r => {
                r.weight = r.expWeight / sumExp;
            });
        }

        // Model-averaged estimate
        let avgEstimate = 0;
        let avgVariance = 0;

        results.forEach(r => {
            avgEstimate += r.weight * r.estimate;
        });

        // Variance includes within-model and between-model components
        results.forEach(r => {
            avgVariance += r.weight * (r.se * r.se + Math.pow(r.estimate - avgEstimate, 2));
        });

    

    return {
            models: results,
            averaged: {
                estimate: avgEstimate,
                se: Math.sqrt(avgVariance),
                ci: [avgEstimate - Statistics.qnorm(0.975) * Math.sqrt(avgVariance),
                     avgEstimate + Statistics.qnorm(0.975) * Math.sqrt(avgVariance)]
            }
        };
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function goldenSectionMin(f, a, b, tol = 1e-6) {
        const gr = (Math.sqrt(5) - 1) / 2;
        let c = b - gr * (b - a);
        let d = a + gr * (b - a);

        while (Math.abs(b - a) > tol) {
            if (f(c) < f(d)) {
                b = d;
                d = c;
                c = b - gr * (b - a);
            } else {
                a = c;
                c = d;
                d = a + gr * (b - a);
            }
        }

        return (a + b) / 2;
    }

    // ============================================
    // PUBLIC API
    // ============================================


    // ============================================
    // MULTI-MODEL INFERENCE
    // Reference: Burnham KP, Anderson DR. (2002). Model Selection and
    // Multimodel Inference. Springer.
    // ============================================

    /**
     * Multi-model inference for publication bias adjustment
     * Combines estimates from multiple selection models
     */
    function multiModelInference(data, options = {}) {
        const {
            models = ['unadjusted', 'trimFill', 'petPeese', 'copas', '3psm'],
            weights = 'aic',  // 'aic', 'bic', or 'equal'
            alpha = 0.05
        } = options;

        const yi = data.map(d => d.yi || d.effect);
        const vi = data.map(d => d.vi || d.variance);
        const sei = vi.map(v => Math.sqrt(v));

        const results = {};
        const aicValues = [];
        const estimates = [];

        // Fit each model
        models.forEach(model => {
            try {
                let result;
                switch (model) {
                    case 'unadjusted':
                        result = MetaAnalysis.randomEffects(yi, vi, 'REML');
                        results[model] = {
                            estimate: result.effect,
                            se: result.se,
                            aic: calculateAIC(yi, vi, result.effect, result.tau2, 2)
                        };
                        break;
                    case 'trimFill':
                        result = MetaAnalysis.trimAndFill(yi, vi);
                        if (result.adjustedSE) {
                            results[model] = {
                                estimate: result.adjustedEffect,
                                se: result.adjustedSE,
                                aic: calculateAIC(yi, vi, result.adjustedEffect, 0, 3)
                            };
                        } else {
                            console.warn('trimFill: SE unavailable, skipping model in averaging');
                        }
                        break;
                    case 'petPeese':
                        result = petPeese(data);
                        if (result.conditional && result.conditional.se) {
                            results[model] = {
                                estimate: result.conditional.estimate,
                                se: result.conditional.se,
                                aic: calculateAIC(yi, vi, result.conditional.estimate, 0, 2)
                            };
                        }
                        break;
                    case 'copas':
                        result = copasSelectionModel(data);
                        if (result.adjusted && result.adjusted.se) {
                            results[model] = {
                                estimate: result.adjusted.mu,
                                se: result.adjusted.se,
                                aic: result.fit ? result.fit.aic : Infinity
                            };
                        }
                        break;
                    case '3psm':
                        result = threeParameterSM(data);
                        // Only include if SE is available (no fabricated fallbacks)
                        if (result.adjusted && result.adjusted.se) {
                            results[model] = {
                                estimate: result.adjusted.mu,
                                se: result.adjusted.se,
                                aic: result.fit ? result.fit.aic : Infinity
                            };
                        } else {
                            console.warn('3PSM: SE unavailable, skipping model in averaging');
                        }
                        break;
                }

                if (results[model]) {
                    aicValues.push({ model, aic: results[model].aic });
                    estimates.push({ model, estimate: results[model].estimate, se: results[model].se });
                }
            } catch (e) {
                console.warn(`Model ${model} failed: ${e.message}`);
            }
        });

        // Need at least one model to proceed
        if (estimates.length === 0) {
            return { error: 'No models produced valid results' };
        }

        // Calculate model weights
        let modelWeights;
        if (weights === 'equal') {
            const n = estimates.length;
            modelWeights = estimates.map(e => ({ model: e.model, weight: 1/n }));
        } else {
            // AIC weights (Akaike weights)
            const minAIC = Math.min(...aicValues.map(a => a.aic));
            const deltaAIC = aicValues.map(a => ({ model: a.model, delta: a.aic - minAIC }));
            const expDeltas = deltaAIC.map(d => ({ model: d.model, exp: Math.exp(-0.5 * d.delta) }));
            const sumExp = expDeltas.reduce((s, e) => s + e.exp, 0);
            modelWeights = expDeltas.map(e => ({ model: e.model, weight: e.exp / sumExp }));
        }

        // Model-averaged estimate
        let avgEstimate = 0;
        let avgVariance = 0;

        estimates.forEach(est => {
            const w = modelWeights.find(m => m.model === est.model).weight;
            avgEstimate += w * est.estimate;
        });

        // Unconditional variance (accounts for model uncertainty)
        estimates.forEach(est => {
            const w = modelWeights.find(m => m.model === est.model).weight;
            // SE is guaranteed non-null since we skip models without it
            const se = est.se;
            // Variance = weighted sum of (variance + squared deviation from avg)
            avgVariance += w * (se * se + Math.pow(est.estimate - avgEstimate, 2));
        });

        // Use proper critical value instead of hardcoded 1.96
        const zCrit = Statistics.qnorm(1 - alpha / 2);

        return {
            modelAveraged: {
                estimate: avgEstimate,
                se: Math.sqrt(avgVariance),
                ci: {
                    lower: avgEstimate - zCrit * Math.sqrt(avgVariance),
                    upper: avgEstimate + zCrit * Math.sqrt(avgVariance)
                }
            },
            individualModels: results,
            weights: modelWeights,
            aicValues: aicValues,
            method: 'Multi-model inference (Burnham & Anderson 2002)'
        };
    }

    function calculateAIC(yi, vi, mu, tau2, nParams) {
        let logLik = 0;
        for (let i = 0; i < yi.length; i++) {
            const v = vi[i] + tau2;
            logLik += -0.5 * Math.log(2 * Math.PI * v) - 0.5 * Math.pow(yi[i] - mu, 2) / v;
        }
        return -2 * logLik + 2 * nParams;
    }

    return {
        // Seedable PRNG for reproducibility
        setSeed,
        clearSeed,

        // Selection models
        copasSelectionModel,
        multiModelInference,
        veveaHedgesModel,
        threeParameterSM,
        petPeese,
        limitMetaAnalysis,
        pUniform,
        selectionModelAveraging
    };

})();

// Export for Node.js if applicable
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectionModels;
}
