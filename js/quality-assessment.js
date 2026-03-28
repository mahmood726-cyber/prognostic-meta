/**
 * Quality Assessment and Risk of Bias Tools
 * Comprehensive assessment frameworks for methodologists
 * - GRADE (Grading of Recommendations Assessment)
 * - PROBAST (Prediction model Risk Of Bias Assessment Tool)
 * - ROB-2 (Risk of Bias 2 for RCTs)
 * - ROBINS-I (Risk Of Bias In Non-randomised Studies)
 * - QUADAS-2 (Quality Assessment of Diagnostic Accuracy Studies)
 * - Newcastle-Ottawa Scale
 */

const QualityAssessment = (function() {
    'use strict';

    // ============================================
    // GRADE ASSESSMENT
    // ============================================

    const GRADE = {
        domains: [
            { id: 'risk_of_bias', label: 'Risk of Bias', weight: 1 },
            { id: 'inconsistency', label: 'Inconsistency', weight: 1 },
            { id: 'indirectness', label: 'Indirectness', weight: 1 },
            { id: 'imprecision', label: 'Imprecision', weight: 1 },
            { id: 'publication_bias', label: 'Publication Bias', weight: 1 }
        ],

        ratings: {
            'no_concern': { value: 0, label: 'No serious concern' },
            'serious': { value: -1, label: 'Serious concern' },
            'very_serious': { value: -2, label: 'Very serious concern' }
        },

        upgradeFactors: [
            { id: 'large_effect', label: 'Large effect', upgrade: 1 },
            { id: 'dose_response', label: 'Dose-response gradient', upgrade: 1 },
            { id: 'confounding', label: 'All plausible confounding would reduce effect', upgrade: 1 }
        ],

        qualityLevels: [
            { min: 4, label: 'High', description: 'Very confident in effect estimate' },
            { min: 3, label: 'Moderate', description: 'Moderate confidence; true effect likely close' },
            { min: 2, label: 'Low', description: 'Limited confidence; true effect may differ' },
            { min: -Infinity, label: 'Very Low', description: 'Little confidence in effect estimate' }
        ],

        /**
         * Assess GRADE quality of evidence
         */
        assess: function(data, options = {}) {
            const {
                studyDesign = 'rct',  // 'rct' or 'observational'
                riskOfBias = 'no_concern',
                inconsistency = 'no_concern',
                indirectness = 'no_concern',
                imprecision = 'no_concern',
                publicationBias = 'no_concern',
                upgrades = []
            } = options;

            // Starting quality
            let quality = studyDesign === 'rct' ? 4 : 2;  // High for RCT, Low for obs

            // Downgrade for concerns
            quality += this.ratings[riskOfBias].value;
            quality += this.ratings[inconsistency].value;
            quality += this.ratings[indirectness].value;
            quality += this.ratings[imprecision].value;
            quality += this.ratings[publicationBias].value;

            // Upgrade for special factors (observational only)
            if (studyDesign === 'observational') {
                upgrades.forEach(u => {
                    const factor = this.upgradeFactors.find(f => f.id === u);
                    if (factor) quality += factor.upgrade;
                });
            }

            // Determine final level
            const level = this.qualityLevels.find(l => quality >= l.min);

            // Auto-assess some criteria from data
            const autoAssessment = this.autoAssess(data);

            return {
                quality: quality,
                level: level.label,
                description: level.description,
                startingLevel: studyDesign === 'rct' ? 'High' : 'Low',
                downgrades: {
                    riskOfBias: this.ratings[riskOfBias],
                    inconsistency: this.ratings[inconsistency],
                    indirectness: this.ratings[indirectness],
                    imprecision: this.ratings[imprecision],
                    publicationBias: this.ratings[publicationBias]
                },
                upgrades: upgrades.map(u => this.upgradeFactors.find(f => f.id === u)),
                autoAssessment: autoAssessment,
                summary: this.generateSummary(level.label, studyDesign)
            };
        },

        autoAssess: function(data) {
            if (!data || data.length === 0) return {};

            // Calculate statistics for auto-assessment
            const yi = data.map(d => d.yi);
            const vi = data.map(d => d.vi);
            const n = yi.length;

            // Inconsistency (I²) - check if MetaAnalysis module is available
            if (typeof MetaAnalysis === 'undefined') {
                return { error: 'MetaAnalysis module not loaded' };
            }
            const re = MetaAnalysis.randomEffects(yi, vi, 'DL');
            let inconsistencyConcern = 'no_concern';
            if (re.I2 > 75) inconsistencyConcern = 'very_serious';
            else if (re.I2 > 50) inconsistencyConcern = 'serious';

            // Imprecision (CI width, sample size)
            let imprecisionConcern = 'no_concern';
            const ciWidth = re.ci.upper - re.ci.lower;
            const totalN = data.reduce((sum, d) => sum + (d.n || 100), 0);
            if (ciWidth > 1 || totalN < 300) imprecisionConcern = 'serious';
            if (ciWidth > 2 || totalN < 100) imprecisionConcern = 'very_serious';

            // Publication bias (Egger's test)
            let pubBiasConcern = 'no_concern';
            if (n >= 10) {
                const sei = vi.map(v => Math.sqrt(v));
                const egger = MetaAnalysis.eggerTest(yi, sei);
                if (egger.pValue < 0.05) pubBiasConcern = 'serious';
                if (egger.pValue < 0.01) pubBiasConcern = 'very_serious';
            }

            return {
                inconsistency: {
                    I2: re.I2,
                    suggestion: inconsistencyConcern,
                    rationale: `I² = ${re.I2.toFixed(1)}%`
                },
                imprecision: {
                    ciWidth: ciWidth,
                    totalN: totalN,
                    suggestion: imprecisionConcern,
                    rationale: `CI width = ${ciWidth.toFixed(2)}, Total N = ${totalN}`
                },
                publicationBias: {
                    suggestion: pubBiasConcern,
                    rationale: n >= 10 ? 'Based on Egger\'s test' : 'Insufficient studies for test'
                }
            };
        },

        generateSummary: function(level, studyDesign) {
            const templates = {
                'High': `Based on ${studyDesign === 'rct' ? 'randomized controlled trials' : 'observational studies'} with no serious limitations, we have high confidence that the true effect lies close to the estimated effect.`,
                'Moderate': `Based on ${studyDesign === 'rct' ? 'randomized controlled trials' : 'observational studies'} with some limitations, we have moderate confidence in the effect estimate. The true effect is likely to be close to the estimate but may differ substantially.`,
                'Low': `The evidence is of low quality. Our confidence in the effect estimate is limited, and the true effect may be substantially different from the estimate.`,
                'Very Low': `The evidence is of very low quality. We have very little confidence in the effect estimate, and the true effect is likely to be substantially different from the estimate.`
            };
            return templates[level] || '';
        }
    };

    // ============================================
    // PROBAST (Prediction Model Assessment)
    // ============================================

    const PROBAST = {
        domains: [
            {
                id: 'participants',
                label: 'Participants',
                questions: [
                    { id: '1.1', text: 'Were appropriate data sources used?', type: 'yn' },
                    { id: '1.2', text: 'Were all inclusions and exclusions of participants appropriate?', type: 'yn' }
                ]
            },
            {
                id: 'predictors',
                label: 'Predictors',
                questions: [
                    { id: '2.1', text: 'Were predictors defined and assessed in a similar way for all participants?', type: 'yn' },
                    { id: '2.2', text: 'Were predictor assessments made without knowledge of outcome data?', type: 'yn' },
                    { id: '2.3', text: 'Are all predictors available at the time the model is intended to be used?', type: 'yn' }
                ]
            },
            {
                id: 'outcome',
                label: 'Outcome',
                questions: [
                    { id: '3.1', text: 'Was the outcome determined appropriately?', type: 'yn' },
                    { id: '3.2', text: 'Was the outcome determined without knowledge of predictor information?', type: 'yn' },
                    { id: '3.3', text: 'Was the outcome defined and determined in a similar way for all participants?', type: 'yn' },
                    { id: '3.4', text: 'Was the time interval between predictor assessment and outcome determination appropriate?', type: 'yn' }
                ]
            },
            {
                id: 'analysis',
                label: 'Analysis',
                questions: [
                    { id: '4.1', text: 'Were there a reasonable number of participants with the outcome?', type: 'yn' },
                    { id: '4.2', text: 'Were continuous and categorical predictors handled appropriately?', type: 'yn' },
                    { id: '4.3', text: 'Were all enrolled participants included in the analysis?', type: 'yn' },
                    { id: '4.4', text: 'Were missing data handled appropriately?', type: 'yn' },
                    { id: '4.5', text: 'Was selection of predictors based on univariable analysis avoided?', type: 'yn' },
                    { id: '4.6', text: 'Were complexities in the data accounted for appropriately?', type: 'yn' },
                    { id: '4.7', text: 'Were relevant model performance measures evaluated appropriately?', type: 'yn' },
                    { id: '4.8', text: 'Were model overfitting and optimism in model performance accounted for?', type: 'yn' },
                    { id: '4.9', text: 'Were predictors and their assigned weights reported?', type: 'yn' }
                ]
            }
        ],

        /**
         * Assess PROBAST risk of bias
         */
        assess: function(answers) {
            const results = {
                domains: {},
                overall: { rob: 'low', applicability: 'low' }
            };

            let anyHighROB = false;
            let anyHighApplicability = false;

            this.domains.forEach(domain => {
                const domainAnswers = answers[domain.id] || {};
                let hasNo = false;
                let hasUnclear = false;

                domain.questions.forEach(q => {
                    const answer = domainAnswers[q.id];
                    if (answer === 'no' || answer === 'N') hasNo = true;
                    if (answer === 'unclear' || answer === 'U') hasUnclear = true;
                });

                let rob = 'low';
                if (hasNo) rob = 'high';
                else if (hasUnclear) rob = 'unclear';

                results.domains[domain.id] = {
                    label: domain.label,
                    rob: rob,
                    answers: domainAnswers
                };

                if (rob === 'high') anyHighROB = true;
            });

            // Overall risk of bias
            results.overall.rob = anyHighROB ? 'high' : 'low';

            return results;
        },

        /**
         * Generate traffic light visualization data
         */
        trafficLight: function(studies) {
            return studies.map(study => {
                const assessment = this.assess(study.probast || {});
                return {
                    study: study.study || study.id,
                    domains: Object.keys(assessment.domains).map(d => ({
                        domain: assessment.domains[d].label,
                        judgment: assessment.domains[d].rob
                    })),
                    overall: assessment.overall.rob
                };
            });
        }
    };

    // ============================================
    // ROB-2 (Risk of Bias for RCTs)
    // ============================================

    const ROB2 = {
        domains: [
            {
                id: 'randomization',
                label: 'Randomization process',
                questions: [
                    { id: '1.1', text: 'Was the allocation sequence random?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
                    { id: '1.2', text: 'Was the allocation sequence concealed until participants were enrolled?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
                    { id: '1.3', text: 'Did baseline differences suggest a problem with randomization?', options: ['Y', 'PY', 'PN', 'N', 'NI'] }
                ],
                algorithm: function(answers) {
                    if (answers['1.1'] === 'Y' && answers['1.2'] === 'Y' && answers['1.3'] !== 'Y') {
                        return 'low';
                    }
                    if (answers['1.1'] === 'N' || answers['1.2'] === 'N' || answers['1.3'] === 'Y') {
                        return 'high';
                    }
                    return 'some_concerns';
                }
            },
            {
                id: 'deviations',
                label: 'Deviations from intended interventions',
                questions: [
                    { id: '2.1', text: 'Were participants aware of their assigned intervention?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
                    { id: '2.2', text: 'Were carers aware of participants\' assigned intervention?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
                    { id: '2.3', text: 'Were there deviations from intended intervention beyond what would be expected?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
                    { id: '2.4', text: 'Was an appropriate analysis used to estimate the effect of assignment?', options: ['Y', 'PY', 'PN', 'N', 'NI'] }
                ],
                algorithm: function(answers) {
                    if ((answers['2.1'] === 'N' || answers['2.2'] === 'N') &&
                        answers['2.3'] !== 'Y' && answers['2.4'] === 'Y') {
                        return 'low';
                    }
                    if (answers['2.3'] === 'Y' || answers['2.4'] === 'N') {
                        return 'high';
                    }
                    return 'some_concerns';
                }
            },
            {
                id: 'missing_data',
                label: 'Missing outcome data',
                questions: [
                    { id: '3.1', text: 'Were outcome data available for all, or nearly all, participants?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
                    { id: '3.2', text: 'Is there evidence that result was not biased by missing outcome data?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
                    { id: '3.3', text: 'Could missingness depend on the true value of the outcome?', options: ['Y', 'PY', 'PN', 'N', 'NI'] }
                ],
                algorithm: function(answers) {
                    if (answers['3.1'] === 'Y' || answers['3.2'] === 'Y') {
                        return 'low';
                    }
                    if (answers['3.3'] === 'Y') {
                        return 'high';
                    }
                    return 'some_concerns';
                }
            },
            {
                id: 'measurement',
                label: 'Measurement of the outcome',
                questions: [
                    { id: '4.1', text: 'Was the method of measuring the outcome inappropriate?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
                    { id: '4.2', text: 'Could measurement or ascertainment of outcome have differed between groups?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
                    { id: '4.3', text: 'Were outcome assessors aware of intervention received?', options: ['Y', 'PY', 'PN', 'N', 'NI'] }
                ],
                algorithm: function(answers) {
                    if (answers['4.1'] === 'N' && answers['4.2'] === 'N' &&
                        (answers['4.3'] === 'N' || answers['4.3'] === 'NI')) {
                        return 'low';
                    }
                    if (answers['4.1'] === 'Y' || answers['4.2'] === 'Y') {
                        return 'high';
                    }
                    return 'some_concerns';
                }
            },
            {
                id: 'reporting',
                label: 'Selection of the reported result',
                questions: [
                    { id: '5.1', text: 'Were the data that produced this result analysed in accordance with a pre-specified plan?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
                    { id: '5.2', text: 'Is the numerical result likely to have been selected from multiple outcome measurements?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
                    { id: '5.3', text: 'Is the numerical result likely to have been selected from multiple analyses?', options: ['Y', 'PY', 'PN', 'N', 'NI'] }
                ],
                algorithm: function(answers) {
                    if (answers['5.1'] === 'Y' && answers['5.2'] === 'N' && answers['5.3'] === 'N') {
                        return 'low';
                    }
                    if (answers['5.2'] === 'Y' || answers['5.3'] === 'Y') {
                        return 'high';
                    }
                    return 'some_concerns';
                }
            }
        ],

        /**
         * Assess ROB-2
         */
        assess: function(answers) {
            const results = {
                domains: {},
                overall: 'low'
            };

            let hasHigh = false;
            let hasSomeConcerns = false;

            this.domains.forEach(domain => {
                const domainAnswers = answers[domain.id] || {};
                const judgment = domain.algorithm(domainAnswers);

                results.domains[domain.id] = {
                    label: domain.label,
                    judgment: judgment,
                    answers: domainAnswers
                };

                if (judgment === 'high') hasHigh = true;
                if (judgment === 'some_concerns') hasSomeConcerns = true;
            });

            if (hasHigh) {
                results.overall = 'high';
            } else if (hasSomeConcerns) {
                results.overall = 'some_concerns';
            }

            return results;
        },

        /**
         * Get summary counts for studies
         */
        summarize: function(studies) {
            const counts = {
                low: 0,
                some_concerns: 0,
                high: 0
            };

            studies.forEach(study => {
                const assessment = this.assess(study.rob2 || {});
                counts[assessment.overall]++;
            });

            return counts;
        }
    };

    // ============================================
    // ROBINS-I (Non-randomized Studies)
    // ============================================

    const ROBINS_I = {
        domains: [
            { id: 'confounding', label: 'Bias due to confounding' },
            { id: 'selection', label: 'Bias in selection of participants' },
            { id: 'classification', label: 'Bias in classification of interventions' },
            { id: 'deviations', label: 'Bias due to deviations from intended interventions' },
            { id: 'missing_data', label: 'Bias due to missing data' },
            { id: 'measurement', label: 'Bias in measurement of outcomes' },
            { id: 'reporting', label: 'Bias in selection of the reported result' }
        ],

        judgments: ['low', 'moderate', 'serious', 'critical', 'no_information'],

        assess: function(answers) {
            const results = { domains: {}, overall: 'low' };
            let worstJudgment = 0;

            const judgmentOrder = ['low', 'moderate', 'serious', 'critical', 'no_information'];

            this.domains.forEach(domain => {
                const judgment = answers[domain.id] || 'no_information';
                results.domains[domain.id] = {
                    label: domain.label,
                    judgment: judgment
                };

                const idx = judgmentOrder.indexOf(judgment);
                if (idx > worstJudgment && judgment !== 'no_information') {
                    worstJudgment = idx;
                }
            });

            results.overall = judgmentOrder[worstJudgment];
            return results;
        }
    };

    // ============================================
    // QUADAS-2 (Diagnostic Accuracy Studies)
    // ============================================

    const QUADAS2 = {
        domains: [
            {
                id: 'patient_selection',
                label: 'Patient Selection',
                robQuestions: [
                    'Was a consecutive or random sample of patients enrolled?',
                    'Was a case-control design avoided?',
                    'Did the study avoid inappropriate exclusions?'
                ],
                applicabilityQuestion: 'Is there concern that the included patients do not match the review question?'
            },
            {
                id: 'index_test',
                label: 'Index Test',
                robQuestions: [
                    'Were the index test results interpreted without knowledge of the reference standard results?',
                    'If a threshold was used, was it pre-specified?'
                ],
                applicabilityQuestion: 'Is there concern that the index test, its conduct, or interpretation differ from the review question?'
            },
            {
                id: 'reference_standard',
                label: 'Reference Standard',
                robQuestions: [
                    'Is the reference standard likely to correctly classify the target condition?',
                    'Were the reference standard results interpreted without knowledge of the index test results?'
                ],
                applicabilityQuestion: 'Is there concern that the target condition as defined by the reference standard does not match the review question?'
            },
            {
                id: 'flow_timing',
                label: 'Flow and Timing',
                robQuestions: [
                    'Was there an appropriate interval between index test and reference standard?',
                    'Did all patients receive the same reference standard?',
                    'Were all patients included in the analysis?'
                ],
                applicabilityQuestion: null
            }
        ],

        assess: function(answers) {
            const results = { domains: {}, overall: { rob: 'low', applicability: 'low' } };
            let anyHighROB = false;
            let anyHighApplicability = false;

            this.domains.forEach(domain => {
                const domainAnswers = answers[domain.id] || {};

                // ROB assessment
                let robJudgment = 'low';
                const robAnswers = domainAnswers.rob || {};
                Object.values(robAnswers).forEach(a => {
                    if (a === 'no' || a === 'N') robJudgment = 'high';
                    if (a === 'unclear' && robJudgment === 'low') robJudgment = 'unclear';
                });

                // Applicability assessment
                let applicabilityJudgment = 'low';
                if (domain.applicabilityQuestion && domainAnswers.applicability) {
                    if (domainAnswers.applicability === 'high') applicabilityJudgment = 'high';
                    if (domainAnswers.applicability === 'unclear') applicabilityJudgment = 'unclear';
                }

                results.domains[domain.id] = {
                    label: domain.label,
                    rob: robJudgment,
                    applicability: applicabilityJudgment
                };

                if (robJudgment === 'high') anyHighROB = true;
                if (applicabilityJudgment === 'high') anyHighApplicability = true;
            });

            results.overall.rob = anyHighROB ? 'high' : 'low';
            results.overall.applicability = anyHighApplicability ? 'high' : 'low';

            return results;
        }
    };

    // ============================================
    // NEWCASTLE-OTTAWA SCALE
    // ============================================

    const NewcastleOttawa = {
        cohort: {
            selection: [
                { id: 's1', text: 'Representativeness of the exposed cohort', maxStars: 1 },
                { id: 's2', text: 'Selection of the non-exposed cohort', maxStars: 1 },
                { id: 's3', text: 'Ascertainment of exposure', maxStars: 1 },
                { id: 's4', text: 'Demonstration that outcome was not present at start', maxStars: 1 }
            ],
            comparability: [
                { id: 'c1', text: 'Comparability based on design or analysis', maxStars: 2 }
            ],
            outcome: [
                { id: 'o1', text: 'Assessment of outcome', maxStars: 1 },
                { id: 'o2', text: 'Was follow-up long enough for outcomes to occur', maxStars: 1 },
                { id: 'o3', text: 'Adequacy of follow-up of cohorts', maxStars: 1 }
            ]
        },

        caseControl: {
            selection: [
                { id: 's1', text: 'Is the case definition adequate?', maxStars: 1 },
                { id: 's2', text: 'Representativeness of the cases', maxStars: 1 },
                { id: 's3', text: 'Selection of controls', maxStars: 1 },
                { id: 's4', text: 'Definition of controls', maxStars: 1 }
            ],
            comparability: [
                { id: 'c1', text: 'Comparability based on design or analysis', maxStars: 2 }
            ],
            exposure: [
                { id: 'e1', text: 'Ascertainment of exposure', maxStars: 1 },
                { id: 'e2', text: 'Same method of ascertainment for cases and controls', maxStars: 1 },
                { id: 'e3', text: 'Non-response rate', maxStars: 1 }
            ]
        },

        assess: function(answers, studyType = 'cohort') {
            const scale = this[studyType];
            let totalStars = 0;
            const maxStars = 9;
            const breakdown = {};

            Object.keys(scale).forEach(category => {
                let categoryStars = 0;
                scale[category].forEach(item => {
                    const stars = answers[item.id] || 0;
                    categoryStars += Math.min(stars, item.maxStars);
                });
                breakdown[category] = categoryStars;
                totalStars += categoryStars;
            });

            let quality = 'poor';
            if (totalStars >= 7) quality = 'good';
            else if (totalStars >= 5) quality = 'fair';

            return {
                totalStars: totalStars,
                maxStars: maxStars,
                breakdown: breakdown,
                quality: quality
            };
        }
    };

    // ============================================
    // SENSITIVITY ANALYSIS BASED ON ROB
    // ============================================

    function sensitivityAnalysisByROB(data, robAssessments, options = {}) {
        const {
            robField = 'overall',
            excludeHigh = true,
            excludeUnclear = false
        } = options;

        // Full analysis
        const fullYi = data.map(d => d.yi);
        const fullVi = data.map(d => d.vi);
        const fullResults = MetaAnalysis.randomEffects(fullYi, fullVi, 'DL');

        // Filter to low ROB studies
        const lowRobData = data.filter((d, i) => {
            const rob = robAssessments[i]?.[robField] || 'unclear';
            if (excludeHigh && (rob === 'high' || rob === 'critical')) return false;
            if (excludeUnclear && rob === 'unclear') return false;
            return true;
        });

        let lowRobResults = null;
        if (lowRobData.length > 0) {
            const lowYi = lowRobData.map(d => d.yi);
            const lowVi = lowRobData.map(d => d.vi);
            lowRobResults = MetaAnalysis.randomEffects(lowYi, lowVi, 'DL');
        }

        // Comparison
        let difference = null;
        if (lowRobResults) {
            difference = {
                effectChange: lowRobResults.effect - fullResults.effect,
                percentChange: ((lowRobResults.effect - fullResults.effect) / fullResults.effect) * 100,
                heterogeneityChange: lowRobResults.I2 - fullResults.I2
            };
        }

        return {
            full: {
                estimate: fullResults.effect,
                se: fullResults.se,
                ci: fullResults.ci,
                I2: fullResults.I2,
                nStudies: data.length
            },
            lowRob: lowRobResults ? {
                estimate: lowRobResults.effect,
                se: lowRobResults.se,
                ci: lowRobResults.ci,
                I2: lowRobResults.I2,
                nStudies: lowRobData.length
            } : null,
            difference: difference,
            interpretation: interpretROBSensitivity(difference, data.length, lowRobData.length)
        };
    }

    function interpretROBSensitivity(diff, nFull, nLow) {
        if (!diff) return 'Unable to conduct sensitivity analysis (all studies high ROB)';

        const excluded = nFull - nLow;
        let interpretation = `Excluding ${excluded} high ROB studies: `;

        if (Math.abs(diff.percentChange) < 10) {
            interpretation += 'Results robust to ROB exclusions (< 10% change in effect estimate).';
        } else if (Math.abs(diff.percentChange) < 25) {
            interpretation += 'Moderate sensitivity to ROB (10-25% change in effect estimate).';
        } else {
            interpretation += 'High sensitivity to ROB (> 25% change). Results may be biased by high ROB studies.';
        }

        return interpretation;
    }

    // ============================================
    // VISUALIZATION HELPERS
    // ============================================

    function generateTrafficLightData(studies, assessmentType = 'rob2') {
        const assessors = {
            'rob2': ROB2,
            'probast': PROBAST,
            'quadas2': QUADAS2,
            'robins_i': ROBINS_I
        };

        const assessor = assessors[assessmentType];
        if (!assessor) return [];

        return studies.map(study => {
            const assessment = assessor.assess(study[assessmentType] || {});
            return {
                study: study.study || study.id,
                domains: Object.keys(assessment.domains).map(d => ({
                    id: d,
                    label: assessment.domains[d].label,
                    judgment: assessment.domains[d].judgment || assessment.domains[d].rob
                })),
                overall: assessment.overall
            };
        });
    }

    function generateSummaryBarData(studies, assessmentType = 'rob2') {
        const data = generateTrafficLightData(studies, assessmentType);
        const domains = data[0]?.domains.map(d => d.id) || [];
        const summary = {};

        domains.forEach(domain => {
            summary[domain] = { low: 0, some_concerns: 0, unclear: 0, high: 0 };
        });

        data.forEach(study => {
            study.domains.forEach(d => {
                const judgment = d.judgment.replace(' ', '_');
                if (summary[d.id][judgment] !== undefined) {
                    summary[d.id][judgment]++;
                }
            });
        });

        return {
            domains: domains,
            data: summary,
            n: studies.length
        };
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        GRADE,
        PROBAST,
        ROB2,
        ROBINS_I,
        QUADAS2,
        NewcastleOttawa,
        sensitivityAnalysisByROB,
        generateTrafficLightData,
        generateSummaryBarData
    };

})();

// Export for Node.js if applicable
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QualityAssessment;
}
