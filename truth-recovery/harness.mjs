/**
 * Truth-recovery harness for prognostic-meta C-statistic pooling.
 *
 * For each (tau, k) cell:
 *   - simulate N replications of k studies around a known true C
 *   - pool with the repo's OWN poolCStatistics (z / 1.96 interval on logit scale)
 *   - ALSO pool with the repo's randomEffectsHKSJ on the logit scale (t-interval)
 *     and back-transform, to quantify the z-vs-HKSJ coverage gap.
 *   - measure: CI coverage of the TRUE C, mean bias of pooled C, mean CI width.
 *
 * Question answered: does the pooled C-statistic CI recover the true C, and
 * does the default z-interval under-cover at small k vs HKSJ?
 */
import { poolCStatistics, randomEffectsHKSJ, invLogit, logit, Statistics } from './engine.mjs';
import { generateCstatStudies } from './dgp-cstat.mjs';

const rnorm = Statistics.rnorm;

function poolHKSJonLogit(cstats, ses, method = 'REML') {
  // replicate the engine's logit transform + delta-method SE, then use HKSJ
  const logitC = cstats.map(c => logit(c));
  const logitVar = cstats.map((c, i) => {
    const d = c * (1 - c);
    const se = d > 0 ? ses[i] / d : ses[i] * 1e6;
    return se * se;
  });
  const r = randomEffectsHKSJ(logitC, logitVar, method, { truncate: true });
  return {
    pooledC: invLogit(r.effect),
    lower: invLogit(r.ci.lower),
    upper: invLogit(r.ci.upper),
  };
}

export function runCell({ Ctrue, tau, k, nReps, baseSeed }) {
  let covZ = 0, covH = 0, biasSum = 0, widthZ = 0, widthH = 0, ok = 0;
  for (let r = 0; r < nReps; r++) {
    const { cstats, ses } = generateCstatStudies({
      Ctrue, tau, k, nEvents: 200, nControls: 400, seed: baseSeed + r,
    });
    const z = poolCStatistics(cstats, ses, 'REML');
    if (!isFinite(z.pooledC) || !isFinite(z.cCI.lower) || !isFinite(z.cCI.upper)) continue;
    const h = poolHKSJonLogit(cstats, ses, 'REML');
    ok++;
    if (Ctrue >= z.cCI.lower && Ctrue <= z.cCI.upper) covZ++;
    if (Ctrue >= h.lower && Ctrue <= h.upper) covH++;
    biasSum += (z.pooledC - Ctrue);
    widthZ += (z.cCI.upper - z.cCI.lower);
    widthH += (h.upper - h.lower);
  }
  return {
    tau, k, n: ok,
    coverageZ: covZ / ok,
    coverageHKSJ: covH / ok,
    biasC: biasSum / ok,
    widthZ: widthZ / ok,
    widthHKSJ: widthH / ok,
  };
}

export function runSweep({ Ctrue = 0.75, nReps = 2000, baseSeed = 1000 } = {}) {
  const cells = [];
  for (const k of [5, 10, 20]) {
    for (const tau of [0.0, 0.15, 0.35]) {
      cells.push(runCell({ Ctrue, tau, k, nReps, baseSeed: baseSeed + k * 100000 + Math.round(tau * 1000) * 137 }));
    }
  }
  return { Ctrue, nReps, cells };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('harness.mjs')) {
  const out = runSweep();
  console.log(`Known-truth C-statistic recovery | C_true=${out.Ctrue} | reps=${out.nReps}/cell`);
  console.log('tau    k   covZ   covHKSJ  biasC      widthZ   widthHKSJ');
  for (const c of out.cells) {
    console.log(
      `${c.tau.toFixed(2)}  ${String(c.k).padStart(2)}  ` +
      `${(c.coverageZ * 100).toFixed(1)}%  ${(c.coverageHKSJ * 100).toFixed(1)}%   ` +
      `${c.biasC >= 0 ? '+' : ''}${c.biasC.toFixed(5)}  ` +
      `${c.widthZ.toFixed(4)}  ${c.widthHKSJ.toFixed(4)}`
    );
  }
}
