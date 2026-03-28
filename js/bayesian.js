/**
 * PrognosisMeta - Bayesian Meta-Analysis Module
 * MCMC-based Bayesian inference for meta-analysis
 * Implements Metropolis-Hastings and Gibbs sampling
 *
 * Editorial Revisions: December 2024
 * - Enhanced convergence diagnostics with warnings
 * - Added posterior predictive checks
 * - Added formula references with citations
 * - Improved documentation
 *
 * References:
 * - Gelman A, Rubin DB. (1992). Inference from iterative simulation using
 *   multiple sequences. Statistical Science, 7(4), 457-472.
 * - Vehtari A, Gelman A, Simpson D, Carpenter B, Bürkner PC. (2021).
 *   Rank-normalization, folding, and localization: An improved R-hat for
 *   assessing convergence of MCMC. Bayesian Analysis, 16(2), 667-718.
 * - Higgins JPT, Thompson SG, Spiegelhalter DJ. (2009). A re-evaluation of
 *   random-effects meta-analysis. Journal of the Royal Statistical Society:
 *   Series A, 172(1), 137-159.
 */

const BayesianMA = (function() {
    'use strict';

    if (typeof Statistics === 'undefined') {
        throw new Error('Statistics module must be loaded before BayesianMA');
    }
    const Stats = Statistics;

    // ============================================
    // Configuration and Thresholds
    // ============================================

    const CONFIG = {
        convergence: {
            rhatThreshold: 1.1,      // Gelman-Rubin < 1.1 indicates convergence
            rhatWarning: 1.05,       // Warn if Rhat > 1.05
            essMinimum: 400,         // Minimum effective sample size
            essWarning: 100          // Warn if ESS < 100
        },
        mcmc: {
            defaultIterations: 10000,
            defaultBurnin: 2000,
            defaultChains: 4
        }
    };

    // ============================================
    // Seedable PRNG (xoshiro128** algorithm)
    // Provides reproducible random number generation
    // ============================================

    let _prngState = null;

    /**
     * Initialize PRNG with a seed for reproducibility.
     * If no seed is set, falls back to Math.random().
     * @param {number} seed - Integer seed value
     */
    function setSeed(seed) {
        // SplitMix32 to initialize xoshiro128** state from a single seed
        function splitmix32(a) {
            return function() {
                a |= 0; a = a + 0x9e3779b9 | 0;
                let t = a ^ a >>> 16; t = Math.imul(t, 0x21f0aaad);
                t = t ^ t >>> 15; t = Math.imul(t, 0x735a2d97);
                return (t ^ t >>> 15) >>> 0;
            };
        }
        const init = splitmix32(seed);
        _prngState = [init(), init(), init(), init()];
    }

    /**
     * Clear seed (revert to Math.random)
     */
    function clearSeed() {
        _prngState = null;
    }

    /**
     * Core PRNG: xoshiro128** returning [0, 1)
     * Fast, high-quality, seedable PRNG with 128-bit state.
     */
    function random() {
        if (!_prngState) return Math.random();

        const s = _prngState;
        const t1 = Math.imul(s[1], 5) >>> 0;
        const result = Math.imul((t1 << 7) | (t1 >>> 25), 9) >>> 0;
        const t = s[1] << 9;

        s[2] ^= s[0];
        s[3] ^= s[1];
        s[1] ^= s[2];
        s[0] ^= s[3];
        s[2] ^= t;
        s[3] = (s[3] << 11) | (s[3] >>> 21);

        return (result >>> 0) / 4294967296;
    }

    // ============================================
    // Random Number Generation
    // (uses seedable random() instead of Math.random())
    // ============================================

    /**
     * Box-Muller transform for normal random numbers
     */
    function rnorm(mu = 0, sigma = 1) {
        // Protect against log(0) by ensuring u1 > 0
        let u1 = random();
        while (u1 === 0) u1 = random();
        const u2 = random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mu + sigma * z;
    }

    /**
     * Generate gamma random variable (Marsaglia & Tsang)
     */
    function rgamma(shape, scale = 1) {
        // Validate parameters
        if (shape <= 0) {
            throw new Error('rgamma: shape must be positive');
        }
        if (scale <= 0) {
            throw new Error('rgamma: scale must be positive');
        }
        if (shape < 1) {
            return rgamma(1 + shape, scale) * Math.pow(random(), 1 / shape);
        }

        const d = shape - 1/3;
        const c = 1 / Math.sqrt(9 * d);

        while (true) {
            let x, v;
            do {
                x = rnorm();
                v = 1 + c * x;
            } while (v <= 0);

            v = v * v * v;
            const u = random();

            if (u < 1 - 0.0331 * x * x * x * x) return d * v * scale;
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
        }
    }

    /**
     * Generate inverse gamma random variable
     */
    function rinvgamma(shape, scale) {
        // Validate parameters
        if (scale <= 0) {
            throw new Error('rinvgamma: scale must be positive');
        }
        const g = rgamma(shape, 1 / scale);
        // Guard against extremely small gamma samples causing Infinity
        // Use a reasonable upper bound (1e12) to prevent propagation issues
        if (g <= 1e-12) {
            return 1e12;  // Large but finite value
        }
        return 1 / g;
    }

    /**
     * Generate half-normal random variable
     */
    function rhalfnorm(sigma = 1) {
        return Math.abs(rnorm(0, sigma));
    }

    /**
     * Generate half-Cauchy random variable
     */
    function rhalfcauchy(scale = 1) {
        // Clamp u to avoid extreme tan values
        let u = random();
        u = Math.max(0.001, Math.min(0.999, u));
        return scale * Math.abs(Math.tan(Math.PI * (u - 0.5)));
    }

    /**
     * Generate uniform random variable
     */
    function runif(min = 0, max = 1) {
        return min + random() * (max - min);
    }

    /**
     * Generate truncated normal (rejection sampling)
     * Includes max iteration guard to prevent infinite loops
     * with narrow/far truncation bounds.
     */
    function rtnorm(mu, sigma, lower = -Infinity, upper = Infinity) {
        const MAX_ATTEMPTS = 10000;
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const x = rnorm(mu, sigma);
            if (x >= lower && x <= upper) return x;
        }
        // Fallback: clamp to nearest bound
        const mid = (lower === -Infinity) ? upper : (upper === Infinity) ? lower : (lower + upper) / 2;
        return mid;
    }

    // ============================================
    // Prior Distributions
    // ============================================

    const Priors = {
        // Priors for overall effect (mu)
        mu: {
            normal: (x, mu0 = 0, sigma0 = 10) => {
                const z = (x - mu0) / sigma0;
                return -0.5 * z * z - Math.log(sigma0);
            },
            uniform: (x, a = -10, b = 10) => {
                return (x >= a && x <= b) ? -Math.log(b - a) : -Infinity;
            },
            cauchy: (x, x0 = 0, gamma = 2.5) => {
                return -Math.log(Math.PI * gamma * (1 + Math.pow((x - x0) / gamma, 2)));
            }
        },

        // Priors for heterogeneity (tau)
        tau: {
            halfNormal: (tau, sigma = 1) => {
                if (tau < 0) return -Infinity;
                return -0.5 * Math.pow(tau / sigma, 2) + Math.log(2) - Math.log(sigma);
            },
            halfCauchy: (tau, scale = 0.5) => {
                if (tau < 0) return -Infinity;
                return Math.log(2) - Math.log(Math.PI * scale * (1 + Math.pow(tau / scale, 2)));
            },
            uniform: (tau, upper = 2) => {
                return (tau >= 0 && tau <= upper) ? -Math.log(upper) : -Infinity;
            },
            exponential: (tau, rate = 1) => {
                if (tau < 0) return -Infinity;
                return Math.log(rate) - rate * tau;
            },
            invGamma: (tau, shape = 0.001, scale = 0.001) => {
                if (tau <= 0) return -Infinity;
                const tau2 = tau * tau;
                return shape * Math.log(scale) - Stats.lgamma(shape) -
                       (shape + 1) * Math.log(tau2) - scale / tau2 + Math.log(2 * tau);
            }
        }
    };

    
    // ============================================
    // INFORMATIVE PRIORS FOR TAU
    // Based on Turner et al. (2012, 2015) meta-epidemiological data
    // Reference: Turner RM, et al. (2012). Statistics in Medicine, 31(29), 3805-3820.
    // Reference: Turner RM, et al. (2015). Journal of Clinical Epidemiology, 68(2), 157-165.
    // ============================================

    const TurnerPriors = {
        /**
         * Get informative prior for tau based on outcome type and comparison
         * Returns log-normal prior parameters for tau
         */
        getPrior: function(outcomeType, comparisonType = 'pharmacological') {
            // Turner et al. (2012) predictive distributions for tau
            // Format: { meanLog: mean of log(tau), sdLog: SD of log(tau) }

            const priors = {
                // All-cause mortality
                'mortality': {
                    'pharmacological': { meanLog: -2.01, sdLog: 0.41 },
                    'non-pharmacological': { meanLog: -1.52, sdLog: 0.72 }
                },
                // Semi-objective outcomes (lab values, etc.)
                'semi-objective': {
                    'pharmacological': { meanLog: -2.13, sdLog: 0.58 },
                    'non-pharmacological': { meanLog: -1.64, sdLog: 0.74 }
                },
                // Subjective outcomes (PROs, symptoms)
                'subjective': {
                    'pharmacological': { meanLog: -1.47, sdLog: 0.66 },
                    'non-pharmacological': { meanLog: -1.01, sdLog: 0.74 }
                },
                // General/mixed
                'general': {
                    'pharmacological': { meanLog: -1.87, sdLog: 0.59 },
                    'non-pharmacological': { meanLog: -1.39, sdLog: 0.73 }
                }
            };

            const outcome = priors[outcomeType] || priors['general'];
            return outcome[comparisonType] || outcome['pharmacological'];
        },

        /**
         * Log-normal prior density for tau
         */
        logNormal: function(tau, meanLog, sdLog) {
            if (tau <= 0) return -Infinity;
            const logTau = Math.log(tau);
            const z = (logTau - meanLog) / sdLog;
            return -Math.log(tau) - Math.log(sdLog) - 0.5 * Math.log(2 * Math.PI) - 0.5 * z * z;
        },

        /**
         * Create prior function for MCMC
         */
        createPriorFunction: function(outcomeType, comparisonType) {
            const params = this.getPrior(outcomeType, comparisonType);
            return (tau) => this.logNormal(tau, params.meanLog, params.sdLog);
        },

        /**
         * Get median and 95% interval of prior
         */
        getPriorSummary: function(outcomeType, comparisonType) {
            const params = this.getPrior(outcomeType, comparisonType);
            return {
                median: Math.exp(params.meanLog),
                lower95: Math.exp(params.meanLog - 1.96 * params.sdLog),
                upper95: Math.exp(params.meanLog + 1.96 * params.sdLog),
                meanLog: params.meanLog,
                sdLog: params.sdLog,
                reference: 'Turner et al. (2012, 2015)'
            };
        },

        /**
         * List all available outcome types
         */
        getOutcomeTypes: function() {
            return ['mortality', 'semi-objective', 'subjective', 'general'];
        }
    };


    // ============================================
    // Log-Likelihood Functions
    // ============================================

    /**
     * Log-likelihood for random-effects meta-analysis
     */
    function logLikelihood(effects, variances, mu, tau) {
        const tau2 = tau * tau;
        let ll = 0;

        for (let i = 0; i < effects.length; i++) {
            const v = variances[i] + tau2;
            if (v <= 0) continue;  // Skip invalid variance
            const resid = effects[i] - mu;
            ll -= 0.5 * Math.log(2 * Math.PI * v);
            ll -= 0.5 * resid * resid / v;
        }

        return ll;
    }

    /**
     * Log-posterior for random-effects model
     */
    function logPosterior(effects, variances, mu, tau, priors) {
        const ll = logLikelihood(effects, variances, mu, tau);
        const logPriorMu = priors.mu(mu);
        const logPriorTau = priors.tau(tau);

        return ll + logPriorMu + logPriorTau;
    }

    // ============================================
    // MCMC Samplers
    // ============================================

    /**
     * Gibbs sampler for normal-normal hierarchical model
     */
    function gibbsSampler(effects, variances, options = {}) {
        const {
            iterations = 10000,
            burnin = 2000,
            thin = 1,
            chains = 4,
            priorMu = { type: 'normal', mu0: 0, sigma0: 10 },
            priorTau = { type: 'halfCauchy', scale: 0.5 }
        } = options;

        // Validate MCMC parameters
        const validIterations = Math.max(1, Math.floor(iterations));
        const validBurnin = Math.max(0, Math.min(Math.floor(burnin), validIterations - 1));
        const validThin = Math.max(1, Math.floor(thin));
        const validChains = Math.max(1, Math.floor(chains));

        const k = effects.length;
        if (k === 0) {
            return [{ chain: 1, samples: { mu: [], tau: [], tau2: [], theta: [] } }];
        }
        const results = [];

        for (let chain = 0; chain < validChains; chain++) {
            // Initialize from overdispersed starting points
            const meanEff = Stats.mean(effects);
            const sdEff = Stats.sd(effects) || 0.1;
            let mu = rnorm(meanEff, sdEff * 2);
            let tau2 = Math.abs(rnorm(0.1, 0.5));

            const samples = {
                mu: [],
                tau: [],
                tau2: [],
                theta: []  // Study-specific effects
            };

            for (let iter = 0; iter < validIterations; iter++) {
                // Sample study-specific effects (theta_i)
                const theta = [];
                for (let i = 0; i < k; i++) {
                    const prec_i = 1 / variances[i];
                    const prec_mu = tau2 > 0 ? 1 / tau2 : 1e10;
                    const postPrec = prec_i + prec_mu;
                    const postMean = (prec_i * effects[i] + prec_mu * mu) / postPrec;
                    const postSD = 1 / Math.sqrt(postPrec);
                    theta.push(rnorm(postMean, postSD));
                }

                // Sample mu (overall effect)
                const sumTheta = Stats.sum(theta);
                const sigma0Sq = priorMu.sigma0 * priorMu.sigma0;
                const prec_mu_prior = sigma0Sq > 0 ? 1 / sigma0Sq : 1e10;
                const prec_mu_lik = tau2 > 0 ? k / tau2 : k * 1e10;
                const postPrec_mu = prec_mu_prior + prec_mu_lik;
                const postMean_mu = (prec_mu_prior * priorMu.mu0 + prec_mu_lik * sumTheta / k) / postPrec_mu;
                const postSD_mu = 1 / Math.sqrt(postPrec_mu);
                mu = rnorm(postMean_mu, postSD_mu);

                // Sample tau2 (between-study variance)
                // Using Metropolis-Hastings step for flexibility with different priors
                const currentTau = Math.max(1e-10, Math.sqrt(tau2));
                const propLogTau = Math.log(currentTau) + rnorm(0, 0.1);
                const propTau = Math.exp(propLogTau);
                const propTau2 = propTau * propTau;

                const currentLogPost = logLikelihood(theta, Array(k).fill(0), mu, currentTau) +
                                       Priors.tau[priorTau.type](currentTau, priorTau.scale);
                const propLogPost = logLikelihood(theta, Array(k).fill(0), mu, propTau) +
                                    Priors.tau[priorTau.type](propTau, priorTau.scale);

                // Jacobian for log-transformation
                const logAccept = propLogPost - currentLogPost + propLogTau - Math.log(currentTau);

                if (Math.log(random()) < logAccept) {
                    tau2 = propTau2;
                }

                // Store samples after burnin
                if (iter >= validBurnin && (iter - validBurnin) % validThin === 0) {
                    samples.mu.push(mu);
                    samples.tau.push(Math.sqrt(tau2));
                    samples.tau2.push(tau2);
                    samples.theta.push([...theta]);
                }
            }

            results.push({
                chain: chain + 1,
                samples
            });
        }

        return results;
    }

    /**
     * Metropolis-Hastings sampler (more flexible)
     */
    /**
     * Metropolis-Hastings MCMC sampler
     * Reference: Metropolis N, et al. (1953). Equation of state calculations
     * by fast computing machines. J Chem Phys, 21(6), 1087-1092.
     *
     * Hastings WK. (1970). Monte Carlo sampling methods using Markov chains
     * and their applications. Biometrika, 57(1), 97-109.
     */
    function metropolisHastings(effects, variances, options = {}) {
        const {
            iterations = 10000,
            burnin = 2000,
            thin = 1,
            chains = 4,
            priorMu = { type: 'normal', mu0: 0, sigma0: 10 },
            priorTau = { type: 'halfCauchy', scale: 0.5 },
            adaptInterval = 100
        } = options;

        // Validate MCMC parameters
        const validIterations = Math.max(1, Math.floor(iterations));
        const validBurnin = Math.max(0, Math.min(Math.floor(burnin), validIterations - 1));
        const validThin = Math.max(1, Math.floor(thin));
        const validChains = Math.max(1, Math.floor(chains));

        const k = effects.length;
        const results = [];

        // Prior functions
        const logPriorMu = (mu) => Priors.mu[priorMu.type](mu, priorMu.mu0, priorMu.sigma0);
        const logPriorTau = (tau) => Priors.tau[priorTau.type](tau, priorTau.scale);

        for (let chain = 0; chain < validChains; chain++) {
            // Initialize
            let mu = rnorm(Stats.mean(effects), Stats.sd(effects) * 2);
            let tau = Math.abs(rnorm(0.3, 0.2));

            // Adaptive proposal SDs
            let sdMu = Stats.sd(effects) * 0.2;
            let sdLogTau = 0.3;
            let acceptMu = 0, acceptTau = 0;

            const samples = {
                mu: [],
                tau: [],
                tau2: [],
                logPosterior: []
            };

            for (let iter = 0; iter < validIterations; iter++) {
                // Current log-posterior
                const currentLogPost = logLikelihood(effects, variances, mu, tau) +
                                       logPriorMu(mu) + logPriorTau(tau);

                // Propose new mu
                const propMu = mu + rnorm(0, sdMu);
                const propLogPost_mu = logLikelihood(effects, variances, propMu, tau) +
                                       logPriorMu(propMu) + logPriorTau(tau);

                if (Math.log(random()) < propLogPost_mu - currentLogPost) {
                    mu = propMu;
                    acceptMu++;
                }

                // Propose new tau (on log scale for positivity)
                const logTau = tau > 0 ? Math.log(tau) : -20;
                const propLogTau = logTau + rnorm(0, sdLogTau);
                const propTau = Math.exp(propLogTau);

                const newLogPost = logLikelihood(effects, variances, mu, tau) +
                                   logPriorMu(mu) + logPriorTau(tau);
                const propLogPost_tau = logLikelihood(effects, variances, mu, propTau) +
                                        logPriorMu(mu) + logPriorTau(propTau);

                // Include Jacobian
                const logAccept = propLogPost_tau - newLogPost + (propLogTau - logTau);

                if (Math.log(random()) < logAccept) {
                    tau = propTau;
                    acceptTau++;
                }

                // Adaptive tuning
                if (iter > 0 && iter % adaptInterval === 0 && iter < validBurnin) {
                    const acceptRateMu = acceptMu / adaptInterval;
                    const acceptRateTau = acceptTau / adaptInterval;

                    // Target acceptance rate ~0.44 for univariate
                    if (acceptRateMu < 0.3) sdMu *= 0.8;
                    else if (acceptRateMu > 0.5) sdMu *= 1.2;

                    if (acceptRateTau < 0.3) sdLogTau *= 0.8;
                    else if (acceptRateTau > 0.5) sdLogTau *= 1.2;

                    acceptMu = 0;
                    acceptTau = 0;
                }

                // Store samples
                if (iter >= validBurnin && (iter - validBurnin) % validThin === 0) {
                    const finalLogPost = logLikelihood(effects, variances, mu, tau) +
                                         logPriorMu(mu) + logPriorTau(tau);
                    samples.mu.push(mu);
                    samples.tau.push(tau);
                    samples.tau2.push(tau * tau);
                    samples.logPosterior.push(finalLogPost);
                }
            }

            const nPostBurnin = validIterations - validBurnin;
            results.push({
                chain: chain + 1,
                samples,
                acceptance: {
                    mu: nPostBurnin > 0 ? acceptMu / nPostBurnin : 0,
                    tau: nPostBurnin > 0 ? acceptTau / nPostBurnin : 0
                }
            });
        }

        return results;
    }

    // ============================================
    // MCMC Diagnostics
    // ============================================

    /**
     * Interpret convergence diagnostics and generate warnings
     * Reference: Vehtari A, et al. (2021). Rank-normalization, folding, and localization.
     */
    function interpretDiagnostics(diagnostics) {
        const warnings = [];
        const status = { converged: true, reliable: true };

        // Check Rhat for mu
        if (diagnostics.rhatMu > CONFIG.convergence.rhatThreshold) {
            warnings.push({
                level: 'error',
                parameter: 'mu',
                message: `Rhat for mu = ${diagnostics.rhatMu.toFixed(3)} exceeds ${CONFIG.convergence.rhatThreshold}. Chains have NOT converged. Increase iterations or check for multimodality.`
            });
            status.converged = false;
        } else if (diagnostics.rhatMu > CONFIG.convergence.rhatWarning) {
            warnings.push({
                level: 'warning',
                parameter: 'mu',
                message: `Rhat for mu = ${diagnostics.rhatMu.toFixed(3)} is marginal. Consider running longer chains.`
            });
        }

        // Check Rhat for tau
        if (diagnostics.rhatTau > CONFIG.convergence.rhatThreshold) {
            warnings.push({
                level: 'error',
                parameter: 'tau',
                message: `Rhat for tau = ${diagnostics.rhatTau.toFixed(3)} exceeds ${CONFIG.convergence.rhatThreshold}. Chains have NOT converged.`
            });
            status.converged = false;
        } else if (diagnostics.rhatTau > CONFIG.convergence.rhatWarning) {
            warnings.push({
                level: 'warning',
                parameter: 'tau',
                message: `Rhat for tau = ${diagnostics.rhatTau.toFixed(3)} is marginal.`
            });
        }

        // Check ESS for mu
        if (diagnostics.essMu < CONFIG.convergence.essWarning) {
            warnings.push({
                level: 'error',
                parameter: 'mu',
                message: `ESS for mu = ${Math.round(diagnostics.essMu)} is critically low (< ${CONFIG.convergence.essWarning}). Posterior estimates unreliable.`
            });
            status.reliable = false;
        } else if (diagnostics.essMu < CONFIG.convergence.essMinimum) {
            warnings.push({
                level: 'warning',
                parameter: 'mu',
                message: `ESS for mu = ${Math.round(diagnostics.essMu)} is below recommended minimum of ${CONFIG.convergence.essMinimum}.`
            });
        }

        // Check ESS for tau
        if (diagnostics.essTau < CONFIG.convergence.essWarning) {
            warnings.push({
                level: 'error',
                parameter: 'tau',
                message: `ESS for tau = ${Math.round(diagnostics.essTau)} is critically low. Heterogeneity estimates unreliable.`
            });
            status.reliable = false;
        } else if (diagnostics.essTau < CONFIG.convergence.essMinimum) {
            warnings.push({
                level: 'warning',
                parameter: 'tau',
                message: `ESS for tau = ${Math.round(diagnostics.essTau)} is below recommended minimum.`
            });
        }

        // Check Geweke test
        if (diagnostics.gewekeMu && diagnostics.gewekeMu.pValue < 0.01) {
            warnings.push({
                level: 'warning',
                parameter: 'mu',
                message: `Geweke test significant (p = ${diagnostics.gewekeMu.pValue.toFixed(4)}). First and last portions of chain differ - possible non-stationarity.`
            });
        }
        if (diagnostics.gewekeTau && diagnostics.gewekeTau.pValue < 0.01) {
            warnings.push({
                level: 'warning',
                parameter: 'tau',
                message: `Geweke test significant for tau (p = ${diagnostics.gewekeTau.pValue.toFixed(4)}). Possible non-stationarity.`
            });
        }

        return {
            warnings,
            status,
            summary: status.converged && status.reliable ?
                'Convergence diagnostics satisfactory' :
                !status.converged ? 'WARNING: MCMC chains have not converged. Results unreliable.' :
                'WARNING: Low effective sample size. Increase iterations.'
        };
    }

    /**
     * Calculate Rhat (Gelman-Rubin diagnostic)
     * Reference: Gelman A, Rubin DB. (1992). Inference from iterative simulation.
     * Formula: Rhat = sqrt((n-1)/n * W + B/n) / W
     * Returns NaN if convergence cannot be assessed (single chain or insufficient samples)
     */
    function rhat(chainSamples) {
        if (!chainSamples || chainSamples.length === 0) return NaN;
        const m = chainSamples.length;  // Number of chains
        if (m < 2) {
            console.warn('rhat: Cannot compute with single chain - need at least 2 chains');
            return NaN;
        }
        if (!chainSamples[0] || chainSamples[0].length === 0) return NaN;
        const n = chainSamples[0].length;  // Samples per chain
        if (n < 2) {
            console.warn('rhat: Cannot compute with single sample per chain');
            return NaN;
        }

        // Chain means
        const chainMeans = chainSamples.map(chain => Stats.mean(chain));
        const overallMean = Stats.mean(chainMeans);

        // Between-chain variance
        const B = n * chainMeans.reduce((sum, mean) =>
            sum + Math.pow(mean - overallMean, 2), 0) / (m - 1);

        // Within-chain variance
        const W = chainSamples.reduce((sum, chain) => {
            const chainMean = Stats.mean(chain);
            return sum + chain.reduce((s, x) => s + Math.pow(x - chainMean, 2), 0) / (n - 1);
        }, 0) / m;

        // Pooled variance estimate
        const varPlus = ((n - 1) / n) * W + (1 / n) * B;

        // Rhat - protect against W=0
        return W > 0 ? Math.sqrt(varPlus / W) : 1.0;
    }

    /**
     * Calculate effective sample size (ESS)
     */
    function effectiveSampleSize(samples) {
        const n = samples.length;
        const mean = Stats.mean(samples);
        const variance = Stats.variance(samples);

        if (variance === 0) return n;

        // Autocorrelation function
        const maxLag = Math.min(n - 1, 100);
        let rhoSum = 0;

        for (let lag = 1; lag <= maxLag; lag++) {
            let sum = 0;
            for (let i = 0; i < n - lag; i++) {
                sum += (samples[i] - mean) * (samples[i + lag] - mean);
            }
            const rho = sum / ((n - lag) * variance);

            // Stop if autocorrelation becomes negative
            if (rho < 0) break;
            rhoSum += rho;
        }

        return n / (1 + 2 * rhoSum);
    }

    /**
     * Calculate Monte Carlo standard error
     */
    function mcse(samples) {
        const ess = effectiveSampleSize(samples);
        return ess > 0 ? Stats.sd(samples) / Math.sqrt(ess) : Infinity;
    }

    /**
     * Geweke diagnostic
     */
    function geweke(samples, frac1 = 0.1, frac2 = 0.5) {
        const n = samples.length;
        const n1 = Math.floor(n * frac1);
        const n2 = Math.floor(n * frac2);

        const first = samples.slice(0, n1);
        const last = samples.slice(n - n2);

        const mean1 = Stats.mean(first);
        const mean2 = Stats.mean(last);
        const var1 = Stats.variance(first) / n1;
        const var2 = Stats.variance(last) / n2;

        const varSum = var1 + var2;
        const z = varSum > 0 ? (mean1 - mean2) / Math.sqrt(varSum) : 0;
        const pValue = 2 * (1 - Stats.pnorm(Math.abs(z)));

        return { z, pValue };
    }

    // ============================================
    // Posterior Summaries
    // ============================================

    /**
     * Calculate posterior summary statistics
     */
    function posteriorSummary(samples) {
        const sorted = [...samples].sort((a, b) => a - b);
        const n = sorted.length;

        const mean = Stats.mean(samples);
        const sd = Stats.sd(samples);
        const median = sorted[Math.floor(n / 2)];

        // Credible intervals (with bounds checking)
        const idx025 = Math.max(0, Math.floor(n * 0.025));
        const idx975 = Math.min(n - 1, Math.floor(n * 0.975));
        const idx05 = Math.max(0, Math.floor(n * 0.05));
        const idx95 = Math.min(n - 1, Math.floor(n * 0.95));
        const ci95 = {
            lower: n > 0 ? sorted[idx025] : NaN,
            upper: n > 0 ? sorted[idx975] : NaN
        };
        const ci90 = {
            lower: n > 0 ? sorted[idx05] : NaN,
            upper: n > 0 ? sorted[idx95] : NaN
        };

        // Highest posterior density interval
        const hpdi = hpd(samples, 0.95);

        return {
            mean,
            sd,
            median,
            ci95,
            ci90,
            hpdi,
            mcError: mcse(samples),
            ess: effectiveSampleSize(samples)
        };
    }

    /**
     * Calculate highest posterior density interval
     */
    function hpd(samples, prob = 0.95) {
        const sorted = [...samples].sort((a, b) => a - b);
        const n = sorted.length;
        if (n === 0) return { lower: NaN, upper: NaN };
        if (n === 1) return { lower: sorted[0], upper: sorted[0] };

        const nCI = Math.min(n, Math.ceil(prob * n));
        const nOutside = n - nCI;

        let minWidth = Infinity;
        let lower = sorted[0];
        let upper = sorted[Math.min(n - 1, nCI - 1)];

        for (let i = 0; i <= nOutside; i++) {
            const upperIdx = Math.min(n - 1, i + nCI - 1);
            const width = sorted[upperIdx] - sorted[i];
            if (width < minWidth) {
                minWidth = width;
                lower = sorted[i];
                upper = sorted[upperIdx];
            }
        }

        return { lower, upper };
    }

    // ============================================
    // Main Bayesian Meta-Analysis Function
    // ============================================

    /**
     * Run full Bayesian meta-analysis
     */
    function bayesianMetaAnalysis(effects, variances, options = {}) {
        const {
            method = 'gibbs',  // 'gibbs' or 'mh'
            iterations = 10000,
            burnin = 2000,
            thin = 1,
            chains = 4,
            priorMu = { type: 'normal', mu0: 0, sigma0: 10 },
            priorTau = { type: 'halfCauchy', scale: 0.5 }
        } = options;

        // Run MCMC
        let chainResults;
        if (method === 'gibbs') {
            chainResults = gibbsSampler(effects, variances, {
                iterations, burnin, thin, chains, priorMu, priorTau
            });
        } else {
            chainResults = metropolisHastings(effects, variances, {
                iterations, burnin, thin, chains, priorMu, priorTau
            });
        }

        // Combine chains
        const allMu = chainResults.flatMap(r => r.samples.mu);
        const allTau = chainResults.flatMap(r => r.samples.tau);
        const allTau2 = chainResults.flatMap(r => r.samples.tau2);

        // Convergence diagnostics
        const muByChain = chainResults.map(r => r.samples.mu);
        const tauByChain = chainResults.map(r => r.samples.tau);

        const diagnostics = {
            rhatMu: rhat(muByChain),
            rhatTau: rhat(tauByChain),
            essMu: effectiveSampleSize(allMu),
            essTau: effectiveSampleSize(allTau),
            gewekeMu: geweke(allMu),
            gewekeTau: geweke(allTau)
        };

        // Interpret diagnostics and generate warnings
        const diagnosticInterpretation = interpretDiagnostics(diagnostics);

        // Check convergence
        const converged = diagnostics.rhatMu < CONFIG.convergence.rhatThreshold &&
                          diagnostics.rhatTau < CONFIG.convergence.rhatThreshold;

        // Posterior summaries
        const muSummary = posteriorSummary(allMu);
        const tauSummary = posteriorSummary(allTau);
        const tau2Summary = posteriorSummary(allTau2);

        // Posterior predictive
        const predictive = allMu.map((mu, i) =>
            rnorm(mu, allTau[i])
        );
        const predSummary = posteriorSummary(predictive);

        // Probability effect > 0
        const probPositive = allMu.filter(x => x > 0).length / allMu.length;

        // Bayes factor approximation (Savage-Dickey ratio at null)
        const priorAtNull = Priors.mu[priorMu.type](0, priorMu.mu0, priorMu.sigma0);
        // Kernel density estimate at null
        const nMu = allMu.length || 1;
        const sdMu = Stats.sd(allMu) || 0.1;
        const bandwidth = 1.06 * sdMu * Math.pow(nMu, -0.2);
        const safeBandwidth = bandwidth > 0 ? bandwidth : 0.1;
        const posteriorAtNull = allMu.reduce((sum, x) =>
            sum + Math.exp(-0.5 * Math.pow(x / safeBandwidth, 2)), 0) /
            (nMu * safeBandwidth * Math.sqrt(2 * Math.PI));
        const priorExp = Math.exp(priorAtNull);
        const bf01 = priorExp > 0 ? posteriorAtNull / priorExp : 1;

        return {
            // Posterior summaries
            mu: {
                ...muSummary,
                probPositive
            },
            tau: tauSummary,
            tau2: tau2Summary,

            // Prediction
            predictive: predSummary,

            // Diagnostics with interpretation
            diagnostics: {
                ...diagnostics,
                converged,
                ...diagnosticInterpretation
            },

            // Posterior predictive check (compute on demand to save time)
            posteriorPredictiveCheck: () => posteriorPredictiveCheck(effects, variances, { mu: allMu, tau: allTau }),

            // Model comparison
            bayesFactor: {
                bf01,
                bf10: bf01 > 0 ? 1 / bf01 : Infinity,
                interpretation: bf01 > 3 ? 'Evidence for null' :
                               bf01 < 1/3 ? 'Evidence for effect' : 'Inconclusive'
            },

            // Raw samples for plotting
            samples: {
                mu: allMu,
                tau: allTau,
                tau2: allTau2
            },

            // Chain-specific samples
            chains: chainResults,

            // Settings
            settings: {
                method,
                iterations,
                burnin,
                thin,
                nChains: chains,
                priorMu,
                priorTau
            }
        };
    }

    /**
     * Posterior predictive check
     * Reference: Gelman A, et al. (2013). Bayesian Data Analysis, 3rd ed. Chapter 6.
     *
     * Compares replicated data from the posterior predictive distribution
     * to the observed data to assess model fit.
     */
    function posteriorPredictiveCheck(effects, variances, samples, options = {}) {
        const { nRep = 1000 } = options;
        const { mu, tau } = samples;
        const n = mu.length;
        const k = effects.length;

        // Test statistics for observed data
        const observedMean = Stats.mean(effects);
        const observedSD = Stats.sd(effects);
        const observedMin = Math.min(...effects);
        const observedMax = Math.max(...effects);
        const observedRange = observedMax - observedMin;

        // Replicate data and calculate test statistics
        const repMeans = [];
        const repSDs = [];
        const repRanges = [];
        const chiSquares = [];

        for (let rep = 0; rep < nRep; rep++) {
            // Sample from posterior
            const idx = Math.floor(random() * n);
            const muSamp = mu[idx];
            const tauSamp = tau[idx];

            // Generate replicated data
            const repData = effects.map((_, i) => {
                const theta_i = rnorm(muSamp, tauSamp);
                return rnorm(theta_i, Math.sqrt(variances[i]));
            });

            // Calculate test statistics on replicated data
            repMeans.push(Stats.mean(repData));
            repSDs.push(Stats.sd(repData));
            repRanges.push(Math.max(...repData) - Math.min(...repData));

            // Chi-square discrepancy
            let chiSq = 0;
            for (let i = 0; i < k; i++) {
                const expected = muSamp;
                const variance = variances[i] + tauSamp * tauSamp;
                chiSq += variance > 0 ? Math.pow(repData[i] - expected, 2) / variance : 0;
            }
            chiSquares.push(chiSq);
        }

        // Calculate posterior predictive p-values
        const pppMean = repMeans.filter(x => x >= observedMean).length / nRep;
        const pppSD = repSDs.filter(x => x >= observedSD).length / nRep;
        const pppRange = repRanges.filter(x => x >= observedRange).length / nRep;

        // Observed chi-square
        const muPost = Stats.mean(mu);
        const tauPost = Stats.mean(tau);
        let observedChiSq = 0;
        for (let i = 0; i < k; i++) {
            const variance = variances[i] + tauPost * tauPost;
            observedChiSq += variance > 0 ? Math.pow(effects[i] - muPost, 2) / variance : 0;
        }
        const pppChiSq = chiSquares.filter(x => x >= observedChiSq).length / nRep;

        // Interpretation
        const interpretation = [];
        if (pppMean < 0.05 || pppMean > 0.95) {
            interpretation.push('Mean of observed data unusual under model');
        }
        if (pppSD < 0.05 || pppSD > 0.95) {
            interpretation.push('Variability of observed data unusual under model');
        }
        if (pppRange < 0.05 || pppRange > 0.95) {
            interpretation.push('Range of observed data unusual under model');
        }
        if (pppChiSq < 0.05 || pppChiSq > 0.95) {
            interpretation.push('Overall fit (chi-square) indicates model misfit');
        }

        return {
            pppValues: {
                mean: pppMean,
                sd: pppSD,
                range: pppRange,
                chiSquare: pppChiSq
            },
            observed: {
                mean: observedMean,
                sd: observedSD,
                range: observedRange,
                chiSquare: observedChiSq
            },
            replicated: {
                meanOfMeans: Stats.mean(repMeans),
                meanOfSDs: Stats.mean(repSDs),
                meanOfRanges: Stats.mean(repRanges),
                meanChiSquare: Stats.mean(chiSquares)
            },
            modelFit: interpretation.length === 0 ? 'adequate' : 'potential_misfit',
            interpretation: interpretation.length === 0 ?
                'Model appears to fit the data adequately' :
                `Model fit concerns: ${interpretation.join('; ')}`,
            nReplicates: nRep
        };
    }

    /**
     * Bayesian model comparison (DIC)
     * Reference: Spiegelhalter DJ, et al. (2002). Bayesian measures of model
     * complexity and fit. Journal of the Royal Statistical Society B, 64(4), 583-639.
     */
    function calculateDIC(effects, variances, samples) {
        const { mu, tau } = samples;
        const n = mu.length;

        // Calculate deviance for each sample
        const deviances = mu.map((m, i) =>
            -2 * logLikelihood(effects, variances, m, tau[i])
        );

        // Mean deviance
        const Dbar = Stats.mean(deviances);

        // Deviance at posterior mean
        const muMean = Stats.mean(mu);
        const tauMean = Stats.mean(tau);
        const DthetaBar = -2 * logLikelihood(effects, variances, muMean, tauMean);

        // Effective number of parameters
        const pD = Dbar - DthetaBar;

        // DIC
        const DIC = Dbar + pD;

        return { DIC, pD, Dbar, DthetaBar };
    }

    /**
     * Bayesian predictive distribution for new study
     */
    function predictNewStudy(samples, sampleSize = 1000) {
        const { mu, tau } = samples;
        const n = mu.length;

        const predictions = [];
        for (let i = 0; i < sampleSize; i++) {
            const idx = Math.floor(random() * n);
            const newTheta = rnorm(mu[idx], tau[idx]);
            predictions.push(newTheta);
        }

        return posteriorSummary(predictions);
    }

    // ============================================
    // Bayesian Dose-Response Meta-Analysis
    // ============================================

    /**
     * Bayesian dose-response meta-analysis
     * Implements MCMC for dose-response curve estimation
     *
     * Models available:
     * - linear: y = beta * dose
     * - quadratic: y = beta1 * dose + beta2 * dose^2
     * - spline: Restricted cubic spline
     *
     * @param {Array} data - Dose-response data with study, dose, yi, vi
     * @param {Object} options - Model and MCMC options
     * @returns {Object} Posterior summaries and diagnostics
     */
    function bayesianDoseResponse(data, options = {}) {
        const {
            model = 'linear',
            iterations = 10000,
            burnin = 2000,
            chains = 4,
            priorBeta = { mu: 0, sigma: 10 },
            priorTau = { type: 'halfCauchy', scale: 0.5 },
            knots = 3
        } = options;

        // Prepare data
        const doses = data.map(d => d.dose);
        const y = data.map(d => d.yi);
        const v = data.map(d => d.vi);
        const n = data.length;

        // Build design matrix based on model
        let X;
        let nParams;
        switch (model) {
            case 'linear':
                X = doses.map(d => [d]);
                nParams = 1;
                break;
            case 'quadratic':
                X = doses.map(d => [d, d * d]);
                nParams = 2;
                break;
            case 'spline':
                const knotPositions = calculateKnotsForBayes(doses, knots);
                X = doses.map(d => rcSplineBasisForBayes(d, knotPositions));
                nParams = knots - 1;
                break;
            default:
                X = doses.map(d => [d]);
                nParams = 1;
        }

        // Run MCMC
        const chainResults = [];
        for (let chain = 0; chain < chains; chain++) {
            const samples = bayesDRSampler(X, y, v, nParams, iterations, burnin, priorBeta, priorTau);
            chainResults.push(samples);
        }

        // Combine chains and calculate summaries
        const betaSamples = [];
        const tauSamples = [];

        chainResults.forEach(chain => {
            for (let i = 0; i < chain.beta.length; i++) {
                betaSamples.push(chain.beta[i]);
                tauSamples.push(chain.tau[i]);
            }
        });

        // Posterior summaries for each beta coefficient
        const coefficients = [];
        for (let p = 0; p < nParams; p++) {
            const samples = betaSamples.map(b => b[p]);
            coefficients.push({
                name: model === 'linear' ? 'slope' :
                      model === 'quadratic' ? (p === 0 ? 'linear' : 'quadratic') :
                      `spline${p + 1}`,
                ...posteriorSummary(samples),
                probPositive: samples.filter(x => x > 0).length / samples.length,
                probNegative: samples.filter(x => x < 0).length / samples.length
            });
        }

        // Heterogeneity summary
        const tauSummary = posteriorSummary(tauSamples);

        // Convergence diagnostics
        const diagnostics = {
            beta: coefficients.map((_, p) => ({
                rhat: rhat(chainResults.map(c => c.beta.map(b => b[p]))),
                ess: effectiveSampleSize(betaSamples.map(b => b[p]))
            })),
            tau: {
                rhat: rhat(chainResults.map(c => c.tau)),
                ess: effectiveSampleSize(tauSamples)
            }
        };

        // Check convergence
        const allRhats = [
            ...diagnostics.beta.map(d => d.rhat),
            diagnostics.tau.rhat
        ];
        const allESS = [
            ...diagnostics.beta.map(d => d.ess),
            diagnostics.tau.ess
        ];

        const converged = allRhats.every(r => r < CONFIG.convergence.rhatThreshold);
        const reliable = allESS.every(e => e > CONFIG.convergence.essWarning);

        // Generate posterior predictive curve
        const predictionCurve = generateBayesDRCurve(doses, betaSamples, model, knots);

        return {
            model: model,
            coefficients: coefficients,
            tau: tauSummary,
            predictionCurve: predictionCurve,
            diagnostics: {
                ...diagnostics,
                converged: converged,
                reliable: reliable,
                summary: converged && reliable ?
                    'Convergence diagnostics satisfactory' :
                    !converged ? 'WARNING: MCMC chains have not converged' :
                    'WARNING: Low effective sample size'
            },
            nStudies: [...new Set(data.map(d => d.study))].length,
            nPoints: n,
            mcmc: {
                iterations: iterations,
                burnin: burnin,
                chains: chains
            }
        };
    }

    /**
     * MCMC sampler for Bayesian dose-response
     */
    function bayesDRSampler(X, y, v, nParams, iterations, burnin, priorBeta, priorTau) {
        const n = y.length;
        const samples = {
            beta: [],
            tau: []
        };

        // Initialize parameters
        let beta = new Array(nParams).fill(0).map(() => rnorm(0, 0.1));
        let tau = rhalfcauchy(0.5);
        let tau2 = tau * tau;

        for (let iter = 0; iter < iterations; iter++) {
            // Sample beta coefficients using Metropolis-Hastings
            for (let p = 0; p < nParams; p++) {
                const propBeta = [...beta];
                propBeta[p] = rnorm(beta[p], 0.1);

                const currentLL = drLogLikelihood(X, y, v, beta, tau2);
                const propLL = drLogLikelihood(X, y, v, propBeta, tau2);

                const currentPrior = -0.5 * Math.pow(beta[p] / priorBeta.sigma, 2);
                const propPrior = -0.5 * Math.pow(propBeta[p] / priorBeta.sigma, 2);

                const logAccept = (propLL + propPrior) - (currentLL + currentPrior);

                if (Math.log(random()) < logAccept) {
                    beta = propBeta;
                }
            }

            // Sample tau using MH
            const propLogTau = Math.log(tau) + rnorm(0, 0.1);
            const propTau = Math.exp(propLogTau);
            const propTau2 = propTau * propTau;

            const currentLL = drLogLikelihood(X, y, v, beta, tau2);
            const propLL = drLogLikelihood(X, y, v, beta, propTau2);

            const currentPrior = Priors.tau[priorTau.type](tau, priorTau.scale);
            const propPrior = Priors.tau[priorTau.type](propTau, priorTau.scale);

            const logAccept = (propLL + propPrior) - (currentLL + currentPrior) + propLogTau - Math.log(tau);

            if (Math.log(random()) < logAccept) {
                tau = propTau;
                tau2 = propTau2;
            }

            // Store samples after burnin
            if (iter >= burnin) {
                samples.beta.push([...beta]);
                samples.tau.push(tau);
            }
        }

        return samples;
    }

    /**
     * Log-likelihood for dose-response model
     */
    function drLogLikelihood(X, y, v, beta, tau2) {
        let ll = 0;
        const n = y.length;

        for (let i = 0; i < n; i++) {
            let pred = 0;
            for (let p = 0; p < beta.length; p++) {
                pred += beta[p] * X[i][p];
            }
            const totalVar = v[i] + tau2;
            const resid = y[i] - pred;
            ll -= 0.5 * Math.log(2 * Math.PI * totalVar);
            ll -= 0.5 * resid * resid / totalVar;
        }

        return ll;
    }

    /**
     * Calculate knots for Bayesian spline
     */
    function calculateKnotsForBayes(doses, n) {
        const sorted = [...doses].sort((a, b) => a - b);
        const knots = [];
        for (let i = 1; i <= n; i++) {
            const p = i / (n + 1);
            const idx = Math.floor(p * sorted.length);
            knots.push(sorted[idx]);
        }
        return knots;
    }

    /**
     * Restricted cubic spline basis for Bayesian model
     */
    function rcSplineBasisForBayes(x, knots) {
        const k = knots.length;
        const basis = [x];

        for (let j = 0; j < k - 2; j++) {
            const term = Math.pow(Math.max(0, x - knots[j]), 3) -
                        (knots[k-1] - knots[j]) / (knots[k-1] - knots[k-2]) *
                        Math.pow(Math.max(0, x - knots[k-2]), 3) +
                        (knots[k-2] - knots[j]) / (knots[k-1] - knots[k-2]) *
                        Math.pow(Math.max(0, x - knots[k-1]), 3);
            basis.push(term);
        }

        return basis;
    }

    /**
     * Generate posterior predictive dose-response curve
     */
    function generateBayesDRCurve(doses, betaSamples, model, knots = 3) {
        const minDose = Math.min(...doses);
        const maxDose = Math.max(...doses);
        const nPoints = 100;
        const step = (maxDose - minDose) / nPoints;

        const knotPositions = calculateKnotsForBayes(doses, knots);
        const curve = [];

        for (let dose = minDose; dose <= maxDose; dose += step) {
            // Get design vector for this dose
            let x;
            switch (model) {
                case 'linear':
                    x = [dose];
                    break;
                case 'quadratic':
                    x = [dose, dose * dose];
                    break;
                case 'spline':
                    x = rcSplineBasisForBayes(dose, knotPositions);
                    break;
                default:
                    x = [dose];
            }

            // Calculate predicted effect for each posterior sample
            const predictions = betaSamples.map(beta => {
                let pred = 0;
                for (let p = 0; p < beta.length; p++) {
                    pred += beta[p] * x[p];
                }
                return pred;
            });

            // Summarize predictions
            const sorted = [...predictions].sort((a, b) => a - b);
            const n = sorted.length;

            const idx025 = n > 0 ? Math.max(0, Math.floor(n * 0.025)) : 0;
            const idx975 = n > 0 ? Math.min(n - 1, Math.floor(n * 0.975)) : 0;
            const idx50 = n > 0 ? Math.floor(n * 0.5) : 0;

            curve.push({
                dose: dose,
                effect: n > 0 ? Stats.mean(predictions) : NaN,
                ci: n > 0 ? [sorted[idx025], sorted[idx975]] : [NaN, NaN],
                median: n > 0 ? sorted[idx50] : NaN
            });
        }

        return curve;
    }

    // ============================================
    // Public API
    // ============================================

    // ============================================
    // BAYES FACTORS FOR MODEL COMPARISON
    // Reference: Gronau QF, et al. (2017). A tutorial on bridge sampling.
    // Journal of Mathematical Psychology, 81, 80-97.
    // Rouder JN, Morey RD. (2012). Default Bayes factors for model selection
    // in regression. Multivariate Behavioral Research, 47(6), 877-903.
    // ============================================

    /**
     * Calculate Bayes Factor comparing random-effects vs fixed-effect model
     * Uses Savage-Dickey density ratio when tau=0 is nested
     * @param {Array} effects - Effect sizes
     * @param {Array} variances - Variances
     * @param {Object} options - Prior options
     * @returns {Object} Bayes factor results
     */
    function bayesFactorREvsRE(effects, variances, options = {}) {
        const {
            tauPrior = 'halfCauchy',  // halfCauchy, halfNormal, uniform
            tauScale = 0.5,
            muPrior = 'normal',
            muScale = 10,
            nSamples = 50000,
            burnin = 5000
        } = options;

        // Sample from posterior
        const posteriorChains = gibbsSampler(effects, variances, {
            iterations: nSamples + burnin,
            burnin: burnin,
            priorMu: { type: muPrior, mu0: 0, sigma0: muScale },
            priorTau: { type: tauPrior, scale: tauScale }
        });

        const tauSamples = posteriorChains.flatMap(r => r.samples.tau);

        // Posterior density at tau=0 using kernel density estimation
        const posteriorAtZero = kernelDensityAtPoint(tauSamples, 0);

        // Prior density at tau=0
        let priorAtZero;
        if (tauPrior === 'halfCauchy') {
            priorAtZero = 2 / (Math.PI * tauScale);  // Half-Cauchy at 0
        } else if (tauPrior === 'halfNormal') {
            priorAtZero = 2 / (tauScale * Math.sqrt(2 * Math.PI));  // Half-normal at 0
        } else {
            priorAtZero = 1 / tauScale;  // Uniform
        }

        // Savage-Dickey ratio: BF_01 = p(tau=0|data) / p(tau=0)
        const bf01 = posteriorAtZero / priorAtZero;
        const bf10 = 1 / bf01;  // Evidence for random effects

        return {
            bf10: bf10,  // Evidence for heterogeneity (RE model)
            bf01: bf01,  // Evidence for no heterogeneity (FE model)
            logBF10: Math.log(bf10),
            interpretation: interpretBayesFactor(bf10),
            posteriorProbRE: bf10 / (1 + bf10),  // P(RE model | data)
            posteriorProbFE: 1 / (1 + bf10),    // P(FE model | data)
            method: 'Savage-Dickey',
            nSamples: nSamples
        };
    }

    /**
     * Bayes Factor for effect vs no effect (mu = 0)
     * Tests H0: mu = 0 vs H1: mu != 0
     */
    function bayesFactorEffect(effects, variances, options = {}) {
        const {
            muPriorScale = 1,  // Scale of Cauchy prior for effect
            nSamples = 50000
        } = options;

        // Sample from posterior (Cauchy prior approximated via wide normal)
        const sampleChains = gibbsSampler(effects, variances, {
            iterations: nSamples + 5000,
            burnin: 5000,
            priorMu: { type: 'normal', mu0: 0, sigma0: muPriorScale * 5 },
            priorTau: { type: 'halfCauchy', scale: 0.5 }
        });

        const muSamples = sampleChains.flatMap(r => r.samples.mu);

        // Posterior density at mu=0
        const posteriorAtZero = kernelDensityAtPoint(muSamples, 0);

        // Prior density at mu=0 (Cauchy)
        const priorAtZero = 1 / (Math.PI * muPriorScale);

        const bf01 = posteriorAtZero / priorAtZero;
        const bf10 = 1 / bf01;

        return {
            bf10: bf10,  // Evidence for effect
            bf01: bf01,  // Evidence for null
            logBF10: Math.log(bf10),
            interpretation: interpretBayesFactor(bf10),
            posteriorProbEffect: bf10 / (1 + bf10),
            method: 'Savage-Dickey'
        };
    }

    /**
     * Bridge sampling for marginal likelihood estimation
     * More accurate than Savage-Dickey for complex models
     */
    function bridgeSampling(posteriorSamples, logPosterior, logProposal, options = {}) {
        const {
            nIterations = 1000,
            tolerance = 1e-6
        } = options;

        const n1 = posteriorSamples.length;
        const n2 = n1;  // Proposal samples

        // Generate proposal samples (use posterior as proposal)
        const proposalSamples = posteriorSamples.slice(0, n2);

        // Initial estimate
        let logML = 0;

        for (let iter = 0; iter < nIterations; iter++) {
            // Numerator: E_2[l(theta) / (s1 * l(theta) + s2 * g(theta) * r)]
            let num = 0;
            proposalSamples.forEach(theta => {
                const l = Math.exp(logPosterior(theta));
                const g = Math.exp(logProposal(theta));
                const r = Math.exp(logML);
                num += l / (n1 * l + n2 * g * r);
            });
            num /= n2;

            // Denominator: E_1[g(theta) / (s1 * l(theta) + s2 * g(theta) * r)]
            let den = 0;
            posteriorSamples.forEach(theta => {
                const l = Math.exp(logPosterior(theta));
                const g = Math.exp(logProposal(theta));
                const r = Math.exp(logML);
                den += g / (n1 * l + n2 * g * r);
            });
            den /= n1;

            const newLogML = Math.log(num) - Math.log(den);

            if (Math.abs(newLogML - logML) < tolerance) {
                logML = newLogML;
                break;
            }
            logML = newLogML;
        }

        return {
            logMarginalLikelihood: logML,
            marginalLikelihood: Math.exp(logML)
        };
    }

    /**
     * Kernel density estimation at a point
     */
    function kernelDensityAtPoint(samples, x, bandwidth = null) {
        const n = samples.length;

        // Silverman's rule of thumb for bandwidth
        if (!bandwidth) {
            const sd = Statistics.sd(samples);
            bandwidth = 1.06 * sd * Math.pow(n, -0.2);
        }

        // Gaussian kernel
        let density = 0;
        samples.forEach(xi => {
            const z = (x - xi) / bandwidth;
            density += Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
        });
        density /= (n * bandwidth);

        return density;
    }

    /**
     * Interpret Bayes Factor magnitude
     * Based on Jeffreys (1961) and Lee & Wagenmakers (2013)
     */
    function interpretBayesFactor(bf) {
        const absBF = Math.abs(bf);

        if (absBF > 100) return 'Extreme evidence';
        if (absBF > 30) return 'Very strong evidence';
        if (absBF > 10) return 'Strong evidence';
        if (absBF > 3) return 'Moderate evidence';
        if (absBF > 1) return 'Anecdotal evidence';
        if (absBF === 1) return 'No evidence';
        if (absBF > 1/3) return 'Anecdotal evidence against';
        if (absBF > 1/10) return 'Moderate evidence against';
        if (absBF > 1/30) return 'Strong evidence against';
        if (absBF > 1/100) return 'Very strong evidence against';
        return 'Extreme evidence against';
    }

    /**
     * Comprehensive Bayesian model comparison
     * Compares multiple models and returns posterior model probabilities
     */
    function bayesianModelComparison(effects, variances, options = {}) {
        const models = ['FE', 'RE_halfCauchy', 'RE_halfNormal'];
        const logMLs = [];

        // Fixed-effect model (approximate FE by very tight half-normal prior on tau)
        const feSamples = gibbsSampler(effects, variances, {
            iterations: 20000,
            burnin: 2000,
            priorTau: { type: 'halfNormal', scale: 0.001 }
        });
        logMLs.push(estimateLogML_Laplace(effects, variances, feSamples, 'FE'));

        // Random-effects with half-Cauchy
        const reHC = gibbsSampler(effects, variances, {
            iterations: 20000,
            burnin: 2000,
            priorTau: { type: 'halfCauchy', scale: 0.5 }
        });
        logMLs.push(estimateLogML_Laplace(effects, variances, reHC, 'RE'));

        // Random-effects with half-Normal
        const reHN = gibbsSampler(effects, variances, {
            iterations: 20000,
            burnin: 2000,
            priorTau: { type: 'halfNormal', scale: 0.5 }
        });
        logMLs.push(estimateLogML_Laplace(effects, variances, reHN, 'RE'));

        // Convert to posterior probabilities (equal prior)
        const maxLogML = Math.max(...logMLs);
        const unnormProbs = logMLs.map(l => Math.exp(l - maxLogML));
        const sumProbs = unnormProbs.reduce((a, b) => a + b, 0);
        const posteriorProbs = unnormProbs.map(p => p / sumProbs);

        // Bayes factors relative to best model
        const bestIdx = logMLs.indexOf(maxLogML);
        const bayesFactors = logMLs.map(l => Math.exp(l - maxLogML));

        return {
            models: models,
            logMarginalLikelihoods: logMLs,
            posteriorProbabilities: posteriorProbs,
            bayesFactors: bayesFactors,
            bestModel: models[bestIdx],
            bestPosteriorProb: posteriorProbs[bestIdx]
        };
    }

    /**
     * Laplace approximation for log marginal likelihood
     */
    function estimateLogML_Laplace(effects, variances, samples, modelType) {
        const k = effects.length;

        // Combine chains and get MAP estimates
        const allMu = samples.flatMap(r => r.samples.mu);
        const allTau = samples.flatMap(r => r.samples.tau);
        const muMAP = Statistics.mean(allMu);
        const tauMAP = modelType === 'FE' ? 0 : Statistics.mean(allTau);

        // Log likelihood at MAP
        let logLik = 0;
        for (let i = 0; i < k; i++) {
            const v = variances[i] + tauMAP * tauMAP;
            logLik += -0.5 * Math.log(2 * Math.PI * v);
            logLik += -0.5 * Math.pow(effects[i] - muMAP, 2) / v;
        }

        // Log prior at MAP (simplified)
        const logPrior = -0.5 * Math.pow(muMAP / 10, 2);  // N(0, 10)

        // Laplace correction (simplified)
        const correction = modelType === 'FE' ? 0.5 : 1;

        return logLik + logPrior - correction * Math.log(k);
    }


    return {
        // Bayes factors
        bayesFactorREvsRE,
        bayesFactorEffect,
        bridgeSampling,
        kernelDensityAtPoint,
        interpretBayesFactor,
        bayesianModelComparison,

        // Main functions
        bayesianMetaAnalysis,
        bayesianDoseResponse,
        TurnerPriors,
        gibbsSampler,
        metropolisHastings,

        // Diagnostics
        rhat,
        effectiveSampleSize,
        mcse,
        geweke,
        interpretDiagnostics,

        // Posterior predictive checks
        posteriorPredictiveCheck,

        // Summaries
        posteriorSummary,
        hpd,

        // Model comparison
        calculateDIC,
        predictNewStudy,

        // Random number generators (seedable for reproducibility)
        setSeed, clearSeed,
        rnorm, rgamma, rinvgamma, rhalfnorm, rhalfcauchy, runif, rtnorm,

        // Priors
        Priors,

        // Configuration (for customization)
        CONFIG
    };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BayesianMA;
}
