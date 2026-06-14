/**
 * Truth-recovery engine adapter (ADDITIVE, non-invasive).
 *
 * The repo's real pooling code lives in:
 *   ../js/statistics.js   -> const Statistics = (IIFE); module.exports = Statistics
 *   ../js/meta-analysis.js-> const MetaAnalysis = (IIFE that requires a global `Statistics`)
 *
 * Both already ship a CommonJS `module.exports`. meta-analysis.js's IIFE throws
 * unless a global `Statistics` is present, so we install it before requiring.
 * NO source function is modified; we only import them VERBATIM and re-export.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

// Install the Statistics global the way index.html's <script> tags do.
const Statistics = require(path.join(here, '..', 'js', 'statistics.js'));
globalThis.Statistics = Statistics;

const MetaAnalysis = require(path.join(here, '..', 'js', 'meta-analysis.js'));

export { Statistics, MetaAnalysis };
export const poolCStatistics   = MetaAnalysis.poolCStatistics;   // logit-scale pooling of C-stat
export const poolOERatios      = MetaAnalysis.poolOERatios;      // log-scale pooling of O:E
export const poolCalibrationSlopes = MetaAnalysis.poolCalibrationSlopes;
export const randomEffects     = MetaAnalysis.randomEffects;     // z-interval RE
export const randomEffectsHKSJ = MetaAnalysis.randomEffectsHKSJ; // t-interval HKSJ RE
export const setSeed           = Statistics.setSeed;
export const logit             = Statistics.logit;
export const invLogit          = Statistics.invLogit;
