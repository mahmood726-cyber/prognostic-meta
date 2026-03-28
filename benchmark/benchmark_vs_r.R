# ============================================================================
# BENCHMARK: PrognosisMeta vs R Packages
# ============================================================================

required_packages <- c("metafor", "meta", "netmeta", "metasens",
                       "weightr", "robumeta", "mvmeta", "jsonlite")

for (pkg in required_packages) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    install.packages(pkg, repos = "https://cloud.r-project.org")
  }
}

library(metafor)
library(meta)
library(jsonlite)

sep <- paste(rep("=", 70), collapse="")

cat(sep, "\n")
cat("BENCHMARK: PrognosisMeta JavaScript vs R Packages\n")
cat(sep, "\n\n")

# TEST DATA - BCG Vaccine Trial
data(dat.bcg)
dat <- escalc(measure="RR", ai=tpos, bi=tneg, ci=cpos, di=cneg, data=dat.bcg)
dat$sei <- sqrt(dat$vi)  # Add standard error column

cat("Test Dataset: BCG Vaccine Trials (13 studies)\n")
cat("Outcome: Log Risk Ratio of TB infection\n\n")

# Export test data as JSON
test_data <- data.frame(
  study = dat$author, year = dat$year,
  yi = as.numeric(dat$yi), vi = as.numeric(dat$vi),
  sei = as.numeric(dat$sei)
)
write(toJSON(test_data, pretty=TRUE), "test_data_bcg.json")

# 1. RANDOM-EFFECTS META-ANALYSIS
cat("\n", sep, "\n1. RANDOM-EFFECTS META-ANALYSIS\n", sep, "\n\n")

res_dl <- rma(yi, vi, data=dat, method="DL")
cat("DerSimonian-Laird (DL):\n")
cat(sprintf("  Pooled estimate: %.6f\n  SE: %.6f\n", res_dl$b[1], res_dl$se))
cat(sprintf("  95%% CI: [%.6f, %.6f]\n", res_dl$ci.lb, res_dl$ci.ub))
cat(sprintf("  tau2: %.6f, I2: %.2f%%, Q: %.4f\n\n", res_dl$tau2, res_dl$I2, res_dl$QE))

res_reml <- rma(yi, vi, data=dat, method="REML")
cat(sprintf("REML: estimate=%.6f, tau2=%.6f\n", res_reml$b[1], res_reml$tau2))

res_pm <- rma(yi, vi, data=dat, method="PM")
cat(sprintf("Paule-Mandel: estimate=%.6f, tau2=%.6f\n", res_pm$b[1], res_pm$tau2))

res_ml <- rma(yi, vi, data=dat, method="ML")
cat(sprintf("ML: estimate=%.6f, tau2=%.6f\n", res_ml$b[1], res_ml$tau2))

res_hs <- rma(yi, vi, data=dat, method="HS")
cat(sprintf("Hunter-Schmidt: estimate=%.6f, tau2=%.6f\n", res_hs$b[1], res_hs$tau2))

res_sj <- rma(yi, vi, data=dat, method="SJ")
cat(sprintf("Sidik-Jonkman: estimate=%.6f, tau2=%.6f\n", res_sj$b[1], res_sj$tau2))

res_he <- rma(yi, vi, data=dat, method="HE")
cat(sprintf("Hedges: estimate=%.6f, tau2=%.6f\n", res_he$b[1], res_he$tau2))

res_eb <- rma(yi, vi, data=dat, method="EB")
cat(sprintf("Empirical Bayes: estimate=%.6f, tau2=%.6f\n\n", res_eb$b[1], res_eb$tau2))

# 2. HKSJ ADJUSTMENT
cat("\n", sep, "\n2. HKSJ ADJUSTMENT\n", sep, "\n\n")
res_hksj <- rma(yi, vi, data=dat, method="DL", test="knha")
cat(sprintf("HKSJ: estimate=%.6f, SE=%.6f\n", res_hksj$b[1], res_hksj$se))
cat(sprintf("  95%% CI: [%.6f, %.6f], df=%d\n\n", res_hksj$ci.lb, res_hksj$ci.ub, res_hksj$dfs))

# 3. FIXED EFFECT
cat("\n", sep, "\n3. FIXED-EFFECT\n", sep, "\n\n")
res_fe <- rma(yi, vi, data=dat, method="FE")
cat(sprintf("Fixed Effect: estimate=%.6f, SE=%.6f\n", res_fe$b[1], res_fe$se))
cat(sprintf("  95%% CI: [%.6f, %.6f]\n\n", res_fe$ci.lb, res_fe$ci.ub))

# 4. PREDICTION INTERVAL
cat("\n", sep, "\n4. PREDICTION INTERVAL\n", sep, "\n\n")
pred <- predict(res_dl)
cat(sprintf("Prediction Interval: [%.6f, %.6f]\n\n", pred$pi.lb, pred$pi.ub))

# 5. PUBLICATION BIAS
cat("\n", sep, "\n5. PUBLICATION BIAS TESTS\n", sep, "\n\n")
egger <- regtest(res_dl, model="lm")
cat(sprintf("Egger's Test: z=%.4f, p=%.6f\n", egger$zval, egger$pval))

begg <- ranktest(res_dl)
cat(sprintf("Begg's Test: tau=%.4f, p=%.6f\n", begg$tau, begg$pval))

