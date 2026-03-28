/**
 * PrognosisMeta - Performance Optimization Module
 * Caching, memoization, and optimized algorithms
 */

const Performance = (function() {
    'use strict';

    // ==========================================
    // LRU CACHE
    // ==========================================

    class LRUCache {
        constructor(maxSize = 100) {
            this.maxSize = maxSize;
            this.cache = new Map();
        }

        get(key) {
            if (!this.cache.has(key)) return undefined;
            // Move to end (most recently used)
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }

        set(key, value) {
            if (this.cache.has(key)) {
                this.cache.delete(key);
            } else if (this.cache.size >= this.maxSize) {
                // Delete oldest (first) entry
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            this.cache.set(key, value);
        }

        has(key) {
            return this.cache.has(key);
        }

        clear() {
            this.cache.clear();
        }

        get size() {
            return this.cache.size;
        }
    }

    // Global caches
    const matrixInverseCache = new LRUCache(50);
    const tau2Cache = new LRUCache(100);
    const analysisCache = new LRUCache(20);

    /**
     * Generate cache key from array
     */
    function arrayKey(arr) {
        return arr.map(x => (typeof x === 'number' && !isNaN(x)) ? x.toFixed(8) : String(x)).join(',');
    }

    /**
     * Generate cache key from matrix
     */
    function matrixKey(matrix) {
        return matrix.flat().map(x => (typeof x === 'number' && !isNaN(x)) ? x.toFixed(8) : String(x)).join(',');
    }

    // ==========================================
    // MEMOIZATION
    // ==========================================

    /**
     * Create memoized version of a function
     */
    function memoize(fn, keyFn = JSON.stringify) {
        const cache = new Map();
        return function(...args) {
            const key = keyFn(args);
            if (cache.has(key)) {
                return cache.get(key);
            }
            const result = fn.apply(this, args);
            cache.set(key, result);
            return result;
        };
    }

    // ==========================================
    // OPTIMIZED MATRIX OPERATIONS (Main Thread)
    // Uses Float64Array for better performance
    // ==========================================

    const FastMatrix = {
        /**
         * Create matrix from 2D array
         */
        fromArray(arr) {
            if (!arr || arr.length === 0 || !arr[0]) {
                return { rows: 0, cols: 0, data: new Float64Array(0) };
            }
            const rows = arr.length;
            const cols = arr[0].length;
            const data = new Float64Array(rows * cols);
            for (let i = 0; i < rows; i++) {
                // Handle jagged arrays gracefully - use 0 for missing values
                const rowLen = arr[i] ? arr[i].length : 0;
                for (let j = 0; j < cols; j++) {
                    data[i * cols + j] = (j < rowLen && arr[i][j] !== undefined) ? arr[i][j] : 0;
                }
            }
            return { rows, cols, data };
        },

        /**
         * Convert to 2D array
         */
        toArray(m) {
            const result = [];
            for (let i = 0; i < m.rows; i++) {
                result[i] = [];
                for (let j = 0; j < m.cols; j++) {
                    result[i][j] = m.data[i * m.cols + j];
                }
            }
            return result;
        },

        /**
         * Cache-efficient matrix multiplication
         */
        multiply(A, B) {
            if (A.cols !== B.rows) throw new Error('Dimension mismatch');

            const C = {
                rows: A.rows,
                cols: B.cols,
                data: new Float64Array(A.rows * B.cols)
            };

            // Transpose B for cache efficiency
            const Bt = new Float64Array(B.cols * B.rows);
            for (let i = 0; i < B.rows; i++) {
                for (let j = 0; j < B.cols; j++) {
                    Bt[j * B.rows + i] = B.data[i * B.cols + j];
                }
            }

            // Blocked multiplication for cache efficiency
            const blockSize = 32;
            for (let i0 = 0; i0 < A.rows; i0 += blockSize) {
                for (let j0 = 0; j0 < B.cols; j0 += blockSize) {
                    for (let k0 = 0; k0 < A.cols; k0 += blockSize) {
                        const iMax = Math.min(i0 + blockSize, A.rows);
                        const jMax = Math.min(j0 + blockSize, B.cols);
                        const kMax = Math.min(k0 + blockSize, A.cols);

                        for (let i = i0; i < iMax; i++) {
                            for (let j = j0; j < jMax; j++) {
                                let sum = C.data[i * C.cols + j];
                                const rowA = i * A.cols;
                                const rowBt = j * B.rows;
                                for (let k = k0; k < kMax; k++) {
                                    sum += A.data[rowA + k] * Bt[rowBt + k];
                                }
                                C.data[i * C.cols + j] = sum;
                            }
                        }
                    }
                }
            }

            return C;
        },

        /**
         * LU decomposition with partial pivoting
         */
        luDecompose(A) {
            const n = A.rows;
            const L = { rows: n, cols: n, data: new Float64Array(n * n) };
            const U = { rows: n, cols: n, data: new Float64Array(n * n) };
            const P = new Uint32Array(n);
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

                // Decompose (guard against zero pivot for singular matrices)
                const pivot = a[k * n + k];
                if (Math.abs(pivot) < 1e-12) continue;  // Skip singular pivot
                for (let i = k + 1; i < n; i++) {
                    a[i * n + k] /= pivot;
                    for (let j = k + 1; j < n; j++) {
                        a[i * n + j] -= a[i * n + k] * a[k * n + j];
                    }
                }
            }

            // Extract L and U
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (i > j) {
                        L.data[i * n + j] = a[i * n + j];
                    } else if (i === j) {
                        L.data[i * n + j] = 1;
                        U.data[i * n + j] = a[i * n + j];
                    } else {
                        U.data[i * n + j] = a[i * n + j];
                    }
                }
            }

            return { L, U, P };
        },

        /**
         * Matrix inverse with caching
         */
        inverse(A) {
            // Check cache first
            const key = matrixKey(FastMatrix.toArray(A));
            const cached = matrixInverseCache.get(key);
            if (cached) return cached;

            const n = A.rows;
            const { L, U, P } = FastMatrix.luDecompose(A);
            const inv = { rows: n, cols: n, data: new Float64Array(n * n) };

            for (let col = 0; col < n; col++) {
                // Solve Ly = e
                const y = new Float64Array(n);
                for (let i = 0; i < n; i++) {
                    y[i] = (P[i] === col) ? 1 : 0;
                    for (let j = 0; j < i; j++) {
                        y[i] -= L.data[i * n + j] * y[j];
                    }
                }

                // Solve Ux = y
                for (let i = n - 1; i >= 0; i--) {
                    let x = y[i];
                    for (let j = i + 1; j < n; j++) {
                        x -= U.data[i * n + j] * inv.data[j * n + col];
                    }
                    const uii = U.data[i * n + i];
                    inv.data[i * n + col] = uii !== 0 ? x / uii : 0;
                }
            }

            // Cache result
            const result = FastMatrix.toArray(inv);
            matrixInverseCache.set(key, result);
            return result;
        },

        /**
         * Transpose
         */
        transpose(A) {
            const T = { rows: A.cols, cols: A.rows, data: new Float64Array(A.cols * A.rows) };
            for (let i = 0; i < A.rows; i++) {
                for (let j = 0; j < A.cols; j++) {
                    T.data[j * T.cols + i] = A.data[i * A.cols + j];
                }
            }
            return T;
        }
    };

    // ==========================================
    // OPTIMIZED STATISTICAL OPERATIONS
    // ==========================================

    /**
     * Fast Kahan summation (more accurate than simple sum)
     */
    function kahanSum(arr) {
        let sum = 0;
        let c = 0;
        for (let i = 0; i < arr.length; i++) {
            const y = arr[i] - c;
            const t = sum + y;
            c = (t - sum) - y;
            sum = t;
        }
        return sum;
    }

    /**
     * Welford's online algorithm for variance
     * More numerically stable
     */
    function welfordVariance(arr) {
        let n = 0;
        let mean = 0;
        let M2 = 0;

        for (let i = 0; i < arr.length; i++) {
            n++;
            const delta = arr[i] - mean;
            mean += delta / n;
            const delta2 = arr[i] - mean;
            M2 += delta * delta2;
        }

        return n > 1 ? M2 / (n - 1) : 0;
    }

    /**
     * Binary search for quantiles (pre-sorted array)
     */
    function quantile(sortedArr, p) {
        if (!sortedArr || sortedArr.length === 0) return NaN;
        if (sortedArr.length === 1) return sortedArr[0];
        const n = sortedArr.length;
        const idx = p * (n - 1);
        const lower = Math.floor(idx);
        const upper = Math.min(Math.ceil(idx), n - 1);  // Guard against out-of-bounds
        const weight = idx - lower;
        return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
    }

    // ==========================================
    // PROGRESS TRACKING
    // ==========================================

    class ProgressTracker {
        constructor(onProgress) {
            this.onProgress = onProgress;
            this.startTime = Date.now();
            this.lastUpdate = 0;
        }

        update(value, message = '') {
            const now = Date.now();
            // Throttle updates to max 60fps
            if (now - this.lastUpdate < 16) return;
            this.lastUpdate = now;

            const elapsed = now - this.startTime;
            const estimated = value > 0 ? elapsed / value : 0;
            const remaining = estimated - elapsed;

            if (this.onProgress) {
                this.onProgress({
                    value,
                    percent: Math.round(value * 100),
                    elapsed,
                    remaining: Math.max(0, remaining),
                    message
                });
            }
        }
    }

    // ==========================================
    // DEBOUNCE & THROTTLE
    // ==========================================

    function debounce(fn, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function throttle(fn, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ==========================================
    // BATCH PROCESSING
    // ==========================================

    /**
     * Process array in batches to avoid blocking UI
     */
    async function processBatched(array, processor, batchSize = 100, onProgress = null) {
        const results = [];
        const total = array.length;

        for (let i = 0; i < total; i += batchSize) {
            const batch = array.slice(i, i + batchSize);
            const batchResults = batch.map(processor);
            results.push(...batchResults);

            if (onProgress) {
                onProgress((i + batch.length) / total);
            }

            // Yield to UI thread
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        return results;
    }

    /**
     * Run computation with timeout warning
     */
    function withTimeout(promise, timeout = 30000, message = 'Operation timed out') {
        let timeoutId;
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(message)), timeout);
            })
        ]).finally(() => clearTimeout(timeoutId));
    }

    // ==========================================
    // PARALLEL ARRAY OPERATIONS
    // ==========================================

    /**
     * Parallel map using requestIdleCallback
     */
    async function parallelMap(array, fn, maxConcurrency = 4) {
        const results = new Array(array.length);
        let index = 0;

        const worker = async () => {
            while (index < array.length) {
                const i = index++;
                results[i] = await fn(array[i], i);
            }
        };

        await Promise.all(
            Array(Math.min(maxConcurrency, array.length))
                .fill()
                .map(worker)
        );

        return results;
    }

    // ==========================================
    // EXPORTS
    // ==========================================

    return {
        // Caching
        LRUCache,
        matrixInverseCache,
        tau2Cache,
        analysisCache,
        clearCaches() {
            matrixInverseCache.clear();
            tau2Cache.clear();
            analysisCache.clear();
        },

        // Memoization
        memoize,

        // Matrix operations
        FastMatrix,

        // Statistics
        kahanSum,
        welfordVariance,
        quantile,

        // Progress
        ProgressTracker,

        // Control flow
        debounce,
        throttle,
        processBatched,
        withTimeout,
        parallelMap,

        // Cache key generators
        arrayKey,
        matrixKey
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Performance;
}
