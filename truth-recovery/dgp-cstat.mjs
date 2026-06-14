/**
 * Standalone seeded known-truth DGP for C-statistic meta-analysis.
 *
 * Model (Debray 2017 / Riley 2016 framework):
 *   - There is a TRUE population C-statistic, C_true.
 *   - Study i's true C is drawn on the LOGIT scale with between-study SD tau:
 *         theta_i = logit(C_true) + N(0, tau)
 *   - Study i reports an OBSERVED C with within-study sampling error.
 *     We draw the observed logit-C as N(theta_i, se_logit_i^2), where
 *     se_logit_i is the SE of logit(C) implied by a finite validation sample.
 *
 * Within-study SE of C-statistic (natural scale): Newcombe / Hanley-McNeil style
 * approximation as a function of C and the number of events (n1) and non-events (n0).
 * We then convert to the logit scale via the delta method:
 *     se_logit = se_C / (C * (1 - C))
 *
 * The engine's poolCStatistics takes (cstats[], ses_natural[]) and internally
 * applies the SAME delta-method conversion. So the DGP reports the NATURAL-scale
 * SE of C, exactly the input contract the engine expects.
 *
 * Uses the repo's OWN seeded rnorm so runs are reproducible and the RNG matches.
 */
import { setSeed, invLogit, logit, Statistics } from './engine.mjs';

const rnorm = Statistics.rnorm;

/** Hanley-McNeil (1982) SE of the AUC/C-statistic on the natural scale. */
export function seCstatNatural(C, n1, n0) {
  const Q1 = C / (2 - C);
  const Q2 = (2 * C * C) / (1 + C);
  const v = (C * (1 - C) + (n1 - 1) * (Q1 - C * C) + (n0 - 1) * (Q2 - C * C)) / (n1 * n0);
  return Math.sqrt(Math.max(v, 1e-12));
}

/**
 * Generate one meta-analysis dataset.
 * @param {object} o
 * @param {number} o.Ctrue   true population C-statistic in (0.5,1)
 * @param {number} o.tau     between-study SD on the logit scale
 * @param {number} o.k       number of studies
 * @param {number} o.nEvents events per study (n1)
 * @param {number} o.nControls non-events per study (n0)
 * @param {number} o.seed
 * @returns {{cstats:number[], ses:number[], Ctrue:number, tau:number}}
 */
export function generateCstatStudies({ Ctrue, tau, k, nEvents = 200, nControls = 400, seed }) {
  setSeed(seed);
  const logitTrue = logit(Ctrue);
  const cstats = [];
  const ses = [];
  for (let i = 0; i < k; i++) {
    // study-specific true logit-C with between-study heterogeneity
    const theta_i = logitTrue + (tau > 0 ? rnorm(0, tau) : 0);
    const Ci_true = invLogit(theta_i);
    // within-study natural-scale SE, then convert to logit-scale sampling SD
    const seC = seCstatNatural(Ci_true, nEvents, nControls);
    const seLogit = seC / (Ci_true * (1 - Ci_true));
    // observed logit-C = true + sampling error
    const obsLogit = theta_i + rnorm(0, seLogit);
    let Cobs = invLogit(obsLogit);
    // clamp to a sane open interval (a finite validation sample can't report 0.5 or 1.0 exactly)
    Cobs = Math.min(0.9999, Math.max(0.5001, Cobs));
    cstats.push(Cobs);
    // report the NATURAL-scale SE at the OBSERVED C (what a real study would publish)
    ses.push(seCstatNatural(Cobs, nEvents, nControls));
  }
  return { cstats, ses, Ctrue, tau };
}