tf <- trimfill(res_dl)
cat(sprintf("Trim-and-Fill: k0=%d (side=%s)\n", tf$k0, tf$side))
cat(sprintf("  Adjusted estimate: %.6f [%.6f, %.6f]\n\n", tf$b[1], tf$ci.lb, tf$ci.ub))

# 6. PET-PEESE
cat("PET-PEESE:\n")
pet <- lm(yi ~ sei, data=dat, weights=1/vi)
cat(sprintf("  PET intercept: %.6f (p=%.6f)\n", coef(pet)[1], summary(pet)$coefficients[1,4]))
peese <- lm(yi ~ vi, data=dat, weights=1/vi)
cat(sprintf("  PEESE intercept: %.6f (p=%.6f)\n\n", coef(peese)[1], summary(peese)$coefficients[1,4]))

# 7. NETWORK META-ANALYSIS
cat("\n", sep, "\n7. NETWORK META-ANALYSIS\n", sep, "\n\n")
tryCatch({
  library(netmeta)
  data(Senn2013)
  net <- netmeta(TE, seTE, treat1, treat2, studlab, data=Senn2013, sm="MD", random=TRUE)
  cat(sprintf("Network MA (Senn2013): %d treatments, %d studies\n", net$n, net$k))
  cat(sprintf("  tau2: %.6f, I2: %.1f%%\n", net$tau2, net$I2))
  ps <- netrank(net, small.values="good")
  cat("\nP-scores:\n")
  print(round(ps$Pscore.random, 4))
}, error = function(e) cat("netmeta unavailable\n"))

# 8. LEAVE-ONE-OUT
cat("\n", sep, "\n8. LEAVE-ONE-OUT ANALYSIS\n", sep, "\n\n")
loo <- leave1out(res_dl)
for (i in 1:3) {
  cat(sprintf("  Omit %s: estimate=%.4f, tau2=%.4f\n", 
              dat$author[i], loo$estimate[i], loo$tau2[i]))
}
cat("  ...\n")

# 9. META-REGRESSION
cat("\n", sep, "\n9. META-REGRESSION\n", sep, "\n\n")
res_reg <- rma(yi, vi, data=dat, mods=~ablat, method="DL")
cat(sprintf("Effect ~ Latitude:\n"))
cat(sprintf("  Intercept: %.6f (p=%.6f)\n", res_reg$b[1], res_reg$pval[1]))
cat(sprintf("  Slope: %.6f (p=%.6f)\n", res_reg$b[2], res_reg$pval[2]))
cat(sprintf("  R2: %.2f%%, Residual tau2: %.6f\n\n", res_reg$R2, res_reg$tau2))

# Export benchmark results as JSON
benchmark_results <- list(
  dataset = "BCG Vaccine Trials (dat.bcg from metafor)",
  n_studies = 13,
  outcome = "Log Risk Ratio",
  
  random_effects = list(
    DL = list(estimate = as.numeric(res_dl$b[1]), se = res_dl$se, 
              ci_lb = res_dl$ci.lb, ci_ub = res_dl$ci.ub,
              tau2 = res_dl$tau2, I2 = res_dl$I2, Q = res_dl$QE),
    REML = list(estimate = as.numeric(res_reml$b[1]), tau2 = res_reml$tau2),
    PM = list(estimate = as.numeric(res_pm$b[1]), tau2 = res_pm$tau2),
    ML = list(estimate = as.numeric(res_ml$b[1]), tau2 = res_ml$tau2),
    HS = list(estimate = as.numeric(res_hs$b[1]), tau2 = res_hs$tau2),
    SJ = list(estimate = as.numeric(res_sj$b[1]), tau2 = res_sj$tau2),
    HE = list(estimate = as.numeric(res_he$b[1]), tau2 = res_he$tau2),
    EB = list(estimate = as.numeric(res_eb$b[1]), tau2 = res_eb$tau2)
  ),
  
  hksj = list(estimate = as.numeric(res_hksj$b[1]), se = res_hksj$se,
              ci_lb = res_hksj$ci.lb, ci_ub = res_hksj$ci.ub, df = res_hksj$dfs),
  
  fixed_effect = list(estimate = as.numeric(res_fe$b[1]), se = res_fe$se,
                      ci_lb = res_fe$ci.lb, ci_ub = res_fe$ci.ub),
  
  prediction_interval = list(lb = pred$pi.lb, ub = pred$pi.ub),
  
  publication_bias = list(
    egger = list(z = egger$zval, p = egger$pval),
    begg = list(tau = begg$tau, p = begg$pval),
    trimfill = list(k0 = tf$k0, side = tf$side, 
                    adjusted = as.numeric(tf$b[1]))
  ),
  
  pet_peese = list(
    pet_intercept = coef(pet)[1],
    peese_intercept = coef(peese)[1]
  ),
  
  meta_regression = list(
    intercept = as.numeric(res_reg$b[1]),
    slope = as.numeric(res_reg$b[2]),
    R2 = res_reg$R2,
    residual_tau2 = res_reg$tau2
  )
)

write(toJSON(benchmark_results, pretty=TRUE, auto_unbox=TRUE), "benchmark_results.json")

cat("\n", sep, "\n")
cat("BENCHMARK COMPLETE\n")
cat("Results exported to: benchmark_results.json\n")
cat("Test data exported to: test_data_bcg.json\n")
cat(sep, "\n")
