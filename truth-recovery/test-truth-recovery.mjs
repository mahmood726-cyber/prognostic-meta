/**
 * Truth-recovery assertions for prognostic-meta.
 * Run: node truth-recovery/test-truth-recovery.mjs
 * Exit 0 on pass, 1 on failure. No external test framework.
 */
import { poolCStatistics, poolOERatios, invLogit, logit } from './engine.mjs';
import { generateCstatStudies } from './dgp-cstat.mjs';
import { generateOEStudies } from './dgp-oe.mjs';
import { runCell } from './harness.mjs';

let failures = 0;
function ok(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`);
  if (!cond) failures++;
}

// 1. Transform round-trips: invLogit(logit(C)) === C, and engine uses logit scale.
{
  const C = 0.73;
  ok('logit/invLogit round-trip', Math.abs(invLogit(logit(C)) - C) < 1e-12);
}

// 2. Point estimate is essentially unbiased at moderate heterogeneity.
{
  const cell = runCell({ Ctrue: 0.75, tau: 0.15, k: 10, nReps: 2000, baseSeed: 42 });
  ok('C-stat bias < 0.01', Math.abs(cell.biasC) < 0.01, `bias=${cell.biasC.toFixed(5)}`);
}

// 3. Pooled C stays inside (0.5,1) and the CI brackets the point estimate.
{
  const { cstats, ses } = generateCstatStudies({ Ctrue: 0.78, tau: 0.2, k: 8, seed: 7 });
  const r = poolCStatistics(cstats, ses, 'REML');
  ok('pooled C in (0.5,1) & CI brackets it',
    r.pooledC > 0.5 && r.pooledC < 1 && r.cCI.lower < r.pooledC && r.pooledC < r.cCI.upper,
    `C=${r.pooledC.toFixed(4)} CI=[${r.cCI.lower.toFixed(4)},${r.cCI.upper.toFixed(4)}]`);
}

// 4. Documented finding: default z-interval UNDER-COVERS under heterogeneity (k=5, tau=0.35).
//    This asserts the measured behaviour so the bug stays visible (truth-first).
{
  const cell = runCell({ Ctrue: 0.75, tau: 0.35, k: 5, nReps: 2000, baseSeed: 99 });
  ok('z-interval under-covers at k=5 high tau (documented)',
    cell.coverageZ < 0.93, `covZ=${(cell.coverageZ * 100).toFixed(1)}%`);
  ok('HKSJ recovers coverage better than z at k=5 high tau',
    cell.coverageHKSJ > cell.coverageZ, `covH=${(cell.coverageHKSJ * 100).toFixed(1)}% > covZ=${(cell.coverageZ * 100).toFixed(1)}%`);
  // FIX: poolCStatistics now defaults to HKSJ -> the production default recovers
  // nominal coverage in the exact cell where the old z-default failed.
  ok('FIX: new poolCStatistics default (HKSJ) recovers >=94% at k=5 high tau',
    cell.coverageHKSJ >= 0.94, `covDefault=${(cell.coverageHKSJ * 100).toFixed(1)}%`);
}

// 5. O:E ratio pooled on log scale is unbiased and back-transform is correct.
{
  let bias = 0, n = 0;
  for (let r = 0; r < 1500; r++) {
    const { oeRatios, ses } = generateOEStudies({ OEtrue: 1.0, tau: 0.2, k: 10, expectedEvents: 100, seed: 3000 + r });
    const res = poolOERatios(oeRatios, ses, 'REML');
    if (!isFinite(res.pooledOE)) continue;
    n++; bias += (res.pooledOE - 1.0);
  }
  ok('O:E pooled (log scale) bias < 0.01', Math.abs(bias / n) < 0.01, `bias=${(bias / n).toFixed(5)}`);
}

console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
