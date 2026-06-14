/**
 * Known-truth DGP for O:E calibration ratio meta-analysis.
 *   - true population O:E = OEtrue, pooled on the LOG scale.
 *   - study i true log(O:E) = log(OEtrue) + N(0, tau)
 *   - observed: Poisson-style count of observed events O ~ around E*OE_i,
 *     SE(log O:E) ~= 1/sqrt(O) (standard approximation, Debray 2017).
 */
import { setSeed, Statistics } from './engine.mjs';
const rnorm = Statistics.rnorm;

export function generateOEStudies({ OEtrue, tau, k, expectedEvents = 100, seed }) {
  setSeed(seed);
  const logTrue = Math.log(OEtrue);
  const oeRatios = [], ses = [];
  for (let i = 0; i < k; i++) {
    const theta_i = logTrue + (tau > 0 ? rnorm(0, tau) : 0);
    const OE_i = Math.exp(theta_i);
    const E = expectedEvents;
    const meanO = E * OE_i;
    // observed count with Poisson-ish sampling (normal approx, var = meanO)
    let O = Math.max(1, Math.round(meanO + rnorm(0, Math.sqrt(meanO))));
    const oeObs = O / E;
    oeRatios.push(oeObs);
    ses.push(oeObs / Math.sqrt(O)); // natural-scale SE; engine converts via se/oe = 1/sqrt(O)
  }
  return { oeRatios, ses, OEtrue, tau };
}
