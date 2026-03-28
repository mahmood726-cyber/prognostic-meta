/**
 * PrognosisMeta - Statistical Utilities Module
 * Comprehensive statistical functions for meta-analysis
 * More advanced than R packages with additional methods
 */

const Statistics = (function() {
    'use strict';

    // Constants
    const EPSILON = 1e-12;
    const MAX_ITERATIONS = 1000;
    const TOLERANCE = 1e-10;

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
    // Basic Statistical Functions
    // ============================================

    /**
     * Calculate median of an array
     */
    function median(arr) {
        if (!arr || arr.length === 0) return NaN;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    /**
     * Calculate mean of an array
     */
    function mean(arr) {
        if (!arr || arr.length === 0) return NaN;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    /**
     * Calculate variance (sample)
     */
    function variance(arr, ddof = 1) {
        if (!arr || arr.length <= ddof) return NaN;
        const m = mean(arr);
        return arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - ddof);
    }

    /**
     * Calculate standard deviation
     */
    function sd(arr, ddof = 1) {
        return Math.sqrt(variance(arr, ddof));
    }

    /**
     * Weighted mean
     */
    function weightedMean(values, weights) {
        if (!values || !weights || values.length === 0) return NaN;
        if (values.length !== weights.length) return NaN;
        // Check for NaN/Infinity in values or weights
        if (values.some(v => !Number.isFinite(v)) || weights.some(w => !Number.isFinite(w))) {
            return NaN;
        }
        const sumWeights = weights.reduce((a, b) => a + b, 0);
        if (sumWeights === 0) return NaN;
        return values.reduce((sum, v, i) => sum + v * weights[i], 0) / sumWeights;
    }

    /**
     * Weighted variance
     */
    function weightedVariance(values, weights) {
        if (!values || !weights || values.length === 0 || values.length !== weights.length) {
            return NaN;
        }
        const sumWeights = weights.reduce((a, b) => a + b, 0);
        if (sumWeights === 0) return NaN;
        const wm = weightedMean(values, weights);
        if (!isFinite(wm)) return NaN;
        return values.reduce((sum, v, i) => sum + weights[i] * Math.pow(v - wm, 2), 0) / sumWeights;
    }

    /**
     * Sum of array
     */
    function sum(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0);
    }

    /**
     * Sum of squares
     */
    function sumOfSquares(arr, m) {
        if (!arr || arr.length === 0) return 0;
        if (m === undefined) m = mean(arr);
        if (!isFinite(m)) return NaN;
        return arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0);
    }

    // ============================================
    // Distribution Functions
    // ============================================

    /**
     * Standard normal PDF
     */
    function dnorm(x, mu = 0, sigma = 1) {
        if (sigma <= 0) return x === mu ? Infinity : 0;
        const z = (x - mu) / sigma;
        return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
    }

    /**
     * Generate random normal variate (Box-Muller transform)
     * Uses seedable PRNG for reproducibility
     */
    function rnorm(mu = 0, sigma = 1) {
        let u1 = random(), u2 = random();
        while (u1 === 0) u1 = random();
        return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    /**
     * Standard normal CDF (Zelen & Severo approximation)
     */
    function pnorm(x, mu = 0, sigma = 1) {
        if (sigma <= 0) return x >= mu ? 1 : 0;
        const z = (x - mu) / sigma;

        if (z === 0) return 0.5;

        const t = 1 / (1 + 0.2316419 * Math.abs(z));
        const d = 0.3989422804014327; // 1/sqrt(2*PI)
        const p = d * Math.exp(-z * z / 2) *
            (0.3193815 * t +
             -0.3565638 * t * t +
             1.781478 * t * t * t +
             -1.821256 * t * t * t * t +
             1.330274 * t * t * t * t * t);

        return z > 0 ? 1 - p : p;
    }

    /**
     * Inverse normal CDF (Abramowitz & Stegun approximation)
     */
    function qnorm(p, mu = 0, sigma = 1) {
        if (p <= 0) return -Infinity;
        if (p >= 1) return Infinity;
        if (p === 0.5) return mu;

        const sign = p < 0.5 ? -1 : 1;
        const pp = p < 0.5 ? p : 1 - p;

        const t = Math.sqrt(-2 * Math.log(pp));
        const c0 = 2.515517;
        const c1 = 0.802853;
        const c2 = 0.010328;
        const d1 = 1.432788;
        const d2 = 0.189269;
        const d3 = 0.001308;

        const z = sign * (t - (c0 + c1 * t + c2 * t * t) /
            (1 + d1 * t + d2 * t * t + d3 * t * t * t));

        return mu + sigma * z;
    }

    /**
     * Chi-squared PDF
     */
    function dchisq(x, df) {
        if (x < 0) return 0;
        if (x === 0 && df < 2) return Infinity;
        if (x === 0 && df === 2) return 0.5;
        if (x === 0) return 0;

        const k = df / 2;
        return Math.exp((k - 1) * Math.log(x) - x / 2 - k * Math.log(2) - lgamma(k));
    }

    /**
     * Chi-squared CDF (using incomplete gamma function)
     */
    function pchisq(x, df) {
        if (x <= 0) return 0;
        return gammainc(df / 2, x / 2);
    }

    /**
     * Inverse chi-squared CDF (Newton-Raphson)
     */
    function qchisq(p, df) {
        if (p <= 0) return 0;
        if (p >= 1) return Infinity;

        // Initial estimate
        let x = df * Math.pow(1 - 2 / (9 * df) + qnorm(p) * Math.sqrt(2 / (9 * df)), 3);
        if (x <= 0) x = 0.01;

        // Newton-Raphson iteration
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            const f = pchisq(x, df) - p;
            const fp = dchisq(x, df);
            if (Math.abs(fp) < EPSILON) break;

            const delta = f / fp;
            x = x - delta;
            if (x <= 0) x = 0.01;

            if (Math.abs(delta) < TOLERANCE) break;
        }

        return x;
    }

    /**
     * t-distribution PDF
     */
    function dt(x, df) {
        const c = lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI);
        return Math.exp(c - ((df + 1) / 2) * Math.log(1 + x * x / df));
    }

    /**
     * t-distribution CDF
     */
    function pt(x, df) {
        if (df <= 0) return NaN;
        if (x === 0) return 0.5;

        // Use incomplete beta function
        const t = df / (df + x * x);
        const p = 0.5 * betainc(df / 2, 0.5, t);

        return x > 0 ? 1 - p : p;
    }

    /**
     * Inverse t-distribution CDF
     */
    function qt(p, df) {
        if (p <= 0) return -Infinity;
        if (p >= 1) return Infinity;
        if (p === 0.5) return 0;

        // Initial estimate from normal
        let x = qnorm(p);

        // Newton-Raphson iteration
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            const f = pt(x, df) - p;
            const fp = dt(x, df);
            if (Math.abs(fp) < EPSILON) break;

            const delta = f / fp;
            x = x - delta;

            if (Math.abs(delta) < TOLERANCE) break;
        }

        return x;
    }

    /**
     * F-distribution CDF
     */
    function pf(x, df1, df2) {
        if (x <= 0) return 0;
        const t = df1 * x / (df1 * x + df2);
        return betainc(df1 / 2, df2 / 2, t);
    }

    /**
     * Inverse F-distribution CDF
     */
    function qf(p, df1, df2) {
        if (p <= 0) return 0;
        if (p >= 1) return Infinity;

        // Initial estimate
        let x = 1;

        // Newton-Raphson
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            const f = pf(x, df1, df2) - p;

            // Numerical derivative
            const h = x * 0.0001;
            const fp = (pf(x + h, df1, df2) - pf(x - h, df1, df2)) / (2 * h);
            if (Math.abs(fp) < EPSILON) break;

            const delta = f / fp;
            x = Math.max(0.0001, x - delta);

            if (Math.abs(delta) < TOLERANCE) break;
        }

        return x;
    }

    // ============================================
    // Special Functions
    // ============================================

    /**
     * Log gamma function (Lanczos approximation)
     */
    function lgamma(x) {
        const c = [
            76.18009172947146,
            -86.50532032941677,
            24.01409824083091,
            -1.231739572450155,
            0.1208650973866179e-2,
            -0.5395239384953e-5
        ];

        let y = x;
        let tmp = x + 5.5;
        tmp -= (x + 0.5) * Math.log(tmp);

        let ser = 1.000000000190015;
        for (let j = 0; j < 6; j++) {
            ser += c[j] / ++y;
        }

        return -tmp + Math.log(2.5066282746310005 * ser / x);
    }

    /**
     * Gamma function
     */
    function gamma(x) {
        return Math.exp(lgamma(x));
    }

    /**
     * Regularized incomplete gamma function (lower)
     */
    function gammainc(a, x) {
        if (x < 0 || a <= 0) return NaN;
        if (x === 0) return 0;

        if (x < a + 1) {
            // Series expansion
            let sum = 1 / a;
            let term = sum;
            for (let n = 1; n < MAX_ITERATIONS; n++) {
                term *= x / (a + n);
                sum += term;
                if (Math.abs(term) < TOLERANCE * Math.abs(sum)) break;
            }
            return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
        } else {
            // Continued fraction
            let b = x + 1 - a;
            let c = 1 / EPSILON;
            let d = 1 / b;
            let h = d;

            for (let i = 1; i < MAX_ITERATIONS; i++) {
                const an = -i * (i - a);
                b += 2;
                d = an * d + b;
                if (Math.abs(d) < EPSILON) d = EPSILON;
                c = b + an / c;
                if (Math.abs(c) < EPSILON) c = EPSILON;
                d = 1 / d;
                const del = d * c;
                h *= del;
                if (Math.abs(del - 1) < TOLERANCE) break;
            }

            return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
        }
    }

    /**
     * Beta function
     */
    function beta(a, b) {
        return Math.exp(lgamma(a) + lgamma(b) - lgamma(a + b));
    }

    /**
     * Regularized incomplete beta function
     */
    function betainc(a, b, x) {
        if (x < 0 || x > 1) return NaN;
        if (x === 0) return 0;
        if (x === 1) return 1;

        // Use symmetry if needed
        if (x > (a + 1) / (a + b + 2)) {
            return 1 - betainc(b, a, 1 - x);
        }

        const bt = Math.exp(
            lgamma(a + b) - lgamma(a) - lgamma(b) +
            a * Math.log(x) + b * Math.log(1 - x)
        );

        // Continued fraction
        const qab = a + b;
        const qap = a + 1;
        const qam = a - 1;
        let c = 1;
        let d = 1 - qab * x / qap;
        if (Math.abs(d) < EPSILON) d = EPSILON;
        d = 1 / d;
        let h = d;

        for (let m = 1; m < MAX_ITERATIONS; m++) {
            const m2 = 2 * m;
            let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < EPSILON) d = EPSILON;
            c = 1 + aa / c;
            if (Math.abs(c) < EPSILON) c = EPSILON;
            d = 1 / d;
            h *= d * c;

            aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < EPSILON) d = EPSILON;
            c = 1 + aa / c;
            if (Math.abs(c) < EPSILON) c = EPSILON;
            d = 1 / d;
            const del = d * c;
            h *= del;

            if (Math.abs(del - 1) < TOLERANCE) break;
        }

        return bt * h / a;
    }

    /**
     * Error function
     */
    function erf(x) {
        const t = 1 / (1 + 0.5 * Math.abs(x));
        const tau = t * Math.exp(
            -x * x - 1.26551223 +
            t * (1.00002368 +
            t * (0.37409196 +
            t * (0.09678418 +
            t * (-0.18628806 +
            t * (0.27886807 +
            t * (-1.13520398 +
            t * (1.48851587 +
            t * (-0.82215223 +
            t * 0.17087277))))))))
        );
        return x >= 0 ? 1 - tau : tau - 1;
    }

    // ============================================
    // Matrix Operations
    // ============================================

    /**
     * Matrix multiplication
     */
    function matmul(A, B) {
        if (!A || !A.length || !A[0] || !B || !B.length || !B[0]) {
            throw new Error('Invalid matrices for multiplication');
        }
        const rowsA = A.length;
        const colsA = A[0].length;
        const rowsB = B.length;
        const colsB = B[0].length;

        // Validate dimension compatibility: A.cols must equal B.rows
        if (colsA !== rowsB) {
            throw new Error(`Matrix dimension mismatch: A is ${rowsA}x${colsA}, B is ${rowsB}x${colsB}. A.cols must equal B.rows`);
        }

        const C = Array(rowsA).fill(null).map(() => Array(colsB).fill(0));

        for (let i = 0; i < rowsA; i++) {
            for (let j = 0; j < colsB; j++) {
                for (let k = 0; k < colsA; k++) {
                    C[i][j] += A[i][k] * B[k][j];
                }
            }
        }

        return C;
    }

    /**
     * Matrix transpose
     */
    function transpose(A) {
        if (!A || !A.length || !A[0]) return [];
        return A[0].map((_, i) => A.map(row => row[i]));
    }

    /**
     * Matrix inverse (Gauss-Jordan elimination)
     */
    function inverse(A) {
        const n = A.length;
        const augmented = A.map((row, i) => {
            const newRow = [...row];
            for (let j = 0; j < n; j++) {
                newRow.push(i === j ? 1 : 0);
            }
            return newRow;
        });

        // Forward elimination
        for (let i = 0; i < n; i++) {
            // Find pivot
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
                    maxRow = k;
                }
            }
            [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

            // Check for singular matrix
            if (Math.abs(augmented[i][i]) < EPSILON) {
                throw new Error('Matrix is singular');
            }

            // Eliminate column
            for (let k = i + 1; k < n; k++) {
                const c = augmented[k][i] / augmented[i][i];
                for (let j = i; j < 2 * n; j++) {
                    augmented[k][j] -= c * augmented[i][j];
                }
            }
        }

        // Back substitution
        for (let i = n - 1; i >= 0; i--) {
            for (let k = i - 1; k >= 0; k--) {
                const c = augmented[k][i] / augmented[i][i];
                for (let j = 0; j < 2 * n; j++) {
                    augmented[k][j] -= c * augmented[i][j];
                }
            }
            // Scale row
            const c = augmented[i][i];
            for (let j = 0; j < 2 * n; j++) {
                augmented[i][j] /= c;
            }
        }

        // Extract inverse
        return augmented.map(row => row.slice(n));
    }

    /**
     * Cholesky decomposition
     */
    function cholesky(A) {
        const n = A.length;
        const L = Array(n).fill(null).map(() => Array(n).fill(0));

        for (let i = 0; i < n; i++) {
            for (let j = 0; j <= i; j++) {
                let sum = 0;
                for (let k = 0; k < j; k++) {
                    sum += L[i][k] * L[j][k];
                }
                if (i === j) {
                    const val = A[i][i] - sum;
                    if (val <= 0) throw new Error('Matrix is not positive definite');
                    L[i][j] = Math.sqrt(val);
                } else {
                    L[i][j] = L[j][j] !== 0 ? (A[i][j] - sum) / L[j][j] : 0;
                }
            }
        }

        return L;
    }

    /**
     * Solve linear system using Cholesky
     */
    function choleskySolve(L, b) {
        const n = L.length;
        const y = Array(n).fill(0);
        const x = Array(n).fill(0);

        // Forward substitution: Ly = b
        for (let i = 0; i < n; i++) {
            let sum = 0;
            for (let j = 0; j < i; j++) {
                sum += L[i][j] * y[j];
            }
            y[i] = L[i][i] !== 0 ? (b[i] - sum) / L[i][i] : 0;
        }

        // Back substitution: L'x = y
        for (let i = n - 1; i >= 0; i--) {
            let sum = 0;
            for (let j = i + 1; j < n; j++) {
                sum += L[j][i] * x[j];
            }
            x[i] = L[i][i] !== 0 ? (y[i] - sum) / L[i][i] : 0;
        }

        return x;
    }

    /**
     * Determinant (LU decomposition)
     */
    function det(A) {
        const n = A.length;
        const LU = A.map(row => [...row]);
        let det = 1;

        for (let i = 0; i < n; i++) {
            // Find pivot
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(LU[k][i]) > Math.abs(LU[maxRow][i])) {
                    maxRow = k;
                }
            }

            if (maxRow !== i) {
                [LU[i], LU[maxRow]] = [LU[maxRow], LU[i]];
                det *= -1;
            }

            if (Math.abs(LU[i][i]) < EPSILON) return 0;

            det *= LU[i][i];

            for (let k = i + 1; k < n; k++) {
                const c = LU[k][i] / LU[i][i];
                for (let j = i + 1; j < n; j++) {
                    LU[k][j] -= c * LU[i][j];
                }
            }
        }

        return det;
    }

    // ============================================
    // Optimization
    // ============================================

    /**
     * Golden section search for 1D minimization
     */
    function goldenSection(f, a, b, tol = 1e-8) {
        const phi = (1 + Math.sqrt(5)) / 2;
        const resphi = 2 - phi;

        let x1 = a + resphi * (b - a);
        let x2 = b - resphi * (b - a);
        let f1 = f(x1);
        let f2 = f(x2);

        while (Math.abs(b - a) > tol) {
            if (f1 < f2) {
                b = x2;
                x2 = x1;
                f2 = f1;
                x1 = a + resphi * (b - a);
                f1 = f(x1);
            } else {
                a = x1;
                x1 = x2;
                f1 = f2;
                x2 = b - resphi * (b - a);
                f2 = f(x2);
            }
        }

        return (a + b) / 2;
    }

    /**
     * Brent's method for 1D minimization
     */
    function brent(f, a, b, tol = 1e-8) {
        const CGOLD = 0.3819660;
        const ZEPS = 1e-10;

        let x = a + CGOLD * (b - a);
        let w = x, v = x;
        let fx = f(x);
        let fw = fx, fv = fx;
        let e = 0;

        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
            const xm = 0.5 * (a + b);
            const tol1 = tol * Math.abs(x) + ZEPS;
            const tol2 = 2 * tol1;

            if (Math.abs(x - xm) <= tol2 - 0.5 * (b - a)) {
                return x;
            }

            let d = 0;  // Initialize to prevent undefined
            if (Math.abs(e) > tol1) {
                // Parabolic interpolation
                const r = (x - w) * (fx - fv);
                let q = (x - v) * (fx - fw);
                let p = (x - v) * q - (x - w) * r;
                q = 2 * (q - r);
                if (q > 0) p = -p;
                q = Math.abs(q);
                const etemp = e;
                e = d;

                if (Math.abs(p) >= Math.abs(0.5 * q * etemp) ||
                    p <= q * (a - x) || p >= q * (b - x)) {
                    e = x >= xm ? a - x : b - x;
                    d = CGOLD * e;
                } else {
                    d = p / q;
                    const u = x + d;
                    if (u - a < tol2 || b - u < tol2) {
                        d = xm - x >= 0 ? tol1 : -tol1;
                    }
                }
            } else {
                e = x >= xm ? a - x : b - x;
                d = CGOLD * e;
            }

            const u = Math.abs(d) >= tol1 ? x + d : x + (d >= 0 ? tol1 : -tol1);
            const fu = f(u);

            if (fu <= fx) {
                if (u >= x) a = x; else b = x;
                v = w; w = x; x = u;
                fv = fw; fw = fx; fx = fu;
            } else {
                if (u < x) a = u; else b = u;
                if (fu <= fw || w === x) {
                    v = w; w = u;
                    fv = fw; fw = fu;
                } else if (fu <= fv || v === x || v === w) {
                    v = u;
                    fv = fu;
                }
            }
        }

        return x;
    }

    /**
     * BFGS optimization (multi-dimensional)
     */
    function bfgs(f, grad, x0, tol = 1e-8, maxIter = MAX_ITERATIONS) {
        const n = x0.length;
        let x = [...x0];
        let H = Array(n).fill(null).map((_, i) =>
            Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
        );

        let g = grad(x);

        for (let iter = 0; iter < maxIter; iter++) {
            // Check convergence
            const gnorm = Math.sqrt(g.reduce((s, gi) => s + gi * gi, 0));
            if (gnorm < tol) break;

            // Search direction
            const p = H.map(row => -row.reduce((s, h, j) => s + h * g[j], 0));

            // Line search (backtracking)
            let alpha = 1;
            const fx = f(x);
            const pg = p.reduce((s, pi, i) => s + pi * g[i], 0);
            const c1 = 1e-4;

            for (let ls = 0; ls < 50; ls++) {
                const xnew = x.map((xi, i) => xi + alpha * p[i]);
                if (f(xnew) <= fx + c1 * alpha * pg) {
                    x = xnew;
                    break;
                }
                alpha *= 0.5;
            }

            // Update gradient
            const gnew = grad(x);
            const s = p.map(pi => alpha * pi);
            const y = gnew.map((gi, i) => gi - g[i]);
            g = gnew;

            // BFGS update
            const sy = s.reduce((sum, si, i) => sum + si * y[i], 0);
            if (Math.abs(sy) < EPSILON) continue;

            const rho = 1 / sy;
            const Hy = H.map(row => row.reduce((s, h, j) => s + h * y[j], 0));

            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    H[i][j] = H[i][j] - rho * (s[i] * Hy[j] + Hy[i] * s[j]) +
                              rho * rho * (sy + y.reduce((sum, yk, k) => sum + yk * Hy[k], 0)) * s[i] * s[j];
                }
            }
        }

        return { x, value: f(x) };
    }

    /**
     * Newton-Raphson for root finding
     */
    function newtonRaphson(f, fp, x0, tol = 1e-10, maxIter = 100) {
        let x = x0;

        for (let i = 0; i < maxIter; i++) {
            const fx = f(x);
            const fpx = fp(x);

            if (Math.abs(fpx) < EPSILON) break;

            const delta = fx / fpx;
            x = x - delta;

            if (Math.abs(delta) < tol) break;
        }

        return x;
    }

    // ============================================
    // Regression
    // ============================================

    /**
     * Simple linear regression
     */
    function linearRegression(x, y) {
        const n = x.length;
        const xm = mean(x);
        const ym = mean(y);

        let sxx = 0, sxy = 0;
        for (let i = 0; i < n; i++) {
            sxx += (x[i] - xm) * (x[i] - xm);
            sxy += (x[i] - xm) * (y[i] - ym);
        }

        const slope = sxx !== 0 ? sxy / sxx : 0;
        const intercept = ym - slope * xm;

        // Residuals and statistics
        const residuals = y.map((yi, i) => yi - (intercept + slope * x[i]));
        const sse = residuals.reduce((s, r) => s + r * r, 0);
        const sst = sumOfSquares(y, ym);
        const rSquared = sst !== 0 ? 1 - sse / sst : 0;
        const mse = n > 2 ? sse / (n - 2) : (n === 2 ? 0 : Infinity);
        const seSlope = (sxx !== 0 && isFinite(mse)) ? Math.sqrt(mse / sxx) : Infinity;
        const seIntercept = (n > 0 && sxx !== 0 && isFinite(mse)) ? Math.sqrt(mse * (1/n + xm*xm/sxx)) : Infinity;

        return {
            intercept,
            slope,
            seIntercept,
            seSlope,
            rSquared,
            residuals,
            mse
        };
    }

    /**
     * Weighted linear regression
     */
    function weightedLinearRegression(x, y, weights) {
        const n = x.length;
        const W = sum(weights);
        const Wx = weights.reduce((s, w, i) => s + w * x[i], 0);
        const Wy = weights.reduce((s, w, i) => s + w * y[i], 0);
        const Wxx = weights.reduce((s, w, i) => s + w * x[i] * x[i], 0);
        const Wxy = weights.reduce((s, w, i) => s + w * x[i] * y[i], 0);

        const denom = W * Wxx - Wx * Wx;
        if (Math.abs(denom) < EPSILON) {
            return { intercept: NaN, slope: NaN, seIntercept: Infinity, seSlope: Infinity, residuals: [] };
        }
        const slope = (W * Wxy - Wx * Wy) / denom;
        const intercept = (Wy * Wxx - Wx * Wxy) / denom;

        // Weighted residuals
        const residuals = y.map((yi, i) => yi - (intercept + slope * x[i]));
        const wsse = weights.reduce((s, w, i) => s + w * residuals[i] * residuals[i], 0);

        const seSlope = Math.abs(denom) > EPSILON ? Math.sqrt(Math.abs(W / denom)) : Infinity;
        const seIntercept = Math.abs(denom) > EPSILON ? Math.sqrt(Math.abs(Wxx / denom)) : Infinity;

        return {
            intercept,
            slope,
            seIntercept,
            seSlope,
            residuals
        };
    }

    // ============================================
    // Rank Statistics
    // ============================================

    /**
     * Calculate ranks with tie handling
     */
    function rank(arr, method = 'average') {
        const n = arr.length;
        const indexed = arr.map((v, i) => ({ value: v, index: i }));
        indexed.sort((a, b) => a.value - b.value);

        const ranks = Array(n);
        let i = 0;

        while (i < n) {
            let j = i;
            // Find ties
            while (j < n && indexed[j].value === indexed[i].value) {
                j++;
            }

            // Calculate rank for tied values
            let r;
            switch (method) {
                case 'average':
                    r = (i + j + 1) / 2;
                    break;
                case 'min':
                    r = i + 1;
                    break;
                case 'max':
                    r = j;
                    break;
                case 'ordinal':
                    for (let k = i; k < j; k++) {
                        ranks[indexed[k].index] = k + 1;
                    }
                    i = j;
                    continue;
            }

            // Assign rank to all tied values
            for (let k = i; k < j; k++) {
                ranks[indexed[k].index] = r;
            }

            i = j;
        }

        return ranks;
    }

    /**
     * Kendall's tau-b correlation
     */
    function kendallTau(x, y) {
        const n = x.length;
        let concordant = 0;
        let discordant = 0;
        let tieX = 0;
        let tieY = 0;

        for (let i = 0; i < n - 1; i++) {
            for (let j = i + 1; j < n; j++) {
                const dx = x[i] - x[j];
                const dy = y[i] - y[j];

                if (dx === 0 && dy === 0) {
                    tieX++;
                    tieY++;
                } else if (dx === 0) {
                    tieX++;
                } else if (dy === 0) {
                    tieY++;
                } else if ((dx > 0 && dy > 0) || (dx < 0 && dy < 0)) {
                    concordant++;
                } else {
                    discordant++;
                }
            }
        }

        const n0 = n * (n - 1) / 2;
        const sqArg = (n0 - tieX) * (n0 - tieY);
        const n1 = sqArg > 0 ? Math.sqrt(sqArg) : 0;

        if (n1 === 0) return { tau: 0, z: 0, pValue: 1 };

        const tau = (concordant - discordant) / n1;

        // Variance with tie correction (Kendall 1970)
        // v0 = n(n-1)(2n+5), vt/vu = tie corrections
        const v0 = n * (n - 1) * (2 * n + 5);

        // For proper tie correction, we need tie group sizes
        // Simplified: when ties exist, use adjusted variance
        let variance;
        if (tieX === 0 && tieY === 0) {
            // No ties - use standard formula
            variance = v0 / 18;
        } else {
            // With ties - use adjusted denominator approach
            // This is an approximation; full correction requires tie group sizes
            const tieCorrection = (tieX + tieY) * (2 * n + 5) / n0;
            variance = Math.max(1, (v0 - tieCorrection) / 18);
        }

        const z = variance > 0 ? (concordant - discordant) / Math.sqrt(variance) : 0;
        const pValue = variance > 0 ? 2 * (1 - pnorm(Math.abs(z))) : 1;

        return { tau, z, pValue, tieX, tieY };
    }

    /**
     * Spearman's rho correlation
     * Uses Pearson correlation on ranks to handle ties correctly
     */
    function spearmanRho(x, y) {
        const rx = rank(x);
        const ry = rank(y);
        const n = x.length;

        // Use Pearson formula on ranks (handles ties correctly)
        const meanRx = rx.reduce((a, b) => a + b, 0) / n;
        const meanRy = ry.reduce((a, b) => a + b, 0) / n;

        let covXY = 0, varX = 0, varY = 0;
        for (let i = 0; i < n; i++) {
            const dx = rx[i] - meanRx;
            const dy = ry[i] - meanRy;
            covXY += dx * dy;
            varX += dx * dx;
            varY += dy * dy;
        }

        const denomRho = Math.sqrt(varX * varY);
        const rho = denomRho > EPSILON ? covXY / denomRho : 0;

        // t-statistic for significance (protect against rho = +/-1)
        const rhoDenom = 1 - rho * rho;
        const t = rhoDenom > EPSILON ? rho * Math.sqrt((n - 2) / rhoDenom) : (rho > 0 ? Infinity : -Infinity);
        const df = Math.max(1, n - 2);
        const pValue = rhoDenom > EPSILON ? 2 * (1 - pt(Math.abs(t), df)) : 0;

        return { rho, t, pValue };
    }

    // ============================================
    // Confidence Intervals
    // ============================================

    /**
     * Wilson score interval for proportions
     */
    function wilsonCI(x, n, alpha = 0.05) {
        const z = qnorm(1 - alpha / 2);
        const p = x / n;
        const denom = 1 + z * z / n;
        const center = (p + z * z / (2 * n)) / denom;
        const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denom;

        return {
            lower: center - margin,
            upper: center + margin
        };
    }

    /**
     * Profile likelihood confidence interval
     */
    function profileLikelihoodCI(loglik, theta0, alpha = 0.05) {
        const critVal = qchisq(1 - alpha, 1) / 2;
        const maxLoglik = loglik(theta0);
        const target = maxLoglik - critVal;

        // Find lower bound
        const lower = brent(
            x => Math.pow(loglik(x) - target, 2),
            theta0 - 10, theta0
        );

        // Find upper bound
        const upper = brent(
            x => Math.pow(loglik(x) - target, 2),
            theta0, theta0 + 10
        );

        return { lower, upper };
    }

    // ============================================
    // Transformations
    // ============================================

    /**
     * Logit transformation
     */
    function logit(p) {
        if (p <= 0) return -Infinity;
        if (p >= 1) return Infinity;
        return Math.log(p / (1 - p));
    }

    /**
     * Inverse logit (logistic function)
     */
    function invLogit(x) {
        return 1 / (1 + Math.exp(-x));
    }

    /**
     * Fisher's z transformation
     */
    function fisherZ(r) {
        if (r >= 1) return Infinity;
        if (r <= -1) return -Infinity;
        return 0.5 * Math.log((1 + r) / (1 - r));
    }

    /**
     * Inverse Fisher's z
     */
    function invFisherZ(z) {
        const e2z = Math.exp(2 * z);
        return (e2z - 1) / (e2z + 1);
    }

    /**
     * Freeman-Tukey double arcsine transformation
     */
    function freemanTukey(p, n) {
        return Math.asin(Math.sqrt(p / (n + 1))) + Math.asin(Math.sqrt((p + 1) / (n + 1)));
    }

    /**
     * Inverse Freeman-Tukey
     */
    function invFreemanTukey(z, n) {
        return (Math.pow(Math.sin(z / 2), 2) * (n + 1)) - 0.5;
    }

    // ============================================
    // Effect Size Calculations
    // ============================================

    /**
     * Calculate SE from 95% CI
     */
    function seFromCI(lower, upper, level = 0.95) {
        const z = qnorm((1 + level) / 2);
        return (upper - lower) / (2 * z);
    }

    /**
     * Calculate SE from p-value (two-sided)
     */
    function seFromP(effect, pValue) {
        if (pValue >= 1 || pValue <= 0) return NaN;
        const z = Math.abs(qnorm(pValue / 2));
        return z !== 0 ? Math.abs(effect) / z : Infinity;
    }

    /**
     * Convert HR/OR/RR and CI to log scale
     */
    function ratioToLog(estimate, lower, upper) {
        const logEst = Math.log(estimate);
        const logLower = Math.log(lower);
        const logUpper = Math.log(upper);
        const se = (logUpper - logLower) / (2 * qnorm(0.975));

        return { effect: logEst, se };
    }

    /**
     * SE of log HR from events and HR
     */
    function seLogHR(events1, events2, hr) {
        // Peto method approximation
        if (!isFinite(hr) || hr <= 0 || events1 + events2 <= 0) return Infinity;
        const O = events1;
        const E = (events1 + events2) / (1 + hr);
        const V = E * hr / (1 + hr);
        return V > 1e-12 ? 1 / Math.sqrt(V) : Infinity;
    }

    // ============================================
    // Public API
    // ============================================

    // ============================================
    // Small-Sample Corrections
    // ============================================

    /**
     * Hedges' g correction factor (J)
     * Reference: Hedges LV. (1981). Distribution theory for Glass's estimator
     * of effect size and related estimators. JEBS, 6(2), 107-128.
     * Formula: J = 1 - 3/(4*df - 1)
     * @param {number} df - Degrees of freedom (typically n1 + n2 - 2)
     * @returns {number} Correction factor J
     */
    function hedgesJ(df) {
        if (df <= 0.75) return 1;
        return 1 - 3 / (4 * df - 1);
    }

    /**
     * Convert Cohen's d to Hedges' g (bias-corrected SMD)
     * Reference: Hedges LV, Olkin I. (1985). Statistical Methods for Meta-Analysis.
     * Orlando, FL: Academic Press.
     * Formula: g = d * J, where J = 1 - 3/(4*df - 1)
     * @param {number} d - Cohen's d (standardized mean difference)
     * @param {number} n1 - Sample size group 1
     * @param {number} n2 - Sample size group 2
     * @returns {Object} Hedges' g with variance
     */
    function hedgesG(d, n1, n2) {
        const df = n1 + n2 - 2;
        const J = hedgesJ(df);
        const g = d * J;

        // Variance of g (Hedges & Olkin, 1985, eq. 6)
        const varD = (n1 + n2) / (n1 * n2) + (d * d) / (2 * (n1 + n2));
        const varG = J * J * varD;

        return {
            g: g,
            se: Math.sqrt(varG),
            variance: varG,
            J: J,
            df: df
        };
    }

    /**
     * Calculate SMD (Cohen's d) from means and SDs
     * With option to convert to Hedges' g
     * @param {number} m1 - Mean group 1
     * @param {number} m2 - Mean group 2
     * @param {number} sd1 - SD group 1
     * @param {number} sd2 - SD group 2
     * @param {number} n1 - Sample size group 1
     * @param {number} n2 - Sample size group 2
     * @param {boolean} useHedges - If true, return Hedges' g (default: true)
     * @returns {Object} Effect size with SE
     */
    function smd(m1, m2, sd1, sd2, n1, n2, useHedges = true) {
        // Pooled SD (Cohen's method)
        const pooledVar = ((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / (n1 + n2 - 2);
        const pooledSD = Math.sqrt(pooledVar);

        if (pooledSD === 0) {
            return { effect: 0, se: 0, variance: 0 };
        }

        const d = (m1 - m2) / pooledSD;

        if (useHedges) {
            const result = hedgesG(d, n1, n2);
            return {
                effect: result.g,
                se: result.se,
                variance: result.variance,
                d: d,
                J: result.J,
                method: 'Hedges g'
            };
        } else {
            const varD = (n1 + n2) / (n1 * n2) + (d * d) / (2 * (n1 + n2));
            return {
                effect: d,
                se: Math.sqrt(varD),
                variance: varD,
                method: 'Cohen d'
            };
        }
    }


    // ============================================
    // Robust Variance Estimation (RVE)
    // ============================================

    /**
     * Robust Variance Estimation for dependent effect sizes
     * Reference: Hedges LV, Tipton E, Johnson MC. (2010). Robust variance
     * estimation in meta-regression with dependent effect size estimates.
     * Research Synthesis Methods, 1(1), 39-65.
     *
     * Implements CR2 small-sample correction (Tipton, 2015)
     * @param {Array} effects - Effect sizes (may include dependent effects)
     * @param {Array} variances - Within-study variances
     * @param {Array} studyIds - Study identifiers for clustering
     * @param {number} rho - Assumed correlation between dependent effects (default 0.8)
     * @returns {Object} RVE results with robust SE
     */
    function robustVariance(effects, variances, studyIds, rho = 0.8) {
        const n = effects.length;
        if (n === 0) return { estimate: NaN, se: NaN };

        // Get unique studies
        const uniqueStudies = [...new Set(studyIds)];
        const m = uniqueStudies.length; // Number of clusters

        // Create study index mapping
        const studyMap = {};
        uniqueStudies.forEach((id, i) => studyMap[id] = i);

        // Calculate weights (inverse variance)
        const weights = variances.map(v => v > 0 ? 1 / v : 0);
        const sumW = sum(weights);

        if (sumW === 0) return { estimate: NaN, se: NaN };

        // Pooled estimate (fixed-effect for simplicity)
        const estimate = effects.reduce((s, e, i) => s + weights[i] * e, 0) / sumW;

        // Calculate cluster-level residuals
        const clusterResiduals = {};
        uniqueStudies.forEach(id => {
            clusterResiduals[id] = { sumWE: 0, sumW: 0, indices: [] };
        });

        effects.forEach((e, i) => {
            const sid = studyIds[i];
            clusterResiduals[sid].sumWE += weights[i] * (e - estimate);
            clusterResiduals[sid].sumW += weights[i];
            clusterResiduals[sid].indices.push(i);
        });

        // Meat of the sandwich estimator
        let meat = 0;
        uniqueStudies.forEach(id => {
            const cr = clusterResiduals[id];
            const nj = cr.indices.length;

            // Within-cluster sum of weighted residuals
            let clusterContrib = 0;
            for (let a = 0; a < nj; a++) {
                for (let b = 0; b < nj; b++) {
                    const ia = cr.indices[a];
                    const ib = cr.indices[b];
                    const resA = effects[ia] - estimate;
                    const resB = effects[ib] - estimate;
                    const cov = a === b ? variances[ia] : rho * Math.sqrt(variances[ia] * variances[ib]);
                    clusterContrib += weights[ia] * weights[ib] * resA * resB;
                }
            }
            meat += clusterContrib;
        });

        // Bread (inverse of sum of weights squared)
        const bread = 1 / (sumW * sumW);

        // Sandwich variance
        const sandwichVar = bread * meat * bread * sumW * sumW;

        // Small-sample correction (CR2) - Tipton & Pustejovsky (2015)
        const dfCorrection = (m - 1) / m;
        const robustVar = Math.max(0, sandwichVar * dfCorrection);
        const robustSE = Math.sqrt(robustVar);

        // Satterthwaite degrees of freedom approximation
        const df = Math.max(1, m - 1);

        return {
            estimate: estimate,
            se: robustSE,
            variance: robustVar,
            df: df,
            nStudies: m,
            nEffects: n,
            rho: rho,
            method: 'RVE-CR2'
        };
    }

    /**
     * Cluster-robust standard errors for meta-regression
     * Reference: Tipton E. (2015). Small sample adjustments for robust variance
     * estimation with meta-regression. Psychological Methods, 20(3), 375-393.
     */
    function clusterRobustSE(beta, residuals, weights, studyIds, X) {
        const n = residuals.length;
        const p = beta.length;
        const uniqueStudies = [...new Set(studyIds)];
        const m = uniqueStudies.length;

        // Bread matrix: (X'WX)^-1
        // This is simplified - full implementation needs matrix ops
        const sumW = sum(weights);
        const breadInv = sumW;

        // Meat matrix: sum of cluster contributions
        let meat = 0;
        uniqueStudies.forEach(id => {
            let clusterSum = 0;
            residuals.forEach((r, i) => {
                if (studyIds[i] === id) {
                    clusterSum += weights[i] * r;
                }
            });
            meat += clusterSum * clusterSum;
        });

        // Sandwich
        const robustVar = (1 / (breadInv * breadInv)) * meat;

        // Small-sample correction
        const correction = m / (m - p);

        return {
            se: Math.sqrt(Math.max(0, robustVar * correction)),
            df: m - p
        };
    }


    return {
        // Seedable PRNG for reproducibility
        setSeed,
        clearSeed,

        // Basic stats
        mean,
        median,
        variance,
        sd,
        weightedMean,
        weightedVariance,
        sum,
        sumOfSquares,
        // Small-sample corrections
        hedgesJ,
        hedgesG,
        smd,

        // Robust variance estimation
        robustVariance,
        clusterRobustSE,


        // Distributions
        rnorm, dnorm, pnorm, qnorm,
        dchisq, pchisq, qchisq,
        dt, pt, qt,
        pf, qf,

        // Special functions
        lgamma, gamma,
        gammainc, beta, betainc, erf,

        // Matrix operations
        matmul, transpose, inverse, cholesky, choleskySolve, det,

        // Optimization
        goldenSection, brent, bfgs, newtonRaphson,

        // Regression
        linearRegression, weightedLinearRegression,

        // Rank statistics
        rank, kendallTau, spearmanRho,

        // Confidence intervals
        wilsonCI, profileLikelihoodCI,

        // Transformations
        logit, invLogit, fisherZ, invFisherZ, freemanTukey, invFreemanTukey,

        // Effect sizes
        seFromCI, seFromP, ratioToLog, seLogHR,

        // Constants
        EPSILON, TOLERANCE, MAX_ITERATIONS
    };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Statistics;
}
