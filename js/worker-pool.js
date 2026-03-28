/**
 * PrognosisMeta - High-Performance Worker Pool
 * Offloads heavy computations to background threads
 */

const WorkerPool = (function() {
    'use strict';

    const MAX_WORKERS = navigator.hardwareConcurrency || 4;
    let workers = [];
    let taskQueue = [];
    let taskId = 0;
    let pendingTasks = new Map();

    // Worker code as blob
    const workerCode = `
        // Import math functions into worker
        const EPSILON = 1e-12;
        const MAX_ITERATIONS = 1000;

        // ==========================================
        // OPTIMIZED MATRIX OPERATIONS (Typed Arrays)
        // ==========================================

        class FastMatrix {
            constructor(rows, cols, data = null) {
                this.rows = rows;
                this.cols = cols;
                this.data = data || new Float64Array(rows * cols);
            }

            get(i, j) {
                return this.data[i * this.cols + j];
            }

            set(i, j, val) {
                this.data[i * this.cols + j] = val;
            }

            static fromArray(arr) {
                const rows = arr.length;
                const cols = arr[0].length;
                const m = new FastMatrix(rows, cols);
                for (let i = 0; i < rows; i++) {
                    for (let j = 0; j < cols; j++) {
                        m.set(i, j, arr[i][j]);
                    }
                }
                return m;
            }

            toArray() {
                const result = [];
                for (let i = 0; i < this.rows; i++) {
                    result[i] = [];
                    for (let j = 0; j < this.cols; j++) {
                        result[i][j] = this.get(i, j);
                    }
                }
                return result;
            }

            // Cache-efficient multiplication (row-major order)
            static multiply(A, B) {
                if (A.cols !== B.rows) throw new Error('Matrix dimension mismatch');
                const C = new FastMatrix(A.rows, B.cols);

                // Transpose B for cache efficiency
                const Bt = new Float64Array(B.cols * B.rows);
                for (let i = 0; i < B.rows; i++) {
                    for (let j = 0; j < B.cols; j++) {
                        Bt[j * B.rows + i] = B.get(i, j);
                    }
                }

                for (let i = 0; i < A.rows; i++) {
                    for (let j = 0; j < B.cols; j++) {
                        let sum = 0;
                        const rowA = i * A.cols;
                        const rowBt = j * B.rows;
                        for (let k = 0; k < A.cols; k++) {
                            sum += A.data[rowA + k] * Bt[rowBt + k];
                        }
                        C.set(i, j, sum);
                    }
                }
                return C;
            }

            // LU decomposition with partial pivoting (Doolittle)
            static luDecompose(A) {
                const n = A.rows;
                const L = new FastMatrix(n, n);
                const U = new FastMatrix(n, n);
                const P = new Uint32Array(n);

                // Copy A
                const a = new Float64Array(A.data);

                for (let i = 0; i < n; i++) P[i] = i;

                for (let k = 0; k < n; k++) {
                    // Find pivot
                    let max = Math.abs(a[k * n + k]);
                    let maxRow = k;
                    for (let i = k + 1; i < n; i++) {
                        const val = Math.abs(a[i * n + k]);
                        if (val > max) {
                            max = val;
                            maxRow = i;
                        }
                    }

                    // Swap rows
                    if (maxRow !== k) {
                        const tmp = P[k]; P[k] = P[maxRow]; P[maxRow] = tmp;
                        for (let j = 0; j < n; j++) {
                            const t = a[k * n + j];
                            a[k * n + j] = a[maxRow * n + j];
                            a[maxRow * n + j] = t;
                        }
                    }

                    // Decompose
                    for (let i = k + 1; i < n; i++) {
                        const pivot = a[k * n + k];
                        a[i * n + k] = pivot !== 0 ? a[i * n + k] / pivot : 0;
                        for (let j = k + 1; j < n; j++) {
                            a[i * n + j] -= a[i * n + k] * a[k * n + j];
                        }
                    }
                }

                // Extract L and U
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n; j++) {
                        if (i > j) {
                            L.set(i, j, a[i * n + j]);
                        } else if (i === j) {
                            L.set(i, j, 1);
                            U.set(i, j, a[i * n + j]);
                        } else {
                            U.set(i, j, a[i * n + j]);
                        }
                    }
                }

                return { L, U, P };
            }

            // Fast matrix inverse using LU decomposition
            static inverse(A) {
                const n = A.rows;
                const { L, U, P } = FastMatrix.luDecompose(A);
                const inv = new FastMatrix(n, n);

                for (let col = 0; col < n; col++) {
                    // Solve Ly = e (forward substitution)
                    const y = new Float64Array(n);
                    for (let i = 0; i < n; i++) {
                        y[i] = (P[i] === col) ? 1 : 0;
                        for (let j = 0; j < i; j++) {
                            y[i] -= L.get(i, j) * y[j];
                        }
                    }

                    // Solve Ux = y (back substitution)
                    const x = new Float64Array(n);
                    for (let i = n - 1; i >= 0; i--) {
                        x[i] = y[i];
                        for (let j = i + 1; j < n; j++) {
                            x[i] -= U.get(i, j) * x[j];
                        }
                        const uii = U.get(i, i);
                        x[i] = uii !== 0 ? x[i] / uii : 0;
                    }

                    for (let i = 0; i < n; i++) {
                        inv.set(i, col, x[i]);
                    }
                }

                return inv;
            }

            static transpose(A) {
                const T = new FastMatrix(A.cols, A.rows);
                for (let i = 0; i < A.rows; i++) {
                    for (let j = 0; j < A.cols; j++) {
                        T.set(j, i, A.get(i, j));
                    }
                }
                return T;
            }
        }

        // ==========================================
        // STATISTICAL FUNCTIONS
        // ==========================================

        function mean(arr) {
            if (arr.length === 0) return 0;
            let sum = 0;
            for (let i = 0; i < arr.length; i++) sum += arr[i];
            return sum / arr.length;
        }

        function variance(arr) {
            if (arr.length < 2) return 0;
            const m = mean(arr);
            let sum = 0;
            for (let i = 0; i < arr.length; i++) {
                const d = arr[i] - m;
                sum += d * d;
            }
            return sum / (arr.length - 1);
        }

        function pnorm(x) {
            const a1 = 0.254829592, a2 = -0.284496736;
            const a3 = 1.421413741, a4 = -1.453152027;
            const a5 = 1.061405429, p = 0.3275911;
            const sign = x < 0 ? -1 : 1;
            x = Math.abs(x) / Math.SQRT2;
            const t = 1.0 / (1.0 + p * x);
            const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
            return 0.5 * (1.0 + sign * y);
        }

        function qnorm(p) {
            if (p <= 0) return -Infinity;
            if (p >= 1) return Infinity;
            if (p === 0.5) return 0;

            const a = [
                -3.969683028665376e+01, 2.209460984245205e+02,
                -2.759285104469687e+02, 1.383577518672690e+02,
                -3.066479806614716e+01, 2.506628277459239e+00
            ];
            const b = [
                -5.447609879822406e+01, 1.615858368580409e+02,
                -1.556989798598866e+02, 6.680131188771972e+01,
                -1.328068155288572e+01
            ];
            const c = [
                -7.784894002430293e-03, -3.223964580411365e-01,
                -2.400758277161838e+00, -2.549732539343734e+00,
                4.374664141464968e+00, 2.938163982698783e+00
            ];
            const d = [
                7.784695709041462e-03, 3.224671290700398e-01,
                2.445134137142996e+00, 3.754408661907416e+00
            ];

            const pLow = 0.02425, pHigh = 1 - pLow;
            let q, r;

            if (p < pLow) {
                q = Math.sqrt(-2 * Math.log(p));
                return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
                       ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
            } else if (p <= pHigh) {
                q = p - 0.5;
                r = q * q;
                return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
                       (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
            } else {
                q = Math.sqrt(-2 * Math.log(1 - p));
                return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
                        ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
            }
        }

        // ==========================================
        // META-ANALYSIS FUNCTIONS (Optimized)
        // ==========================================

        function tau2DL(yi, vi) {
            const k = yi.length;
            const w = vi.map(v => 1 / v);
            const sumW = w.reduce((a, b) => a + b, 0);
            const meanY = yi.reduce((s, y, i) => s + w[i] * y, 0) / sumW;

            let Q = 0;
            for (let i = 0; i < k; i++) {
                Q += w[i] * (yi[i] - meanY) ** 2;
            }

            const sumW2 = w.reduce((s, wi) => s + wi * wi, 0);
            const c = sumW - sumW2 / sumW;

            return c > 0 ? Math.max(0, (Q - k + 1) / c) : 0;
        }

        function tau2REML(yi, vi, maxIter = 100) {
            const k = yi.length;
            let tau2 = tau2DL(yi, vi);

            for (let iter = 0; iter < maxIter; iter++) {
                const w = vi.map(v => 1 / (v + tau2));
                const sumW = w.reduce((a, b) => a + b, 0);
                const meanY = yi.reduce((s, y, i) => s + w[i] * y, 0) / sumW;

                let num = 0, denom = 0;
                for (let i = 0; i < k; i++) {
                    const resid = yi[i] - meanY;
                    num += w[i] * w[i] * (resid * resid - vi[i]);
                    denom += w[i] * w[i];
                }

                const tau2New = denom > 0 ? tau2 + num / denom : tau2;
                if (Math.abs(tau2New - tau2) < 1e-8) break;
                tau2 = Math.max(0, tau2New);
            }

            return tau2;
        }

        function pooledEstimate(yi, vi, tau2) {
            const w = vi.map(v => 1 / (v + tau2));
            const sumW = w.reduce((a, b) => a + b, 0);
            const estimate = yi.reduce((s, y, i) => s + w[i] * y, 0) / sumW;
            const se = Math.sqrt(1 / sumW);
            return { estimate, se, weights: w.map(wi => wi / sumW) };
        }

        // ==========================================
        // GOSH ANALYSIS (Optimized)
        // ==========================================

        function goshAnalysis(data, options) {
            const { nSubsets = 1000, minK = 2, method = 'REML' } = options;
            const yi = data.map(d => d.yi);
            const vi = data.map(d => d.vi);
            const k = yi.length;

            const maxCombinations = k <= 30 ? Math.pow(2, k) - 1 : Infinity;
            const actualSubsets = Math.min(nSubsets, maxCombinations);

            const results = [];
            const usedMasks = new Set();

            // Use bitmask for small k, random index selection for large k
            for (let i = 0; i < actualSubsets; i++) {
                const subYi = [], subVi = [];
                let count = 0;

                if (k <= 30) {
                    // Bitmask approach for small k
                    let mask;
                    if (actualSubsets === maxCombinations) {
                        mask = i + 1;
                    } else {
                        do {
                            mask = Math.floor(Math.random() * maxCombinations) + 1;
                        } while (usedMasks.has(mask));
                    }
                    usedMasks.add(mask);

                    let temp = mask;
                    while (temp) { count += temp & 1; temp >>= 1; }
                    if (count < minK) continue;

                    for (let j = 0; j < k; j++) {
                        if (mask & (1 << j)) {
                            subYi.push(yi[j]);
                            subVi.push(vi[j]);
                        }
                    }
                } else {
                    // Random index selection for large k
                    const size = minK + Math.floor(Math.random() * (k - minK + 1));
                    const indices = [];
                    const avail = Array.from({ length: k }, (_, j) => j);
                    for (let s = 0; s < size; s++) {
                        const idx = Math.floor(Math.random() * avail.length);
                        indices.push(avail[idx]);
                        avail.splice(idx, 1);
                    }
                    indices.sort((a, b) => a - b);
                    const key = indices.join(',');
                    if (usedMasks.has(key)) { continue; }
                    usedMasks.add(key);
                    count = size;

                    for (const j of indices) {
                        subYi.push(yi[j]);
                        subVi.push(vi[j]);
                    }
                }

                const tau2 = method === 'REML' ? tau2REML(subYi, subVi) : tau2DL(subYi, subVi);
                const { estimate } = pooledEstimate(subYi, subVi, tau2);

                // Calculate I²
                const w = subVi.map(v => 1 / v);
                const sumW = w.reduce((a, b) => a + b, 0);
                const meanY = subYi.reduce((s, y, i) => s + w[i] * y, 0) / sumW;
                let Q = 0;
                for (let j = 0; j < subYi.length; j++) {
                    Q += w[j] * (subYi[j] - meanY) ** 2;
                }
                const I2 = Q > (count - 1) ? 100 * (Q - count + 1) / Q : 0;

                results.push({ estimate, I2, k: count, mask });

                // Report progress every 100 iterations
                if (i % 100 === 0) {
                    self.postMessage({ type: 'progress', value: i / actualSubsets, id: self._currentTaskId });
                }
            }

            return results;
        }

        // ==========================================
        // BAYESIAN MCMC (Optimized)
        // ==========================================

        function bayesianMCMC(data, options) {
            const {
                iterations = 10000,
                burnin = 2000,
                chains = 4,
                thin = 1
            } = options;

            const yi = data.map(d => d.yi);
            const vi = data.map(d => d.vi);
            const k = yi.length;

            // Initialize from DL estimate
            const tau2Init = tau2DL(yi, vi);
            const { estimate: muInit } = pooledEstimate(yi, vi, tau2Init);

            const allChains = [];

            for (let chain = 0; chain < chains; chain++) {
                // Disperse starting values
                let mu = muInit + (Math.random() - 0.5) * 0.5;
                let tau = Math.sqrt(tau2Init) * (0.5 + Math.random());

                const samples = { mu: [], tau: [], theta: [] };

                // Adaptive proposal SDs
                let muProposalSD = 0.1;
                let tauProposalSD = 0.05;
                let muAccept = 0, tauAccept = 0;

                for (let iter = 0; iter < iterations + burnin; iter++) {
                    // Gibbs sampling for study effects (conjugate)
                    const theta = [];
                    for (let i = 0; i < k; i++) {
                        const prec = 1 / vi[i] + 1 / (tau * tau + 1e-10);
                        const postMean = (yi[i] / vi[i] + mu / (tau * tau + 1e-10)) / prec;
                        const postSD = Math.sqrt(1 / prec);
                        theta.push(postMean + postSD * qnorm(Math.random()));
                    }

                    // MH for mu
                    const muProp = mu + muProposalSD * qnorm(Math.random());
                    const logRatioMu = -0.5 * theta.reduce((s, t) =>
                        s + ((t - muProp) ** 2 - (t - mu) ** 2) / (tau * tau + 1e-10), 0);

                    if (Math.log(Math.random()) < logRatioMu) {
                        mu = muProp;
                        muAccept++;
                    }

                    // MH for tau (log scale)
                    const logTau = Math.log(tau);
                    const logTauProp = logTau + tauProposalSD * qnorm(Math.random());
                    const tauProp = Math.exp(logTauProp);

                    let logRatioTau = 0;
                    for (let i = 0; i < k; i++) {
                        logRatioTau += -0.5 * Math.log(tauProp * tauProp) -
                            0.5 * (theta[i] - mu) ** 2 / (tauProp * tauProp);
                        logRatioTau -= -0.5 * Math.log(tau * tau) -
                            0.5 * (theta[i] - mu) ** 2 / (tau * tau);
                    }
                    // Half-Cauchy prior on tau
                    logRatioTau += Math.log(1 + tau * tau) - Math.log(1 + tauProp * tauProp);
                    // Jacobian for log transform
                    logRatioTau += logTauProp - logTau;

                    if (Math.log(Math.random()) < logRatioTau) {
                        tau = tauProp;
                        tauAccept++;
                    }

                    // Adapt proposal SDs
                    if (iter < burnin && iter % 100 === 0 && iter > 0) {
                        const muRate = muAccept / 100;
                        const tauRate = tauAccept / 100;
                        if (muRate < 0.2) muProposalSD *= 0.8;
                        else if (muRate > 0.5) muProposalSD *= 1.2;
                        if (tauRate < 0.2) tauProposalSD *= 0.8;
                        else if (tauRate > 0.5) tauProposalSD *= 1.2;
                        muAccept = 0;
                        tauAccept = 0;
                    }

                    // Store samples after burnin
                    if (iter >= burnin && (iter - burnin) % thin === 0) {
                        samples.mu.push(mu);
                        samples.tau.push(tau);
                        samples.theta.push([...theta]);
                    }

                    // Report progress
                    if (iter % 500 === 0) {
                        self.postMessage({
                            type: 'progress',
                            value: (chain * (iterations + burnin) + iter) /
                                   (chains * (iterations + burnin)),
                            id: self._currentTaskId
                        });
                    }
                }

                allChains.push(samples);
            }

            // Combine chains and compute diagnostics
            const combinedMu = allChains.flatMap(c => c.mu);
            const combinedTau = allChains.flatMap(c => c.tau);

            // Compute Rhat
            const n = allChains[0].mu.length;
            const m = chains;
            const chainMeans = allChains.map(c => mean(c.mu));
            const grandMean = mean(chainMeans);
            const B = n * variance(chainMeans);
            const W = mean(allChains.map(c => variance(c.mu)));
            const varPlus = ((n - 1) / n) * W + (1 / n) * B;
            const Rhat = W > 0 ? Math.sqrt(varPlus / W) : 1;

            // Sort copies to avoid mutating original arrays
            const sortedMu = [...combinedMu].sort((a, b) => a - b);
            const sortedTau = [...combinedTau].sort((a, b) => a - b);

            return {
                mu: {
                    mean: mean(combinedMu),
                    median: sortedMu[Math.floor(sortedMu.length / 2)],
                    sd: Math.sqrt(variance(combinedMu)),
                    ci: [
                        sortedMu[Math.floor(0.025 * sortedMu.length)],
                        sortedMu[Math.floor(0.975 * sortedMu.length)]
                    ]
                },
                tau: {
                    mean: mean(combinedTau),
                    median: sortedTau[Math.floor(sortedTau.length / 2)],
                    sd: Math.sqrt(variance(combinedTau)),
                    ci: [
                        sortedTau[Math.floor(0.025 * sortedTau.length)],
                        sortedTau[Math.floor(0.975 * sortedTau.length)]
                    ]
                },
                diagnostics: {
                    Rhat,
                    neff: B > 0 ? Math.floor(m * n * Math.min(1, varPlus / B)) : m * n
                },
                samples: { mu: combinedMu, tau: combinedTau }
            };
        }

        // ==========================================
        // MESSAGE HANDLER
        // ==========================================

        self.onmessage = function(e) {
            const { id, task, data, options } = e.data;
            self._currentTaskId = id;  // Store for progress reporting
            let result;

            try {
                switch (task) {
                    case 'gosh':
                        result = goshAnalysis(data, options || {});
                        break;
                    case 'bayesian':
                        result = bayesianMCMC(data, options || {});
                        break;
                    case 'matrixInverse':
                        const M = FastMatrix.fromArray(data);
                        result = FastMatrix.inverse(M).toArray();
                        break;
                    case 'matrixMultiply':
                        const A = FastMatrix.fromArray(data.A);
                        const B = FastMatrix.fromArray(data.B);
                        result = FastMatrix.multiply(A, B).toArray();
                        break;
                    case 'tau2REML':
                        result = tau2REML(data.yi, data.vi);
                        break;
                    case 'pooled':
                        const tau2 = options.tau2 !== undefined ? options.tau2 : tau2REML(data.yi, data.vi);
                        result = pooledEstimate(data.yi, data.vi, tau2);
                        break;
                    default:
                        throw new Error('Unknown task: ' + task);
                }

                self.postMessage({ id, type: 'result', result });
            } catch (error) {
                self.postMessage({ id, type: 'error', error: error.message });
            }
        };
    `;

    // Create worker blob URL
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    /**
     * Initialize worker pool
     */
    function init() {
        for (let i = 0; i < MAX_WORKERS; i++) {
            const worker = new Worker(workerUrl);
            worker.busy = false;
            worker.onmessage = handleWorkerMessage;
            worker.onerror = handleWorkerError;
            workers.push(worker);
        }
        console.log(`WorkerPool initialized with ${MAX_WORKERS} workers`);
    }

    /**
     * Handle worker response
     */
    function handleWorkerMessage(e) {
        const { id, type, result, error, value } = e.data;
        const worker = e.target;  // Get worker reference from event

        if (type === 'progress') {
            const task = pendingTasks.get(id);
            if (task && task.onProgress) {
                task.onProgress(value);
            }
            return;
        }

        const task = pendingTasks.get(id);
        if (!task) return;

        pendingTasks.delete(id);
        worker.busy = false;

        if (type === 'error') {
            task.reject(new Error(error));
        } else {
            task.resolve(result);
        }

        // Process next task in queue
        processQueue();
    }

    /**
     * Handle worker error
     */
    function handleWorkerError(e) {
        console.error('Worker error:', e);
        this.busy = false;
        processQueue();
    }

    /**
     * Get available worker
     */
    function getAvailableWorker() {
        return workers.find(w => !w.busy);
    }

    /**
     * Process task queue
     */
    function processQueue() {
        if (taskQueue.length === 0) return;

        const worker = getAvailableWorker();
        if (!worker) return;

        const task = taskQueue.shift();
        worker.busy = true;
        worker.postMessage(task.message);
    }

    /**
     * Run task in worker pool
     * @param {string} taskType - Task type (gosh, bayesian, matrixInverse, etc.)
     * @param {any} data - Data to process
     * @param {Object} options - Task options
     * @param {Function} onProgress - Progress callback
     * @returns {Promise} Result promise
     */
    function run(taskType, data, options = {}, onProgress = null) {
        return new Promise((resolve, reject) => {
            const id = ++taskId;
            const message = { id, task: taskType, data, options };

            pendingTasks.set(id, { resolve, reject, onProgress });

            const worker = getAvailableWorker();
            if (worker) {
                worker.busy = true;
                worker.postMessage(message);
            } else {
                taskQueue.push({ message });
            }
        });
    }

    /**
     * Convenience methods
     */
    const api = {
        init,
        run,

        // High-level async methods
        async gosh(data, options = {}, onProgress) {
            return run('gosh', data, options, onProgress);
        },

        async bayesian(data, options = {}, onProgress) {
            return run('bayesian', data, options, onProgress);
        },

        async matrixInverse(matrix) {
            return run('matrixInverse', matrix);
        },

        async matrixMultiply(A, B) {
            return run('matrixMultiply', { A, B });
        },

        async tau2REML(yi, vi) {
            return run('tau2REML', { yi, vi });
        },

        async pooledEstimate(yi, vi, options = {}) {
            return run('pooled', { yi, vi }, options);
        },

        // Check if workers are supported
        isSupported() {
            return typeof Worker !== 'undefined';
        },

        // Get pool status
        status() {
            return {
                workers: workers.length,
                busy: workers.filter(w => w.busy).length,
                queued: taskQueue.length,
                pending: pendingTasks.size
            };
        },

        // Terminate all workers
        terminate() {
            workers.forEach(w => w.terminate());
            workers = [];
            taskQueue = [];
            pendingTasks.clear();
            URL.revokeObjectURL(workerUrl);  // Prevent blob URL memory leak
        }
    };

    // Auto-initialize if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return api;
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkerPool;
}
