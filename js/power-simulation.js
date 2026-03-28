/**
 * Power Analysis and Simulation for Meta-Analysis
 * Essential tools for methodologists and study planning
 * - Power calculation for meta-analysis
 * - Sample size estimation
 * - Simulation mode for method validation
 * - Monte Carlo studies
 * - Method comparison via simulation
 */

const PowerSimulation = (function() {
    'use strict';

    // Module dependency checks
    if (typeof Statistics === 'undefined') {
        throw new Error('Statistics module must be loaded before PowerSimulation');
    }
    if (typeof MetaAnalysis === 'undefined') {
        throw new Error('MetaAnalysis module must be loaded before PowerSimulation');
    }
    // SelectionModels is optional - checked at runtime where used

    // ============================================
    // Seedable PRNG for reproducibility
    // (xoshiro128** algorithm)
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
    // POWER ANALYSIS FOR META-ANALYSIS
    // ============================================

    /**
     * Calculate power for meta-analysis
     * Based on Hedges & Pigott (2001), Valentine et al. (2010)
     */
    function calculatePower(options = {}) {
        const {
            k,              // Number of studies
            n = null,       // Average sample size per study (if not providing variances)
            trueEffect,     // True effect size (d, r, or log-transformed)
            tau2 = 0,       // Between-study variance
            alpha = 0.05,   // Significance level
            testType = 'two-tailed',
            effectType = 'd',  // 'd', 'r', 'logOR', 'logHR'
            variances = null   // Array of within-study variances
        } = options;

        // Calculate average within-study variance
        let avgV;
        if (variances && variances.length > 0) {
            avgV = variances.reduce((a, b) => a + b, 0) / variances.length;
        } else if (n) {
            avgV = estimateWithinVariance(n, effectType);
        } else {
            throw new Error('Must provide either variances or n');
        }

        // Total variance of pooled estimate
        const totalVar = (avgV + tau2) / k;

        // Non-centrality parameter
        const ncp = Math.abs(trueEffect) / Math.sqrt(totalVar);

        // Critical value
        const zCrit = testType === 'two-tailed' ?
            Statistics.qnorm(1 - alpha / 2) :
            Statistics.qnorm(1 - alpha);

        // Power
        let power;
        if (testType === 'two-tailed') {
            power = 1 - Statistics.pnorm(zCrit - ncp) + Statistics.pnorm(-zCrit - ncp);
        } else {
            power = 1 - Statistics.pnorm(zCrit - ncp);
        }

        return {
            power: power,
            k: k,
            trueEffect: trueEffect,
            tau2: tau2,
            avgWithinVariance: avgV,
            pooledSE: Math.sqrt(totalVar),
            ncp: ncp,
            zCrit: zCrit,
            alpha: alpha,
            testType: testType
        };
    }

    function estimateWithinVariance(n, effectType) {
        switch (effectType) {
            case 'd':
                // Cohen's d: V ≈ (n1 + n2) / (n1 * n2) + d² / (2 * (n1 + n2))
                // Simplified assuming equal groups
                return 4 / n + 0.5 / n;  // Approximate for d around 0.5
            case 'r':
                // Correlation: V ≈ (1 - r²)² / (n - 3)
                return (n - 3) > 0 ? 1 / (n - 3) : 1;  // Approximate for Fisher z
            case 'logOR':
            case 'logRR':
                // Log odds/risk ratio: depends on proportions
                return 4 / n;  // Rough approximation
            case 'logHR':
                // Log hazard ratio: V ≈ 4 / d (d = number of events)
                return 4 / (n * 0.3);  // Assuming 30% event rate
            default:
                return 4 / n;
        }
    }

    /**
     * Calculate required number of studies for desired power
     */
    function requiredStudies(options = {}) {
        const {
            targetPower = 0.80,
            n = 50,         // Average sample size
            trueEffect,
            tau2 = 0,
            alpha = 0.05,
            testType = 'two-tailed',
            effectType = 'd'
        } = options;

        // Binary search for k
        let kLow = 2;
        let kHigh = 1000;

        while (kHigh - kLow > 1) {
            const kMid = Math.floor((kLow + kHigh) / 2);
            const power = calculatePower({
                k: kMid, n, trueEffect, tau2, alpha, testType, effectType
            }).power;

            if (power < targetPower) {
                kLow = kMid;
            } else {
                kHigh = kMid;
            }
        }

        // Final check
        const finalPower = calculatePower({
            k: kHigh, n, trueEffect, tau2, alpha, testType, effectType
        }).power;

        return {
            requiredStudies: kHigh,
            achievedPower: finalPower,
            targetPower: targetPower,
            trueEffect: trueEffect,
            tau2: tau2,
            avgN: n
        };
    }

    /**
     * Calculate required sample size per study
     */
    function requiredSampleSize(options = {}) {
        const {
            targetPower = 0.80,
            k,              // Number of studies
            trueEffect,
            tau2 = 0,
            alpha = 0.05,
            testType = 'two-tailed',
            effectType = 'd'
        } = options;

        // Binary search for n
        let nLow = 10;
        let nHigh = 10000;

        while (nHigh - nLow > 1) {
            const nMid = Math.floor((nLow + nHigh) / 2);
            const power = calculatePower({
                k, n: nMid, trueEffect, tau2, alpha, testType, effectType
            }).power;

            if (power < targetPower) {
                nLow = nMid;
            } else {
                nHigh = nMid;
            }
        }

        const finalPower = calculatePower({
            k, n: nHigh, trueEffect, tau2, alpha, testType, effectType
        }).power;

        return {
            requiredN: nHigh,
            achievedPower: finalPower,
            targetPower: targetPower,
            k: k,
            trueEffect: trueEffect,
            tau2: tau2
        };
    }

    /**
     * Generate power curve
     */
    function powerCurve(options = {}) {
        const {
            kRange = [2, 50],
            nRange = [20, 200],
            trueEffect,
            tau2Values = [0, 0.1, 0.25],
            alpha = 0.05,
            testType = 'two-tailed',
            effectType = 'd',
            curveType = 'studies'  // 'studies' or 'sampleSize'
        } = options;

        const curves = [];

        tau2Values.forEach(tau2 => {
            const points = [];

            if (curveType === 'studies') {
                for (let k = kRange[0]; k <= kRange[1]; k++) {
                    const power = calculatePower({
                        k, n: 50, trueEffect, tau2, alpha, testType, effectType
                    }).power;
                    points.push({ x: k, power: power });
                }
            } else {
                for (let n = nRange[0]; n <= nRange[1]; n += 10) {
                    const power = calculatePower({
                        k: 10, n, trueEffect, tau2, alpha, testType, effectType
                    }).power;
                    points.push({ x: n, power: power });
                }
            }

            curves.push({
                tau2: tau2,
                I2Approx: tau2 / (tau2 + 0.1) * 100,  // Rough I² approximation
                points: points
            });
        });

        return {
            curves: curves,
            trueEffect: trueEffect,
            curveType: curveType,
            xLabel: curveType === 'studies' ? 'Number of Studies' : 'Sample Size per Study'
        };
    }

    // ============================================
    // SIMULATION ENGINE
    // ============================================

    /**
     * Simulate meta-analysis data
     */
    function simulateMetaData(options = {}) {
        const {
            k,                    // Number of studies
            trueEffect,           // True effect size
            tau2 = 0,             // Between-study variance
            nRange = [30, 200],   // Sample size range [min, max]
            effectType = 'd',     // Effect type
            publicationBias = false,  // Simulate publication bias
            pThreshold = 0.05,    // Significance threshold for publication bias
            selectionStrength = 1 // 1 = strong selection, 0 = no selection
        } = options;

        const studies = [];
        let attempts = 0;
        const maxAttempts = k * 10;

        while (studies.length < k && attempts < maxAttempts) {
            attempts++;

            // Random sample size
            const n = Math.floor(nRange[0] + random() * (nRange[1] - nRange[0]));

            // Study-specific true effect (random effects)
            const theta_i = trueEffect + (tau2 > 0 ? Statistics.rnorm(0, Math.sqrt(tau2)) : 0);

            // Within-study variance
            const vi = estimateWithinVariance(n, effectType);

            // Observed effect
            const yi = theta_i + Statistics.rnorm(0, Math.sqrt(vi));

            // Calculate p-value
            const z = yi / Math.sqrt(vi);
            const pvalue = 2 * (1 - Statistics.pnorm(Math.abs(z)));

            // Apply publication bias
            if (publicationBias) {
                // Clamp probability to [0, 1] to handle edge cases
                const rawProb = pvalue < pThreshold ? 1 :
                    1 - selectionStrength * (1 - pThreshold / pvalue);
                const probPublish = Math.max(0, Math.min(1, rawProb));

                if (random() > probPublish) continue;  // Study not published
            }

            studies.push({
                study: `Study_${studies.length + 1}`,
                yi: yi,
                vi: vi,
                se: Math.sqrt(vi),
                n: n,
                theta_true: theta_i,
                pvalue: pvalue,
                significant: pvalue < pThreshold
            });
        }

        return {
            studies: studies,
            params: {
                k: k,
                trueEffect: trueEffect,
                tau2: tau2,
                effectType: effectType,
                publicationBias: publicationBias,
                selectionStrength: selectionStrength
            }
        };
    }

    /**
     * Run Monte Carlo simulation to evaluate method performance
     */
    function monteCarloSimulation(options = {}) {
        const {
            nSim = 1000,          // Number of simulations
            k = 10,               // Studies per meta-analysis
            trueEffect = 0.5,
            tau2 = 0.1,
            nRange = [30, 100],
            effectType = 'd',
            methods = ['DL', 'REML', 'PM', 'HKSJ'],
            publicationBias = false,
            selectionStrength = 0.5,
            progressCallback = null
        } = options;

        const results = methods.map(m => ({
            method: m,
            estimates: [],
            tau2Estimates: [],
            coverage: 0,
            bias: 0,
            mse: 0,
            power: 0,
            typeI: 0  // Only if trueEffect = 0
        }));

        for (let sim = 0; sim < nSim; sim++) {
            // Generate data
            const simData = simulateMetaData({
                k, trueEffect, tau2, nRange, effectType,
                publicationBias, selectionStrength
            });

            const data = simData.studies;
            const yi = data.map(d => d.yi);
            const vi = data.map(d => d.vi);

            // Analyze with each method
            methods.forEach((method, idx) => {
                try {
                    let result;
                    if (method === 'HKSJ') {
                        result = MetaAnalysis.randomEffectsHKSJ(yi, vi, 'DL');
                    } else {
                        result = MetaAnalysis.randomEffects(yi, vi, method);
                    }

                    results[idx].estimates.push(result.effect);
                    results[idx].tau2Estimates.push(result.tau2);

                    // Check coverage
                    if (result.ci.lower <= trueEffect && trueEffect <= result.ci.upper) {
                        results[idx].coverage++;
                    }

                    // Check significance (for power/type I)
                    const significant = result.ci.lower > 0 || result.ci.upper < 0;
                    if (trueEffect !== 0 && significant) {
                        results[idx].power++;
                    }
                    if (trueEffect === 0 && significant) {
                        results[idx].typeI++;
                    }
                } catch (e) {
                    // Method failed, skip
                }
            });

            // Progress callback
            if (progressCallback && sim % 100 === 0) {
                progressCallback((sim / nSim) * 100);
            }
        }

        // Calculate summary statistics
        results.forEach(r => {
            const n = r.estimates.length;
            if (n === 0) return;

            // Mean estimate
            const meanEst = r.estimates.reduce((a, b) => a + b, 0) / n;
            r.meanEstimate = meanEst;

            // Bias
            r.bias = meanEst - trueEffect;
            r.relativeBias = trueEffect !== 0 ? r.bias / trueEffect * 100 : 0;

            // MSE
            r.mse = r.estimates.reduce((sum, e) =>
                sum + Math.pow(e - trueEffect, 2), 0) / n;
            r.rmse = Math.sqrt(r.mse);

            // Variance
            r.variance = n > 1 ? r.estimates.reduce((sum, e) =>
                sum + Math.pow(e - meanEst, 2), 0) / (n - 1) : 0;
            r.sd = Math.sqrt(r.variance);

            // Coverage
            r.coverage = r.coverage / n * 100;

            // Power/Type I
            r.power = r.power / n * 100;
            r.typeI = r.typeI / n * 100;

            // Tau2 estimation
            const meanTau2 = r.tau2Estimates.reduce((a, b) => a + b, 0) / n;
            r.meanTau2 = meanTau2;
            r.tau2Bias = meanTau2 - tau2;
        });

        return {
            results: results,
            params: {
                nSim, k, trueEffect, tau2, nRange, effectType,
                publicationBias, selectionStrength
            },
            summary: generateSimulationSummary(results, trueEffect)
        };
    }

    function generateSimulationSummary(results, trueEffect) {
        // Find best method by different criteria
        const byBias = [...results].sort((a, b) => Math.abs(a.bias) - Math.abs(b.bias));
        const byMSE = [...results].sort((a, b) => a.mse - b.mse);
        const byCoverage = [...results].sort((a, b) => Math.abs(a.coverage - 95) - Math.abs(b.coverage - 95));

        return {
            lowestBias: byBias[0]?.method,
            lowestMSE: byMSE[0]?.method,
            bestCoverage: byCoverage[0]?.method,
            recommendations: {
                unbiased: byBias[0]?.method,
                efficient: byMSE[0]?.method,
                conservative: byCoverage.find(r => r.coverage >= 95)?.method
            }
        };
    }

    /**
     * Simulation to evaluate publication bias detection methods
     */
    function pubBiasDetectionSimulation(options = {}) {
        const {
            nSim = 500,
            k = 20,
            trueEffect = 0.3,
            tau2 = 0.1,
            selectionStrengths = [0, 0.25, 0.5, 0.75, 1],
            methods = ['egger', 'begg', 'trimfill', '3psm', 'petpeese']
        } = options;

        const results = [];

        selectionStrengths.forEach(strength => {
            const methodResults = methods.map(m => ({
                method: m,
                truePositive: 0,
                falsePositive: 0,
                trueNegative: 0,
                falseNegative: 0,
                biasEstimates: []
            }));

            for (let sim = 0; sim < nSim; sim++) {
                const data = simulateMetaData({
                    k, trueEffect, tau2,
                    publicationBias: strength > 0,
                    selectionStrength: strength
                }).studies;

                const hasBias = strength > 0;
                const yi = data.map(d => d.yi);
                const vi = data.map(d => d.vi);
                const sei = vi.map(v => Math.sqrt(v));

                methods.forEach((method, idx) => {
                    try {
                        let detected = false;
                        let biasEstimate = null;

                        switch (method) {
                            case 'egger':
                                const egger = MetaAnalysis.eggerTest(yi, sei);
                                detected = egger.pValue < 0.10;
                                break;
                            case 'begg':
                                const begg = MetaAnalysis.beggTest(yi, vi);
                                detected = begg.pValue < 0.10;
                                break;
                            case 'trimfill':
                                const tf = MetaAnalysis.trimAndFill(yi, vi);
                                detected = tf.k0 > 0;
                                biasEstimate = tf.adjustedEffect - tf.originalEffect;
                                break;
                            case '3psm':
                                const sm = SelectionModels.threeParameterSM(data);
                                detected = sm.lrt.pvalue < 0.10;
                                biasEstimate = sm.adjusted.mu - sm.unadjusted.effect;
                                break;
                            case 'petpeese':
                                const pp = SelectionModels.petPeese(data);
                                detected = pp.pet.slopePvalue < 0.10;
                                biasEstimate = pp.conditional.estimate -
                                    MetaAnalysis.randomEffects(yi, vi, 'DL').effect;
                                break;
                        }

                        if (hasBias && detected) methodResults[idx].truePositive++;
                        if (hasBias && !detected) methodResults[idx].falseNegative++;
                        if (!hasBias && detected) methodResults[idx].falsePositive++;
                        if (!hasBias && !detected) methodResults[idx].trueNegative++;

                        if (biasEstimate !== null) {
                            methodResults[idx].biasEstimates.push(biasEstimate);
                        }
                    } catch (e) {
                        // Method failed
                    }
                });
            }

            // Calculate performance metrics
            methodResults.forEach(r => {
                const total = r.truePositive + r.falseNegative + r.falsePositive + r.trueNegative;
                r.sensitivity = r.truePositive / (r.truePositive + r.falseNegative) || 0;
                r.specificity = r.trueNegative / (r.trueNegative + r.falsePositive) || 0;
                r.ppv = r.truePositive / (r.truePositive + r.falsePositive) || 0;
                r.npv = r.trueNegative / (r.trueNegative + r.falseNegative) || 0;
                r.accuracy = (r.truePositive + r.trueNegative) / total;
            });

            results.push({
                selectionStrength: strength,
                methods: methodResults
            });
        });

        return {
            results: results,
            params: { nSim, k, trueEffect, tau2, methods }
        };
    }

    /**
     * Bootstrap confidence intervals
     */
    function bootstrapCI(data, options = {}) {
        const {
            nBoot = 2000,
            confLevel = 0.95,
            method = 'percentile',  // 'percentile', 'bca', 'basic'
            statistic = 'effect'    // What to bootstrap
        } = options;

        // Validate confLevel is in (0, 1)
        const validConfLevel = Math.max(0.01, Math.min(0.99, confLevel));

        const yi = data.map(d => d.yi);
        const vi = data.map(d => d.vi);
        const n = data.length;

        // Original estimate
        const original = MetaAnalysis.randomEffects(yi, vi, 'DL');
        const originalStat = original[statistic];

        // Bootstrap samples
        const bootStats = [];

        for (let b = 0; b < nBoot; b++) {
            // Resample with replacement
            const indices = [];
            for (let i = 0; i < n; i++) {
                indices.push(Math.floor(random() * n));
            }

            const bootData = indices.map(i => data[i]);

            try {
                const bootYi = bootData.map(d => d.yi);
                const bootVi = bootData.map(d => d.vi);
                const bootResult = MetaAnalysis.randomEffects(bootYi, bootVi, 'DL');
                bootStats.push(bootResult[statistic]);
            } catch (e) {
                // Skip failed bootstrap samples
            }
        }

        bootStats.sort((a, b) => a - b);
        const nBs = bootStats.length;

        // Calculate CI
        const alpha = 1 - validConfLevel;
        let ci;

        switch (method) {
            case 'percentile':
                ci = [
                    bootStats[Math.floor(alpha / 2 * nBs)],
                    bootStats[Math.floor((1 - alpha / 2) * nBs)]
                ];
                break;

            case 'basic':
                ci = [
                    2 * originalStat - bootStats[Math.floor((1 - alpha / 2) * nBs)],
                    2 * originalStat - bootStats[Math.floor(alpha / 2 * nBs)]
                ];
                break;

            case 'bca':
                // Bias correction
                const z0 = Statistics.qnorm(
                    bootStats.filter(s => s < originalStat).length / nBs
                );

                // Acceleration (jackknife)
                const jackStats = [];
                for (let i = 0; i < n; i++) {
                    const jackData = data.filter((_, j) => j !== i);
                    try {
                        const jackYi = jackData.map(d => d.yi);
                        const jackVi = jackData.map(d => d.vi);
                        const jackResult = MetaAnalysis.randomEffects(jackYi, jackVi, 'DL');
                        jackStats.push(jackResult[statistic]);
                    } catch (e) {}
                }

                const meanJack = jackStats.reduce((a, b) => a + b, 0) / jackStats.length;
                const num = jackStats.reduce((s, j) => s + Math.pow(meanJack - j, 3), 0);
                const denom = jackStats.reduce((s, j) => s + Math.pow(meanJack - j, 2), 0);
                const a = num / (6 * Math.pow(denom, 1.5));

                // Adjusted percentiles
                const zLow = Statistics.qnorm(alpha / 2);
                const zHigh = Statistics.qnorm(1 - alpha / 2);

                const pLow = Statistics.pnorm(z0 + (z0 + zLow) / (1 - a * (z0 + zLow)));
                const pHigh = Statistics.pnorm(z0 + (z0 + zHigh) / (1 - a * (z0 + zHigh)));

                ci = [
                    bootStats[Math.floor(pLow * nBs)],
                    bootStats[Math.floor(pHigh * nBs)]
                ];
                break;
        }

        return {
            estimate: originalStat,
            ci: ci,
            method: method,
            se: Math.sqrt(bootStats.reduce((s, b) =>
                s + Math.pow(b - originalStat, 2), 0) / (nBs - 1)),
            nBoot: nBs,
            distribution: bootStats
        };
    }

    /**
     * Permutation test for heterogeneity
     */
    function permutationTest(data, options = {}) {
        const {
            nPerm = 5000,
            statistic = 'Q'  // 'Q', 'I2', 'tau2'
        } = options;

        const yi = data.map(d => d.yi);
        const vi = data.map(d => d.vi);
        const n = data.length;

        // Observed statistic
        const observed = MetaAnalysis.randomEffects(yi, vi, 'DL');
        const obsStat = observed[statistic];

        // Permutation distribution under null (no heterogeneity)
        // Simulate from fixed-effect model
        const pooledFE = MetaAnalysis.fixedEffectIV(yi, vi);
        const permStats = [];

        for (let p = 0; p < nPerm; p++) {
            // Generate under null
            const permYi = vi.map(v => pooledFE.effect + Statistics.rnorm(0, Math.sqrt(v)));

            const permResult = MetaAnalysis.randomEffects(permYi, vi, 'DL');
            permStats.push(permResult[statistic]);
        }

        // P-value
        const pvalue = permStats.filter(s => s >= obsStat).length / nPerm;

        return {
            observed: obsStat,
            pvalue: pvalue,
            nPerm: nPerm,
            percentiles: {
                p50: permStats.sort((a, b) => a - b)[Math.floor(nPerm * 0.5)],
                p95: permStats.sort((a, b) => a - b)[Math.floor(nPerm * 0.95)],
                p99: permStats.sort((a, b) => a - b)[Math.floor(nPerm * 0.99)]
            }
        };
    }

    /**
     * Cross-validation for meta-analysis
     */
    function crossValidation(data, options = {}) {
        const {
            folds = 5,
            method = 'DL',
            metric = 'mse'
        } = options;

        const n = data.length;
        const foldSize = Math.floor(n / folds);

        // Shuffle indices
        const indices = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        const results = [];

        for (let f = 0; f < folds; f++) {
            // Split data
            const testIndices = indices.slice(f * foldSize, (f + 1) * foldSize);
            const trainIndices = indices.filter(i => !testIndices.includes(i));

            const trainData = trainIndices.map(i => data[i]);
            const testData = testIndices.map(i => data[i]);

            // Fit model on training data
            const trainYi = trainData.map(d => d.yi);
            const trainVi = trainData.map(d => d.vi);
            const model = MetaAnalysis.randomEffects(trainYi, trainVi, method);

            // Evaluate on test data
            let error = 0;
            testData.forEach(d => {
                const pred = model.effect;
                if (metric === 'mse') {
                    error += Math.pow(d.yi - pred, 2);
                } else if (metric === 'mae') {
                    error += Math.abs(d.yi - pred);
                }
            });

            results.push({
                fold: f + 1,
                trainN: trainData.length,
                testN: testData.length,
                estimate: model.effect,
                tau2: model.tau2,
                error: error / testData.length
            });
        }

        const avgError = results.reduce((s, r) => s + r.error, 0) / folds;

        return {
            folds: results,
            avgError: avgError,
            metric: metric,
            method: method
        };
    }

    // ============================================
    // GOSH ANALYSIS (Graphical Overview of Study Heterogeneity)
    // ============================================

    /**
     * GOSH analysis - fit all possible subsets
     */
    function goshAnalysis(data, options = {}) {
        const {
            maxCombinations = 10000,
            minStudies = 2,
            method = 'DL',
            seed = null
        } = options;

        const n = data.length;
        const totalCombinations = Math.pow(2, n) - 1 - n;  // Exclude empty and single study

        // If too many combinations, sample
        const useSampling = totalCombinations > maxCombinations;
        const nCombos = useSampling ? maxCombinations : totalCombinations;

        const results = [];

        if (useSampling) {
            // Random sampling of combinations
            for (let c = 0; c < nCombos; c++) {
                // Random subset of size >= minStudies
                const subsetSize = minStudies + Math.floor(random() * (n - minStudies + 1));
                const indices = [];
                while (indices.length < subsetSize) {
                    const idx = Math.floor(random() * n);
                    if (!indices.includes(idx)) indices.push(idx);
                }

                const subset = indices.map(i => data[i]);
                try {
                    const subYi = subset.map(d => d.yi);
                    const subVi = subset.map(d => d.vi);
                    const result = MetaAnalysis.randomEffects(subYi, subVi, method);
                    results.push({
                        indices: indices,
                        k: indices.length,
                        pooled: result.effect,
                        I2: result.I2,
                        tau2: result.tau2,
                        Q: result.Q
                    });
                } catch (e) {}
            }
        } else {
            // Enumerate all combinations
            for (let mask = 1; mask < Math.pow(2, n); mask++) {
                const indices = [];
                for (let i = 0; i < n; i++) {
                    if (mask & (1 << i)) indices.push(i);
                }

                if (indices.length < minStudies) continue;

                const subset = indices.map(i => data[i]);
                try {
                    const subYi = subset.map(d => d.yi);
                    const subVi = subset.map(d => d.vi);
                    const result = MetaAnalysis.randomEffects(subYi, subVi, method);
                    results.push({
                        indices: indices,
                        k: indices.length,
                        pooled: result.effect,
                        I2: result.I2,
                        tau2: result.tau2,
                        Q: result.Q
                    });
                } catch (e) {}
            }
        }

        // Identify outlier studies (studies that consistently appear in extreme subsets)
        const studyInfluence = Array(n).fill(0).map(() => ({ lowEst: 0, highEst: 0, count: 0 }));

        // Sort by pooled estimate
        results.sort((a, b) => a.pooled - b.pooled);
        const p10 = results[Math.floor(results.length * 0.1)].pooled;
        const p90 = results[Math.floor(results.length * 0.9)].pooled;

        results.forEach(r => {
            r.indices.forEach(i => {
                studyInfluence[i].count++;
                if (r.pooled < p10) studyInfluence[i].lowEst++;
                if (r.pooled > p90) studyInfluence[i].highEst++;
            });
        });

        // Identify potential outliers
        const outliers = [];
        studyInfluence.forEach((inf, i) => {
            const propLow = inf.lowEst / inf.count;
            const propHigh = inf.highEst / inf.count;
            if (propLow > 0.5 || propHigh > 0.5) {
                outliers.push({
                    study: data[i].study || `Study ${i + 1}`,
                    index: i,
                    direction: propLow > propHigh ? 'low' : 'high',
                    influence: Math.max(propLow, propHigh)
                });
            }
        });

        return {
            results: results,
            nCombinations: results.length,
            sampled: useSampling,
            summary: {
                pooled: {
                    mean: results.reduce((s, r) => s + r.pooled, 0) / results.length,
                    min: Math.min(...results.map(r => r.pooled)),
                    max: Math.max(...results.map(r => r.pooled)),
                    sd: Math.sqrt(results.reduce((s, r) =>
                        s + Math.pow(r.pooled - results.reduce((a, b) =>
                            a + b.pooled, 0) / results.length, 2), 0) / results.length)
                },
                I2: {
                    mean: results.reduce((s, r) => s + r.I2, 0) / results.length,
                    min: Math.min(...results.map(r => r.I2)),
                    max: Math.max(...results.map(r => r.I2))
                }
            },
            potentialOutliers: outliers.sort((a, b) => b.influence - a.influence),
            plotData: results.map(r => ({
                x: r.pooled,
                y: r.I2,
                k: r.k
            }))
        };
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        // Seedable PRNG for reproducibility
        setSeed,
        clearSeed,

        // Power analysis
        calculatePower,
        requiredStudies,
        requiredSampleSize,
        powerCurve,

        // Simulation
        simulateMetaData,
        monteCarloSimulation,
        pubBiasDetectionSimulation,

        // Advanced inference
        bootstrapCI,
        permutationTest,
        crossValidation,

        // Diagnostics
        goshAnalysis
    };

})();

// Export for Node.js if applicable
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PowerSimulation;
}
