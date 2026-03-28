/**
 * PrognosisMeta - Async Analysis Module
 * High-performance async wrappers for heavy computations
 */

const AsyncAnalysis = (function() {
    'use strict';

    // Progress bar element reference
    let progressContainer = null;
    let progressBar = null;
    let progressText = null;
    let progressMessage = null;

    /**
     * Initialize progress UI
     */
    function initProgressUI() {
        // Create progress container if not exists
        if (!document.getElementById('global-progress')) {
            const container = document.createElement('div');
            container.id = 'global-progress';
            container.className = 'global-progress hidden';
            container.innerHTML = `
                <div class="progress-content">
                    <div class="progress-header">
                        <span class="progress-title">Processing...</span>
                        <span class="progress-percent">0%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill"></div>
                    </div>
                    <div class="progress-message"></div>
                    <div class="progress-eta">Estimated time remaining: calculating...</div>
                </div>
            `;
            document.body.appendChild(container);

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .global-progress {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 350px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    padding: 16px;
                    z-index: 10000;
                    transition: opacity 0.3s, transform 0.3s;
                }
                .global-progress.hidden {
                    opacity: 0;
                    transform: translateY(20px);
                    pointer-events: none;
                }
                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-weight: 600;
                }
                .progress-title {
                    color: #374151;
                }
                .progress-percent {
                    color: #2563eb;
                }
                .progress-bar-container {
                    height: 8px;
                    background: #e5e7eb;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .progress-bar-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #2563eb, #3b82f6);
                    border-radius: 4px;
                    width: 0%;
                    transition: width 0.1s;
                }
                .progress-message {
                    margin-top: 8px;
                    font-size: 0.875rem;
                    color: #6b7280;
                }
                .progress-eta {
                    margin-top: 4px;
                    font-size: 0.75rem;
                    color: #9ca3af;
                }
            `;
            document.head.appendChild(style);
        }

        progressContainer = document.getElementById('global-progress');
        progressBar = progressContainer.querySelector('.progress-bar-fill');
        progressText = progressContainer.querySelector('.progress-percent');
        progressMessage = progressContainer.querySelector('.progress-message');
    }

    /**
     * Show progress UI
     */
    function showProgress(title = 'Processing...') {
        if (!progressContainer) initProgressUI();
        progressContainer.querySelector('.progress-title').textContent = title;
        progressContainer.classList.remove('hidden');
        updateProgress(0, 'Starting...');
    }

    /**
     * Update progress
     */
    function updateProgress(value, message = '') {
        if (!progressBar) return;
        const percent = Math.round(value * 100);
        progressBar.style.width = percent + '%';
        progressText.textContent = percent + '%';
        if (message) {
            progressMessage.textContent = message;
        }
    }

    /**
     * Hide progress UI
     */
    function hideProgress() {
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
    }

    /**
     * Format time remaining
     */
    function formatTime(ms) {
        if (ms < 1000) return 'less than a second';
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds} second${seconds > 1 ? 's' : ''}`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

    // ==========================================
    // ASYNC ANALYSIS FUNCTIONS
    // ==========================================

    /**
     * Run GOSH analysis asynchronously
     */
    async function goshAsync(data, options = {}) {
        showProgress('Running GOSH Analysis');
        const startTime = Date.now();

        try {
            // Use worker pool if available
            if (typeof WorkerPool !== 'undefined' && WorkerPool.isSupported()) {
                const result = await WorkerPool.gosh(data, options, (progress) => {
                    const elapsed = Date.now() - startTime;
                    const eta = progress > 0 ? (elapsed / progress) - elapsed : 0;
                    updateProgress(progress, `Analyzing ${Math.round(progress * (options.nSubsets || 1000))} subsets...`);
                    if (progressContainer) {
                        progressContainer.querySelector('.progress-eta').textContent =
                            `Estimated time remaining: ${formatTime(eta)}`;
                    }
                });
                hideProgress();
                return result;
            } else {
                // Fallback to batched processing
                return await goshBatched(data, options);
            }
        } catch (error) {
            hideProgress();
            throw error;
        }
    }

    /**
     * Batched GOSH for fallback (no workers)
     */
    async function goshBatched(data, options = {}) {
        const { nSubsets = 1000, minK = 2, method = 'REML' } = options;
        const yi = data.map(d => d.yi);
        const vi = data.map(d => d.vi);
        const k = yi.length;

        // Protect against bitmask overflow for k > 30
        const maxCombinations = k <= 30 ? (1 << k) - 1 : Number.MAX_SAFE_INTEGER;
        const actualSubsets = Math.min(nSubsets, maxCombinations);
        const results = [];
        const usedMasks = new Set();

        const batchSize = 50;

        for (let i = 0; i < actualSubsets; i += batchSize) {
            const batchEnd = Math.min(i + batchSize, actualSubsets);

            for (let j = i; j < batchEnd; j++) {
                let mask;
                if (actualSubsets === maxCombinations) {
                    mask = j + 1;
                } else {
                    do {
                        mask = Math.floor(Math.random() * maxCombinations) + 1;
                    } while (usedMasks.has(mask));
                }
                usedMasks.add(mask);

                // Count bits
                let count = 0, temp = mask;
                while (temp) { count += temp & 1; temp >>= 1; }
                if (count < minK) continue;

                // Extract subset
                const subYi = [], subVi = [];
                for (let b = 0; b < k; b++) {
                    if (mask & (1 << b)) {
                        subYi.push(yi[b]);
                        subVi.push(vi[b]);
                    }
                }

                // Calculate (with module existence check)
                if (typeof MetaAnalysis === 'undefined') {
                    throw new Error('MetaAnalysis module not loaded');
                }
                const tau2 = method === 'REML' ?
                    MetaAnalysis.tau2REML(subYi, subVi) :
                    MetaAnalysis.tau2DL(subYi, subVi);

                const weights = subVi.map(v => 1 / (v + tau2));
                const sumW = weights.reduce((a, b) => a + b, 0);
                const pooled = sumW > 0 ? subYi.reduce((s, y, idx) => s + weights[idx] * y, 0) / sumW : 0;

                const { Q } = MetaAnalysis.calculateQ(subYi, subVi);
                const I2 = Q > (count - 1) ? 100 * (Q - count + 1) / Q : 0;

                results.push({ estimate: pooled, I2, k: count, mask });
            }

            updateProgress(batchEnd / actualSubsets, `Processed ${batchEnd}/${actualSubsets} subsets`);
            await new Promise(r => setTimeout(r, 0)); // Yield to UI
        }

        hideProgress();
        return results;
    }

    /**
     * Run Bayesian MCMC asynchronously
     */
    async function bayesianAsync(data, options = {}) {
        showProgress('Running Bayesian MCMC');
        const startTime = Date.now();

        try {
            if (typeof WorkerPool !== 'undefined' && WorkerPool.isSupported()) {
                const result = await WorkerPool.bayesian(data, options, (progress) => {
                    const elapsed = Date.now() - startTime;
                    const eta = progress > 0 ? (elapsed / progress) - elapsed : 0;
                    updateProgress(progress, `MCMC iteration ${Math.round(progress * (options.iterations || 10000))}...`);
                    if (progressContainer) {
                        progressContainer.querySelector('.progress-eta').textContent =
                            `Estimated time remaining: ${formatTime(eta)}`;
                    }
                });
                hideProgress();
                return result;
            } else {
                // Fallback to main thread (will be slow)
                console.warn('Web Workers not available - MCMC will be slow');
                hideProgress();
                if (typeof BayesianMeta === 'undefined') {
                    throw new Error('BayesianMeta module not loaded');
                }
                return BayesianMeta.runMCMC(data, options);
            }
        } catch (error) {
            hideProgress();
            throw error;
        }
    }

    /**
     * Run Monte Carlo simulation asynchronously
     */
    async function simulationAsync(config, options = {}) {
        showProgress('Running Simulation');
        const { nsim = 1000 } = config;
        const results = [];

        for (let i = 0; i < nsim; i++) {
            // Generate one simulation
            const simData = generateSimulatedData(config);
            const analysis = runSingleAnalysis(simData, options);
            results.push(analysis);

            if (i % 10 === 0) {
                updateProgress(i / nsim, `Simulation ${i + 1}/${nsim}`);
                await new Promise(r => setTimeout(r, 0));
            }
        }

        hideProgress();
        return aggregateSimulationResults(results, config);
    }

    /**
     * Generate simulated meta-analysis data
     */
    function generateSimulatedData(config) {
        if (typeof Statistics === 'undefined') {
            throw new Error('Statistics module not loaded');
        }
        const { k = 10, trueEffect = 0.5, trueTau2 = 0.1, nRange = [30, 100] } = config;
        const data = [];

        for (let i = 0; i < k; i++) {
            const n = Math.floor(Math.random() * (nRange[1] - nRange[0])) + nRange[0];
            const theta = trueEffect + Math.sqrt(trueTau2) * Statistics.qnorm(Math.random());
            const se = Math.sqrt(4 / n); // Approximate SE for SMD
            const yi = theta + se * Statistics.qnorm(Math.random());

            data.push({ study: `Study ${i + 1}`, yi, vi: se * se, n });
        }

        return data;
    }

    /**
     * Run single analysis for simulation
     */
    function runSingleAnalysis(data, options) {
        if (typeof MetaAnalysis === 'undefined' || typeof Statistics === 'undefined') {
            throw new Error('Required modules not loaded');
        }
        const yi = data.map(d => d.yi);
        const vi = data.map(d => d.vi);

        const tau2 = MetaAnalysis.tau2REML(yi, vi);
        const weights = vi.map(v => 1 / (v + tau2));
        const sumW = weights.reduce((a, b) => a + b, 0);
        const estimate = yi.reduce((s, y, i) => s + weights[i] * y, 0) / sumW;
        const se = Math.sqrt(1 / sumW);
        const z = estimate / se;
        const pvalue = 2 * (1 - Statistics.pnorm(Math.abs(z)));

        return { estimate, se, tau2, pvalue, significant: pvalue < 0.05 };
    }

    /**
     * Aggregate simulation results
     */
    function aggregateSimulationResults(results, config) {
        const estimates = results.map(r => r.estimate);
        const tau2s = results.map(r => r.tau2);

        return {
            meanEstimate: Statistics.mean(estimates),
            bias: Statistics.mean(estimates) - config.trueEffect,
            rmse: Math.sqrt(Statistics.mean(estimates.map(e => (e - config.trueEffect) ** 2))),
            coverage: results.filter(r => {
                const ci = [r.estimate - 1.96 * r.se, r.estimate + 1.96 * r.se];
                return config.trueEffect >= ci[0] && config.trueEffect <= ci[1];
            }).length / (results.length || 1),
            power: results.filter(r => r.significant).length / (results.length || 1),
            tau2Bias: Statistics.mean(tau2s) - config.trueTau2
        };
    }

    // ==========================================
    // PARALLEL META-ANALYSIS
    // ==========================================

    /**
     * Run multiple analyses in parallel
     */
    async function parallelAnalyses(datasets, analysisType = 'standard') {
        showProgress('Running Parallel Analyses');

        const results = [];
        const total = datasets.length;

        // Process in batches of 4
        const batchSize = 4;
        for (let i = 0; i < total; i += batchSize) {
            const batch = datasets.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(data => {
                    switch (analysisType) {
                        case 'bayesian':
                            return bayesianAsync(data, { iterations: 5000 });
                        case 'gosh':
                            return goshAsync(data, { nSubsets: 500 });
                        default:
                            return Promise.resolve(runSingleAnalysis(data, {}));
                    }
                })
            );
            results.push(...batchResults);
            updateProgress((i + batch.length) / total);
        }

        hideProgress();
        return results;
    }

    // ==========================================
    // EXPORTS
    // ==========================================

    return {
        // Progress UI
        showProgress,
        updateProgress,
        hideProgress,
        initProgressUI,

        // Async analysis
        goshAsync,
        bayesianAsync,
        simulationAsync,
        parallelAnalyses,

        // Utilities
        formatTime
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AsyncAnalysis;
}
