/**
 * Node-runnable regression + edge-case suite for the statistical engine.
 *
 * The engine (js/statistics.js, js/meta-analysis.js, js/data-handler.js) is
 * shipped as browser IIFE modules that also `module.exports` themselves. They
 * reference a bareword `Statistics` global, so we register it on `global`
 * before requiring the dependents.
 *
 * Run:  node --test tests/js/
 * (A thin pytest wrapper, tests/test_js_engine.py, shells out to this so the
 *  repo's `python -m pytest -q` command exercises it in CI.)
 *
 * Metafor anchors come from benchmark/benchmark_results.json (dat.bcg). The
 * checked-in benchmark/test_data_bcg.json rounds yi/vi to 4 dp, so anchors are
 * asserted to a tolerance that reflects that rounding, not 1e-6.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

global.Statistics = require(join(ROOT, 'js', 'statistics.js'));
const MA = require(join(ROOT, 'js', 'meta-analysis.js'));
const DH = require(join(ROOT, 'js', 'data-handler.js'));

const bcg = JSON.parse(readFileSync(join(ROOT, 'benchmark', 'test_data_bcg.json'), 'utf8'));
const YI = bcg.map(s => s.yi);
const VI = bcg.map(s => s.vi);

// ---------------------------------------------------------------------------
// F3 — poolCStatistics on empty input must not throw (empty-input return of
//      randomEffects previously omitted predictionInterval).
// ---------------------------------------------------------------------------
test('F3: poolCStatistics([], []) returns cleanly instead of throwing', () => {
  let r;
  assert.doesNotThrow(() => { r = MA.poolCStatistics([], []); });
  assert.ok(r.error, 'expected an error field on empty input');
  assert.ok(r.cPredictionInterval, 'cPredictionInterval must be present');
});

test('F3: randomEffects([], []) carries a predictionInterval', () => {
  const r = MA.randomEffects([], []);
  assert.ok(r.predictionInterval, 'empty-input return must include predictionInterval');
  assert.ok('lower' in r.predictionInterval && 'upper' in r.predictionInterval);
});

// ---------------------------------------------------------------------------
// F4 — I^2 CI must not be degenerate (zero-width) when heterogeneity is
//      present. Regime df < Q <= k (Higgins-Thompson 2002 small-sample branch).
// ---------------------------------------------------------------------------
test('F4: non-degenerate I^2 CI when df < Q <= k (k=5)', () => {
  const eff = [-1.0607, -0.5303, 0, 0.5303, 1.0607].map(x => x * 1.265);
  const re = MA.randomEffects(eff, [1, 1, 1, 1, 1], 'DL');
  assert.ok(re.Q > re.df, `expected Q(${re.Q}) > df(${re.df})`);
  assert.ok(re.Q <= 5, `expected Q(${re.Q}) <= k(5) for the small-sample branch`);
  assert.ok(re.I2 > 0, 'heterogeneity should be present');
  assert.ok(
    re.I2Upper > re.I2Lower,
    `I^2 CI must be non-degenerate, got [${re.I2Lower}, ${re.I2Upper}]`
  );
  assert.ok(re.I2Lower <= re.I2 && re.I2 <= re.I2Upper, 'point estimate inside CI');
});

test('F4: I^2 CI still ordered in the large-Q branch (BCG, Q>k)', () => {
  const re = MA.randomEffects(YI, VI, 'DL');
  assert.ok(re.Q > YI.length, 'BCG is in the large-Q branch');
  assert.ok(re.I2Upper > re.I2Lower, 'non-degenerate CI');
  assert.ok(re.I2Lower <= re.I2 && re.I2 <= re.I2Upper);
});

// ---------------------------------------------------------------------------
// F5 — parseFloat(x) || null dropped a legitimate 0 for metadata fields.
// ---------------------------------------------------------------------------
test('F5: HR row with events=0 preserves 0 (not null)', () => {
  const out = DH.calculateEffectSizes(
    [{ study: 'A', hr: '1.5', lower: '1.1', upper: '2.0', events: '0' }],
    'prognostic', 'HR'
  );
  assert.equal(out[0].events, 0);
});

test('F5: oe-ratio row with observed=0/expected=0 preserves 0 (not null)', () => {
  const out = DH.calculateEffectSizes(
    [{ study: 'B', oe: '1.0', se: '0.1', observed: '0', expected: '0' }],
    'prediction', 'oe-ratio'
  );
  assert.equal(out[0].observed, 0);
  assert.equal(out[0].expected, 0);
});

test('F5: blank/non-numeric events still becomes null', () => {
  const out = DH.calculateEffectSizes(
    [{ study: 'C', hr: '1.5', lower: '1.1', upper: '2.0', events: '' }],
    'prognostic', 'HR'
  );
  assert.equal(out[0].events, null);
});

// ---------------------------------------------------------------------------
// F1 — edge cases across the untested engine paths.
// ---------------------------------------------------------------------------
test('F1: k=1 does not crash and returns the single effect', () => {
  const r = MA.randomEffects([0.5], [0.1], 'DL');
  assert.equal(r.error, undefined);
  assert.ok(Number.isFinite(r.effect));
  assert.equal(r.effect, 0.5);
  assert.equal(r.I2, 0);
});

test('F1: k=2 does not crash', () => {
  const r = MA.randomEffects([0.5, 0.3], [0.1, 0.1], 'DL');
  assert.ok(Number.isFinite(r.effect));
  assert.ok(Number.isFinite(r.se));
});

test('F1: homogeneous data yields tau2=0 and I2=0', () => {
  const r = MA.randomEffects([0.5, 0.5, 0.5], [0.1, 0.1, 0.1], 'DL');
  assert.equal(r.tau2, 0);
  assert.equal(r.I2, 0);
});

test('F1: poolCStatistics clamps c near 1 without blowing up', () => {
  const r = MA.poolCStatistics([0.999999, 0.7, 0.8], [0.02, 0.03, 0.02]);
  assert.ok(Number.isFinite(r.effect), 'pooled logit effect finite');
  assert.ok(r.pooledC > 0 && r.pooledC < 1, 'back-transformed C in (0,1)');
});

test('F1: zero-cell OR 2x2 continuity-corrects to a finite estimate', () => {
  const out = DH.calculateEffectSizes(
    [{ study: 'Z', or: '2.0', a: '0', b: '10', c: '5', d: '5' }],
    'prognostic', 'OR'
  );
  assert.ok(Number.isFinite(out[0].se) && out[0].se > 0);
  assert.ok(Number.isFinite(out[0].variance));
});

// ---------------------------------------------------------------------------
// F1 — metafor numeric anchors (dat.bcg, DerSimonian-Laird).
// Tolerances reflect the 4-dp rounding of the checked-in yi/vi.
// ---------------------------------------------------------------------------
test('F1: BCG DL random-effects matches metafor within rounding tolerance', () => {
  const re = MA.randomEffects(YI, VI, 'DL');
  assert.ok(Math.abs(re.effect - (-0.7141)) < 1e-3, `estimate ${re.effect}`);
  assert.ok(Math.abs(re.se - 0.1787) < 1e-3, `se ${re.se}`);
  assert.ok(Math.abs(re.tau2 - 0.3088) < 5e-3, `tau2 ${re.tau2}`);
  assert.ok(Math.abs(re.I2 - 92.1173) < 0.5, `I2 ${re.I2}`);
  assert.ok(Math.abs(re.Q - 152.233) < 1.0, `Q ${re.Q}`);
});
