/**
 * PrognosisMeta - Main Application Controller
 * Orchestrates all modules and handles UI interactions
 */

const App = (function() {
    'use strict';

    // ============================================
    // HTML Escape (XSS prevention for user data)
    // ============================================

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ============================================
    // Application State
    // ============================================

    const state = {
        analysisType: 'prognostic',
        effectMeasure: 'HR',
        performanceMetric: 'cstat',
        data: [],
        processedData: [],
        results: null,
        biasTests: null,
        subgroups: null,
        metaRegression: null,
        sensitivity: null,
        bayesianResults: null,
        settings: {
            method: 'random',
            tau2Estimator: 'DL',
            hksjAdjustment: false,
            feMethod: 'IV',
            confLevel: 95,
            showPrediction: true,
            transform: 'auto'
        },
        plots: {}
    };

    // ============================================
    // Initialization
    // ============================================

    function init() {
        console.log('PrognosisMeta initializing...');

        // Set up event listeners
        setupNavigation();
        setupDataInput();
        setupAnalysisSettings();
        setupVisualization();
        setupBiasTests();
        setupAdvancedAnalysis();
        setupDoseResponse();
        setupExport();
        setupProjectManagement();

        // Initialize data table
        updateTableHeaders();

        console.log('PrognosisMeta ready!');
    }

    // ============================================
    // Navigation
    // ============================================

    function setupNavigation() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                switchTab(tabName);
            });
        });
    }

    function switchTab(tabName) {
        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.nav-tab[data-tab="${tabName}"]`)?.classList.add('active');

        // Update panels
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`tab-${tabName}`)?.classList.add('active');
    }

    // ============================================
    // Data Input
    // ============================================

    function setupDataInput() {
        // Analysis type selection
        document.querySelectorAll('input[name="analysis-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.analysisType = e.target.value;
                updateAnalysisTypeUI();
                updateTableHeaders();
            });
        });

        // Effect measure selection
        document.getElementById('effect-measure')?.addEventListener('change', (e) => {
            state.effectMeasure = e.target.value;
            updateTableHeaders();
        });

        // Performance metric selection
        document.getElementById('performance-metric')?.addEventListener('change', (e) => {
            state.performanceMetric = e.target.value;
            updateTableHeaders();
        });

        // Add row button
        document.getElementById('btn-add-row')?.addEventListener('click', addDataRow);

        // Clear data button
        document.getElementById('btn-clear-data')?.addEventListener('click', clearAllData);

        // Load demo data button
        document.getElementById('btn-load-demo')?.addEventListener('click', loadDemoData);

        // Import buttons
        document.getElementById('btn-import-csv')?.addEventListener('click', () => {
            document.getElementById('file-input-csv').click();
        });

        document.getElementById('btn-import-excel')?.addEventListener('click', () => {
            document.getElementById('file-input-excel').click();
        });

        // File input handlers
        document.getElementById('file-input-csv')?.addEventListener('change', handleFileImport);
        document.getElementById('file-input-excel')?.addEventListener('change', handleFileImport);

        // Download template
        document.getElementById('btn-download-template')?.addEventListener('click', downloadTemplate);
    }

    function updateAnalysisTypeUI() {
        const progOptions = document.getElementById('prognostic-options');
        const predOptions = document.getElementById('prediction-options');

        if (state.analysisType === 'prognostic') {
            progOptions?.classList.remove('hidden');
            predOptions?.classList.add('hidden');
        } else {
            progOptions?.classList.add('hidden');
            predOptions?.classList.remove('hidden');
        }
    }

    function updateTableHeaders() {
        const headerRow = document.getElementById('table-header');
        if (!headerRow) return;

        const measure = state.analysisType === 'prognostic' ?
            state.effectMeasure : state.performanceMetric;
        const columns = DataHandler.getColumns(state.analysisType, measure);

        headerRow.innerHTML = columns.map(col =>
            `<th>${col.label}${col.required ? ' *' : ''}</th>`
        ).join('') + '<th>Actions</th>';

        // Update existing rows
        updateDataRows();
    }

    function updateDataRows() {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        const measure = state.analysisType === 'prognostic' ?
            state.effectMeasure : state.performanceMetric;
        const columns = DataHandler.getColumns(state.analysisType, measure);

        // Rebuild rows with new columns
        tbody.innerHTML = '';
        state.data.forEach((row, index) => {
            addDataRowWithData(row, index);
        });

        updateStudyCount();
    }

    function addDataRow() {
        const measure = state.analysisType === 'prognostic' ?
            state.effectMeasure : state.performanceMetric;
        const columns = DataHandler.getColumns(state.analysisType, measure);

        const rowData = {};
        columns.forEach(col => rowData[col.id] = '');

        state.data.push(rowData);
        addDataRowWithData(rowData, state.data.length - 1);
        updateStudyCount();
    }

    function addDataRowWithData(rowData, index) {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        const measure = state.analysisType === 'prognostic' ?
            state.effectMeasure : state.performanceMetric;
        const columns = DataHandler.getColumns(state.analysisType, measure);

        const tr = document.createElement('tr');
        tr.dataset.index = index;

        columns.forEach(col => {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = col.type === 'number' ? 'number' : 'text';
            input.step = 'any';
            input.value = rowData[col.id] || '';
            input.dataset.column = col.id;
            input.addEventListener('change', (e) => {
                state.data[index][col.id] = e.target.value;
                validateData();
            });
            td.appendChild(input);
            tr.appendChild(td);
        });

        // Actions column
        const actionTd = document.createElement('td');
        actionTd.className = 'row-actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete-row';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Delete row';
        deleteBtn.addEventListener('click', () => deleteDataRow(index));
        actionTd.appendChild(deleteBtn);
        tr.appendChild(actionTd);

        tbody.appendChild(tr);
    }

    function deleteDataRow(index) {
        state.data.splice(index, 1);
        updateDataRows();
    }

    function clearAllData() {
        if (confirm('Are you sure you want to clear all data?')) {
            state.data = [];
            updateDataRows();
            clearResults();
        }
    }

    // Demo datasets for main meta-analysis
    const mainDemoData = {
        prognostic_hr: {
            name: 'Prognostic Factors (HR) - Cancer Survival',
            type: 'prognostic',
            measure: 'HR',
            data: [
                { study: 'Smith 2018', effect: 1.52, lower: 1.21, upper: 1.91, n: 245 },
                { study: 'Johnson 2019', effect: 1.38, lower: 1.15, upper: 1.66, n: 312 },
                { study: 'Williams 2019', effect: 1.71, lower: 1.32, upper: 2.22, n: 178 },
                { study: 'Brown 2020', effect: 1.45, lower: 1.18, upper: 1.78, n: 289 },
                { study: 'Davis 2020', effect: 1.29, lower: 1.05, upper: 1.58, n: 421 },
                { study: 'Miller 2021', effect: 1.63, lower: 1.28, upper: 2.08, n: 156 },
                { study: 'Wilson 2021', effect: 1.55, lower: 1.22, upper: 1.97, n: 198 },
                { study: 'Taylor 2022', effect: 1.41, lower: 1.12, upper: 1.77, n: 267 }
            ]
        },
        prognostic_or: {
            name: 'Prognostic Factors (OR) - CVD Risk',
            type: 'prognostic',
            measure: 'OR',
            data: [
                { study: 'Adams 2017', effect: 2.15, lower: 1.65, upper: 2.80, n: 523 },
                { study: 'Baker 2018', effect: 1.89, lower: 1.45, upper: 2.46, n: 412 },
                { study: 'Clark 2019', effect: 2.32, lower: 1.72, upper: 3.13, n: 289 },
                { study: 'Evans 2019', effect: 1.95, lower: 1.48, upper: 2.57, n: 367 },
                { study: 'Foster 2020', effect: 2.08, lower: 1.58, upper: 2.74, n: 445 },
                { study: 'Garcia 2021', effect: 1.78, lower: 1.35, upper: 2.35, n: 312 }
            ]
        },
        prediction_cstat: {
            name: 'Prediction Models (C-statistic) - Diabetes',
            type: 'prediction',
            measure: 'cstat',
            data: [
                { study: 'Harris 2018', effect: 0.78, lower: 0.74, upper: 0.82, n: 1250 },
                { study: 'King 2019', effect: 0.82, lower: 0.78, upper: 0.86, n: 980 },
                { study: 'Lee 2019', effect: 0.76, lower: 0.71, upper: 0.81, n: 1456 },
                { study: 'Martin 2020', effect: 0.80, lower: 0.75, upper: 0.85, n: 1123 },
                { study: 'Nelson 2020', effect: 0.79, lower: 0.74, upper: 0.84, n: 867 },
                { study: 'Patel 2021', effect: 0.81, lower: 0.77, upper: 0.85, n: 1534 },
                { study: 'Quinn 2022', effect: 0.77, lower: 0.72, upper: 0.82, n: 1089 }
            ]
        }
    };

    function loadDemoData() {
        // Show demo selection dialog
        const selection = prompt(
            'Select demo dataset:\n\n1. prognostic_hr - Cancer Survival (Hazard Ratios)\n2. prognostic_or - CVD Risk (Odds Ratios)\n3. prediction_cstat - Diabetes Prediction (C-statistic)\n\nEnter choice (1, 2, or 3):',
            '1'
        );
        
        let datasetKey;
        if (selection === '1') datasetKey = 'prognostic_hr';
        else if (selection === '2') datasetKey = 'prognostic_or';
        else if (selection === '3') datasetKey = 'prediction_cstat';
        else {
            showMessage('Invalid selection', 'error');
            return;
        }
        
        const dataset = mainDemoData[datasetKey];
        if (!dataset) return;
        
        // Set analysis type and measure
        state.analysisType = dataset.type;
        state.effectMeasure = dataset.measure;
        state.performanceMetric = dataset.measure;
        
        // Update UI
        const radioBtn = document.querySelector('input[name="analysis-type"][value="' + dataset.type + '"]');
        if (radioBtn) radioBtn.checked = true;
        updateAnalysisTypeUI();
        
        if (dataset.type === 'prognostic') {
            const effectSelect = document.getElementById('effect-measure');
            if (effectSelect) effectSelect.value = dataset.measure;
        } else {
            const perfSelect = document.getElementById('performance-metric');
            if (perfSelect) perfSelect.value = dataset.measure;
        }
        
        // Load data - use the correct field names for the measure type
        state.data = dataset.data.map(d => {
            const row = { study: d.study, n: d.n, lower: d.lower, upper: d.upper };
            
            // Add the effect size field with the correct name
            if (dataset.measure === 'HR') row.hr = d.effect;
            else if (dataset.measure === 'OR') row.or = d.effect;
            else if (dataset.measure === 'RR') row.rr = d.effect;
            else if (dataset.measure === 'cstat') row.cstat = d.effect;
            else row.effect = d.effect;
            
            return row;
        });
        
        updateTableHeaders();
        updateDataRows();
        validateData();
        
        showMessage('Loaded ' + dataset.name + ' (' + dataset.data.length + ' studies)', 'success');
    }


    function updateStudyCount() {
        const countEl = document.getElementById('study-count');
        if (countEl) {
            countEl.textContent = state.data.length;
        }
    }

    async function handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showLoading('Importing data...');
            const data = await DataHandler.importFile(file);

            // Get expected columns
            const measure = state.analysisType === 'prognostic' ?
                state.effectMeasure : state.performanceMetric;
            const expectedColumns = DataHandler.getColumns(state.analysisType, measure);

            // Auto-map columns
            const importedColumns = Object.keys(data[0] || {});
            const mapping = DataHandler.autoMapColumns(importedColumns, expectedColumns);

            // Apply mapping
            state.data = DataHandler.applyMapping(data, mapping);

            updateDataRows();
            validateData();
            hideLoading();

            showMessage(`Imported ${state.data.length} studies`, 'success');
        } catch (error) {
            hideLoading();
            showMessage('Error importing file: ' + error.message, 'error');
        }

        e.target.value = '';  // Reset file input
    }

    function downloadTemplate() {
        const measure = state.analysisType === 'prognostic' ?
            state.effectMeasure : state.performanceMetric;
        const csv = DataHandler.generateTemplate(state.analysisType, measure, 'csv');

        DataHandler.downloadFile(csv, `template_${state.analysisType}_${measure}.csv`, 'text/csv');
    }

    function validateData() {
        const measure = state.analysisType === 'prognostic' ?
            state.effectMeasure : state.performanceMetric;
        const columns = DataHandler.getColumns(state.analysisType, measure);

        const result = DataHandler.validateData(state.data, columns);

        const panel = document.getElementById('validation-messages');
        if (!panel) return;

        panel.innerHTML = '';

        result.errors.forEach(err => {
            panel.innerHTML += `<div class="validation-message error">${escapeHtml(err)}</div>`;
        });

        result.warnings.forEach(warn => {
            panel.innerHTML += `<div class="validation-message warning">${escapeHtml(warn)}</div>`;
        });

        if (result.valid && result.warnings.length === 0) {
            panel.innerHTML = `<div class="validation-message success">Data valid - ${state.data.length} studies ready for analysis</div>`;
        }

        return result.valid;
    }

    // ============================================
    // Analysis Settings
    // ============================================

    function setupAnalysisSettings() {
        // Method cards
        document.querySelectorAll('.method-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                state.settings.method = card.dataset.method;
                updateMethodUI();
            });
        });

        // Tau² estimator
        document.getElementById('tau2-estimator')?.addEventListener('change', (e) => {
            state.settings.tau2Estimator = e.target.value;
        });

        // HKSJ adjustment
        document.getElementById('hksj-adjustment')?.addEventListener('change', (e) => {
            state.settings.hksjAdjustment = e.target.checked;
        });

        // Fixed effect method
        document.getElementById('fe-method')?.addEventListener('change', (e) => {
            state.settings.feMethod = e.target.value;
        });

        // Confidence level
        document.getElementById('conf-level')?.addEventListener('change', (e) => {
            state.settings.confLevel = parseInt(e.target.value);
        });

        // Prediction interval
        document.getElementById('show-prediction')?.addEventListener('change', (e) => {
            state.settings.showPrediction = e.target.checked;
        });

        // Transformation
        document.querySelectorAll('input[name="transform"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.settings.transform = e.target.value;
            });
        });

        // Run analysis button
        document.getElementById('btn-run-analysis')?.addEventListener('click', runAnalysis);
    }

    function updateMethodUI() {
        const reOptions = document.getElementById('re-options');
        const feOptions = document.getElementById('fe-options');
        const bayesOptions = document.getElementById('bayesian-options');

        reOptions?.classList.toggle('hidden', state.settings.method !== 'random');
        feOptions?.classList.toggle('hidden', state.settings.method !== 'fixed');
        bayesOptions?.classList.toggle('hidden', state.settings.method !== 'bayesian');
    }

    async function runAnalysis() {
        if (!validateData()) {
            showMessage('Please fix data validation errors before running analysis', 'error');
            return;
        }

        try {
            showLoading('Running meta-analysis...');

            const measure = state.analysisType === 'prognostic' ?
                state.effectMeasure : state.performanceMetric;

            // Calculate effect sizes
            state.processedData = DataHandler.calculateEffectSizes(
                state.data, state.analysisType, measure
            );

            const effects = state.processedData.map(d => d.effect);
            const variances = state.processedData.map(d => d.variance);

            // Run appropriate analysis
            if (state.settings.method === 'fixed') {
                state.results = MetaAnalysis.fixedEffectIV(effects, variances);
            } else if (state.settings.method === 'bayesian') {
                await runBayesianAnalysis(effects, variances);
            } else {
                // Random effects
                if (state.settings.hksjAdjustment) {
                    state.results = MetaAnalysis.randomEffectsHKSJ(
                        effects, variances, state.settings.tau2Estimator
                    );
                } else {
                    state.results = MetaAnalysis.randomEffects(
                        effects, variances, state.settings.tau2Estimator
                    );
                }
            }

            // Add study names to results
            state.results.studies = state.processedData.map(d => d.study);

            // Update results display
            updateResultsDisplay();

            // Generate forest plot
            generateForestPlot();

            hideLoading();
            switchTab('results');

            showMessage('Analysis complete!', 'success');

        } catch (error) {
            hideLoading();
            console.error('Analysis error:', error);
            showMessage('Error running analysis: ' + error.message, 'error');
        }
    }

    async function runBayesianAnalysis(effects, variances) {
        const bayesSettings = {
            iterations: parseInt(document.getElementById('mcmc-iterations')?.value) || 10000,
            burnin: parseInt(document.getElementById('mcmc-burnin')?.value) || 2000,
            thin: parseInt(document.getElementById('mcmc-thin')?.value) || 1,
            chains: parseInt(document.getElementById('mcmc-chains')?.value) || 4
        };

        if (typeof BayesianMA === 'undefined') {
            showMessage('Bayesian module not loaded', 'error');
            hideLoading();
            return;
        }
        state.bayesianResults = BayesianMA.bayesianMetaAnalysis(
            effects, variances, bayesSettings
        );

        // Convert to standard results format for display
        state.results = {
            effect: state.bayesianResults.mu.mean,
            se: state.bayesianResults.mu.sd,
            ci: state.bayesianResults.mu.ci95,
            tau2: state.bayesianResults.tau2.mean,
            tau: state.bayesianResults.tau.mean,
            predictionInterval: state.bayesianResults.predictive.ci95,
            method: 'Bayesian (MCMC)',
            bayesian: true
        };
    }

    // ============================================
    // Results Display
    // ============================================

    function updateResultsDisplay() {
        if (!state.results) return;

        const r = state.results;
        const measure = state.analysisType === 'prognostic' ?
            state.effectMeasure : state.performanceMetric;

        // Transform for display
        const isRatio = ['HR', 'OR', 'RR'].includes(measure);
        const isCstat = measure === 'cstat';

        const displayEffect = isRatio ? Math.exp(r.effect) :
                             isCstat ? 1 / (1 + Math.exp(-r.effect)) : r.effect;

        const displayCI = {
            lower: isRatio ? Math.exp(r.ci.lower) :
                   isCstat ? 1 / (1 + Math.exp(-r.ci.lower)) : r.ci.lower,
            upper: isRatio ? Math.exp(r.ci.upper) :
                   isCstat ? 1 / (1 + Math.exp(-r.ci.upper)) : r.ci.upper
        };

        // Update summary cards
        setText('result-effect', displayEffect.toFixed(isRatio ? 2 : 3));
        setText('result-effect-ci', `95% CI: [${displayCI.lower.toFixed(isRatio ? 2 : 3)}, ${displayCI.upper.toFixed(isRatio ? 2 : 3)}]`);
        setText('result-z', (r.zValue || r.tValue)?.toFixed(2) || '--');
        setText('result-p', `p ${r.pValue < 0.001 ? '< 0.001' : '= ' + r.pValue?.toFixed(3)}`);

        if (r.predictionInterval) {
            const piDisplay = {
                lower: isRatio ? Math.exp(r.predictionInterval.lower) :
                       isCstat ? 1 / (1 + Math.exp(-r.predictionInterval.lower)) : r.predictionInterval.lower,
                upper: isRatio ? Math.exp(r.predictionInterval.upper) :
                       isCstat ? 1 / (1 + Math.exp(-r.predictionInterval.upper)) : r.predictionInterval.upper
            };
            setText('result-pi', `[${piDisplay.lower.toFixed(isRatio ? 2 : 3)}, ${piDisplay.upper.toFixed(isRatio ? 2 : 3)}]`);
        }

        // Heterogeneity
        setText('result-tau2', r.tau2?.toFixed(4) || '--');
        setText('result-tau2-ci', r.tau2Lower !== undefined ?
            `95% CI: [${r.tau2Lower.toFixed(4)}, ${r.tau2Upper.toFixed(4)}]` : '');
        setText('result-tau', r.tau?.toFixed(4) || '--');
        setText('result-i2', r.I2?.toFixed(1) + '%' || '--');
        setText('result-i2-ci', r.I2Lower !== undefined ?
            `95% CI: [${r.I2Lower.toFixed(1)}%, ${r.I2Upper.toFixed(1)}%]` : '');
        setText('result-h2', r.H2?.toFixed(2) || '--');
        setText('result-q', r.Q?.toFixed(2) || '--');
        setText('result-q-p', `df = ${r.df || '--'}, p ${r.pHet !== undefined ? (r.pHet < 0.001 ? '< 0.001' : '= ' + r.pHet.toFixed(3)) : '--'}`);

        // Weights table
        updateWeightsTable();

        // Bayesian results
        if (r.bayesian) {
            document.getElementById('results-bayesian')?.classList.remove('hidden');
            updateBayesianResults();
        } else {
            document.getElementById('results-bayesian')?.classList.add('hidden');
        }
    }

    function updateWeightsTable() {
        const tbody = document.getElementById('weights-table-body');
        if (!tbody || !state.processedData) return;

        const measure = state.analysisType === 'prognostic' ?
            state.effectMeasure : state.performanceMetric;
        const isRatio = ['HR', 'OR', 'RR'].includes(measure);
        const isCstat = measure === 'cstat';

        tbody.innerHTML = state.processedData.map((study, i) => {
            const effect = isRatio ? Math.exp(study.effect) :
                          isCstat ? study.originalEffect : study.effect;
            const lower = isRatio ? Math.exp(study.effect - 1.96 * study.se) :
                         isCstat ? study.originalLower : study.effect - 1.96 * study.se;
            const upper = isRatio ? Math.exp(study.effect + 1.96 * study.se) :
                         isCstat ? study.originalUpper : study.effect + 1.96 * study.se;

            return `
                <tr>
                    <td>${escapeHtml(study.study)}</td>
                    <td>${effect.toFixed(isRatio ? 2 : 3)}</td>
                    <td>${study.se.toFixed(4)}</td>
                    <td>[${lower.toFixed(isRatio ? 2 : 3)}, ${upper.toFixed(isRatio ? 2 : 3)}]</td>
                    <td>${state.results.weights?.[i]?.toFixed(1) || '--'}%</td>
                </tr>
            `;
        }).join('');
    }

    function updateBayesianResults() {
        if (!state.bayesianResults) return;

        const br = state.bayesianResults;
        setText('result-bayes-mu', br.mu.mean.toFixed(4));
        setText('result-bayes-mu-cri', `95% CrI: [${br.mu.ci95.lower.toFixed(4)}, ${br.mu.ci95.upper.toFixed(4)}]`);
        setText('result-bayes-tau', br.tau.mean.toFixed(4));
        setText('result-bayes-tau-cri', `95% CrI: [${br.tau.ci95.lower.toFixed(4)}, ${br.tau.ci95.upper.toFixed(4)}]`);
        setText('result-rhat', Math.max(br.diagnostics.rhatMu, br.diagnostics.rhatTau).toFixed(3));
        setText('result-ess', Math.min(br.diagnostics.essMu, br.diagnostics.essTau).toFixed(0));
    }

    // ============================================
    // Visualization
    // ============================================

    function setupVisualization() {
        // Plot type selection
        document.querySelectorAll('.plot-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.plot-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updatePlotOptions(btn.dataset.plot);
                generatePlot(btn.dataset.plot);
            });
        });

        // Export buttons
        document.getElementById('btn-export-png')?.addEventListener('click', () => exportPlot('png'));
        document.getElementById('btn-export-svg')?.addEventListener('click', () => exportPlot('svg'));
        document.getElementById('btn-export-pdf')?.addEventListener('click', () => exportPlot('pdf'));

        // Plot options
        document.getElementById('forest-show-weights')?.addEventListener('change', () => generateForestPlot());
        document.getElementById('forest-show-pi')?.addEventListener('change', () => generateForestPlot());
        document.getElementById('forest-sort')?.addEventListener('change', () => generateForestPlot());
        document.getElementById('funnel-yaxis')?.addEventListener('change', () => generateFunnelPlot());
        document.getElementById('funnel-contour')?.addEventListener('change', () => generateFunnelPlot());
        document.getElementById('funnel-trimfill')?.addEventListener('change', () => generateFunnelPlot());
    }

    function updatePlotOptions(plotType) {
        document.querySelectorAll('.plot-options-group').forEach(g => g.classList.add('hidden'));
        document.getElementById(`${plotType}-options`)?.classList.remove('hidden');
    }

    function generatePlot(type) {
        switch (type) {
            case 'forest':
                generateForestPlot();
                break;
            case 'funnel':
                generateFunnelPlot();
                break;
            case 'sroc':
                generateSROCPlot();
                break;
            case 'bubble':
                generateBubblePlot();
                break;
            case 'labbe':
                generateLabbePlot();
                break;
            case 'radial':
                generateRadialPlot();
                break;
            case 'calibration':
                generateCalibrationPlot();
                break;
        }
    }

    function generateForestPlot() {
        if (!state.processedData.length || !state.results) return;

        const container = document.getElementById('plot-area');
        const measure = state.analysisType === 'prognostic' ?
            state.effectMeasure : state.performanceMetric;

        const plotData = state.processedData.map((study, i) => ({
            study: study.study,
            effect: study.effect,
            se: study.se,
            weight: state.results.weights?.[i]
        }));

        const options = {
            showWeights: document.getElementById('forest-show-weights')?.checked ?? true,
            showPI: document.getElementById('forest-show-pi')?.checked ?? true,
            sortByEffect: document.getElementById('forest-sort')?.checked ?? false,
            logScale: ['HR', 'OR', 'RR'].includes(measure),
            xLabel: getEffectLabel(measure),
            pooledResult: state.results,
            predictionInterval: state.results.predictionInterval
        };

        if (typeof Visualization === 'undefined' || !Visualization.forestPlot) {
            console.error('Visualization module not loaded');
            return;
        }
        Visualization.forestPlot(container, plotData, options);
    }

    function generateFunnelPlot() {
        if (!state.processedData.length || !state.results) return;

        const container = document.getElementById('plot-area');

        const plotData = state.processedData.map(study => ({
            effect: study.effect,
            se: study.se,
            variance: study.variance,
            n: study.n
        }));

        const options = {
            yAxisType: document.getElementById('funnel-yaxis')?.value || 'se',
            showContour: document.getElementById('funnel-contour')?.checked ?? false,
            showTrimFill: document.getElementById('funnel-trimfill')?.checked ?? false,
            pooledEffect: state.results.effect
        };

        if (options.showTrimFill && !state.biasTests?.trimFill) {
            // Run trim-fill
            const effects = state.processedData.map(d => d.effect);
            const variances = state.processedData.map(d => d.variance);
            state.biasTests = state.biasTests || {};
            state.biasTests.trimFill = MetaAnalysis.trimAndFill(effects, variances);
        }

        if (state.biasTests?.trimFill) {
            options.trimFillData = {
                adjustedEffect: state.biasTests.trimFill.adjustedEffect,
                imputed: []  // Would need to calculate imputed study positions
            };
        }

        Visualization.funnelPlot(container, plotData, options);
    }

    function generateSROCPlot() {
        if (!state.processedData.length) return;

        // SROC requires sensitivity/specificity data
        const srocData = state.processedData.filter(d => d.sensitivity !== undefined);

        if (srocData.length === 0) {
            showMessage('SROC plot requires sensitivity/specificity data', 'warning');
            return;
        }

        const container = document.getElementById('plot-area');
        Visualization.srocCurve(container, srocData);
    }

    function generateBubblePlot() {
        if (!state.processedData.length || !state.results) return;

        const container = document.getElementById('plot-area');

        const plotData = state.processedData.map((study, i) => ({
            ...study,
            weight: state.results.weights?.[i]
        }));

        Visualization.bubblePlot(container, plotData, {
            moderator: 'year',
            xLabel: 'Publication Year',
            regressionLine: state.metaRegression ? {
                intercept: state.metaRegression.intercept.estimate,
                slope: state.metaRegression.moderators[0]?.estimate || 0
            } : null
        });
    }

    function generateLabbePlot() {
        if (!state.processedData.length) return;

        const container = document.getElementById('plot-area');
        const labbeData = state.processedData.filter(d => d.a !== undefined);

        if (labbeData.length === 0) {
            showMessage("L'Abbé plot requires 2x2 table data", 'warning');
            return;
        }

        Visualization.labbePlot(container, labbeData);
    }

    function generateRadialPlot() {
        if (!state.processedData.length || !state.results) return;

        const container = document.getElementById('plot-area');
        Visualization.radialPlot(container, state.processedData, {
            pooledEffect: state.results.effect
        });
    }

    function generateCalibrationPlot() {
        const container = document.getElementById('plot-area');

        // Placeholder - would need actual calibration data
        Visualization.calibrationPlot(container, {
            deciles: [
                { predicted: 0.05, observed: 0.04 },
                { predicted: 0.15, observed: 0.18 },
                { predicted: 0.25, observed: 0.22 },
                { predicted: 0.35, observed: 0.38 },
                { predicted: 0.45, observed: 0.42 },
                { predicted: 0.55, observed: 0.58 },
                { predicted: 0.65, observed: 0.62 },
                { predicted: 0.75, observed: 0.78 },
                { predicted: 0.85, observed: 0.82 },
                { predicted: 0.95, observed: 0.92 }
            ]
        });
    }

    function exportPlot(format) {
        const plotArea = document.getElementById('plot-area');
        const svg = plotArea?.querySelector('svg');

        if (!svg) {
            showMessage('No plot to export', 'warning');
            return;
        }

        if (format === 'svg') {
            const svgString = Visualization.exportSVG(svg);
            DataHandler.downloadFile(svgString, 'plot.svg', 'image/svg+xml');
        } else if (format === 'png') {
            Visualization.exportPNG(svg, (dataUrl) => {
                const link = document.createElement('a');
                link.download = 'plot.png';
                link.href = dataUrl;
                link.click();
            });
        }
    }

    // ============================================
    // Publication Bias
    // ============================================

    function setupBiasTests() {
        document.getElementById('btn-run-bias')?.addEventListener('click', runBiasTests);
    }

    function runBiasTests() {
        if (!state.processedData.length || !state.results) {
            showMessage('Run meta-analysis first', 'warning');
            return;
        }

        showLoading('Running publication bias tests...');

        const effects = state.processedData.map(d => d.effect);
        const variances = state.processedData.map(d => d.variance);
        const ses = state.processedData.map(d => d.se);

        state.biasTests = {
            egger: MetaAnalysis.eggerTest(effects, ses),
            begg: MetaAnalysis.beggTest(effects, variances),
            trimFill: MetaAnalysis.trimAndFill(effects, variances)
        };

        // Peters test if binary data available
        if (state.processedData.some(d => d.a !== undefined)) {
            const a = state.processedData.map(d => d.a || 0);
            const b = state.processedData.map(d => d.b || 0);
            const c = state.processedData.map(d => d.c || 0);
            const d = state.processedData.map(d => d.d || 0);
            state.biasTests.peters = MetaAnalysis.petersTest(a, b, c, d);
        }

        // P-curve if p-values available (guard against se=0)
        const pValues = state.processedData
            .filter(d => d.se > 0)  // Exclude studies with zero SE
            .map(d => 2 * (1 - Statistics.pnorm(Math.abs(d.effect / d.se))))
            .filter(p => p < 0.05);

        if (pValues.length >= 3) {
            state.biasTests.pCurve = MetaAnalysis.pCurveAnalysis(pValues);
        }

        updateBiasDisplay();
        hideLoading();
    }

    function updateBiasDisplay() {
        const bt = state.biasTests;
        if (!bt) return;

        // Egger's test
        if (bt.egger) {
            setText('egger-intercept', bt.egger.intercept?.toFixed(3));
            setText('egger-se', bt.egger.se?.toFixed(3));
            setText('egger-t', bt.egger.tValue?.toFixed(2));
            setText('egger-p', bt.egger.pValue?.toFixed(3));
            setText('egger-interp', bt.egger.interpretation);
        }

        // Begg's test
        if (bt.begg) {
            setText('begg-tau', bt.begg.tau?.toFixed(3));
            setText('begg-z', bt.begg.z?.toFixed(2));
            setText('begg-p', bt.begg.pValue?.toFixed(3));
            setText('begg-interp', bt.begg.interpretation);
        }

        // Trim and fill
        if (bt.trimFill) {
            setText('tf-missing', bt.trimFill.k0);

            const measure = state.analysisType === 'prognostic' ?
                state.effectMeasure : state.performanceMetric;
            const isRatio = ['HR', 'OR', 'RR'].includes(measure);

            const adjEffect = isRatio ?
                Math.exp(bt.trimFill.adjustedEffect).toFixed(2) :
                bt.trimFill.adjustedEffect.toFixed(3);

            setText('tf-effect', adjEffect);
            const adjCI = bt.trimFill.adjustedCI;
            setText('tf-ci', adjCI ? `[${isRatio ?
                Math.exp(adjCI.lower).toFixed(2) :
                adjCI.lower.toFixed(3)
            }, ${isRatio ?
                Math.exp(adjCI.upper).toFixed(2) :
                adjCI.upper.toFixed(3)
            }]` : '--');
            setText('tf-interp', bt.trimFill.interpretation);
        }

        // P-curve
        if (bt.pCurve) {
            setText('pcurve-right', `z = ${bt.pCurve.rightSkewZ?.toFixed(2)}, p = ${bt.pCurve.rightSkewP?.toFixed(3)}`);
            setText('pcurve-flat', `z = ${bt.pCurve.flatnessZ?.toFixed(2)}, p = ${bt.pCurve.flatnessP?.toFixed(3)}`);
            setText('pcurve-interp', bt.pCurve.interpretation);

            // Draw p-curve plot (guard against se=0)
            Visualization.pCurvePlot(
                document.getElementById('pcurve-plot'),
                state.processedData
                    .filter(d => d.se > 0)
                    .map(d => 2 * (1 - Statistics.pnorm(Math.abs(d.effect / d.se))))
            );
        }
    }

    // ============================================
    // Advanced Analysis
    // ============================================

    function setupAdvancedAnalysis() {
        document.getElementById('btn-run-subgroup')?.addEventListener('click', runSubgroupAnalysis);
        document.getElementById('btn-run-metareg')?.addEventListener('click', runMetaRegression);
        document.getElementById('btn-leave-one-out')?.addEventListener('click', runLeaveOneOut);
        document.getElementById('btn-cumulative')?.addEventListener('click', runCumulative);
        document.getElementById('btn-influence')?.addEventListener('click', runInfluence);
    }

    function runSubgroupAnalysis() {
        if (!state.processedData.length) return;

        const subgroupVar = document.getElementById('subgroup-var')?.value;
        if (!subgroupVar) {
            showMessage('Select a subgroup variable', 'warning');
            return;
        }

        const groups = state.processedData.map(d => d[subgroupVar] || 'Unknown');
        const effects = state.processedData.map(d => d.effect);
        const variances = state.processedData.map(d => d.variance);

        state.subgroups = MetaAnalysis.subgroupAnalysis(effects, variances, groups);

        updateSubgroupDisplay();
    }

    function updateSubgroupDisplay() {
        const container = document.getElementById('subgroup-results');
        const tbody = document.querySelector('#subgroup-table tbody');

        if (!container || !tbody || !state.subgroups) return;

        container.classList.remove('hidden');

        const measure = state.analysisType === 'prognostic' ?
            state.effectMeasure : state.performanceMetric;
        const isRatio = ['HR', 'OR', 'RR'].includes(measure);

        tbody.innerHTML = state.subgroups.subgroups.map(sub => `
            <tr>
                <td>${escapeHtml(sub.group)}</td>
                <td>${sub.k}</td>
                <td>${isRatio ? Math.exp(sub.effect).toFixed(2) : sub.effect.toFixed(3)}</td>
                <td>[${isRatio ? Math.exp(sub.ci.lower).toFixed(2) : sub.ci.lower.toFixed(3)},
                    ${isRatio ? Math.exp(sub.ci.upper).toFixed(2) : sub.ci.upper.toFixed(3)}]</td>
                <td>${sub.I2?.toFixed(1) ?? '--'}%</td>
                <td>${sub.pValue !== undefined ? (sub.pValue < 0.001 ? '<0.001' : sub.pValue.toFixed(3)) : '--'}</td>
            </tr>
        `).join('');

        setText('subgroup-q', state.subgroups.QBetween?.toFixed(2));
        setText('subgroup-df', state.subgroups.dfBetween);
        setText('subgroup-p', state.subgroups.pBetween?.toFixed(3));
    }

    function runMetaRegression() {
        if (!state.processedData.length) return;

        const modVars = Array.from(document.getElementById('metareg-vars')?.selectedOptions || [])
            .map(opt => opt.value);

        if (modVars.length === 0) {
            showMessage('Select at least one moderator variable', 'warning');
            return;
        }

        const effects = state.processedData.map(d => d.effect);
        const variances = state.processedData.map(d => d.variance);
        const moderators = state.processedData.map(d =>
            modVars.map(v => parseFloat(d[v]) || 0)
        );

        const method = document.getElementById('metareg-method')?.value || 'REML';
        const knha = document.getElementById('metareg-knha')?.checked || false;

        state.metaRegression = MetaAnalysis.metaRegression(
            effects, variances, moderators, method, knha
        );

        if (state.metaRegression.error) {
            showMessage(state.metaRegression.error, 'error');
            return;
        }

        updateMetaRegDisplay();
    }

    function updateMetaRegDisplay() {
        const container = document.getElementById('metareg-results');
        const tbody = document.querySelector('#metareg-table tbody');

        if (!container || !tbody || !state.metaRegression) return;

        container.classList.remove('hidden');

        const mr = state.metaRegression;

        tbody.innerHTML = mr.coefficients.map((coef, i) => `
            <tr>
                <td>${i === 0 ? 'Intercept' : `Moderator ${i}`}</td>
                <td>${coef.estimate.toFixed(4)}</td>
                <td>${coef.se.toFixed(4)}</td>
                <td>[${coef.ci?.lower?.toFixed(4) ?? '--'}, ${coef.ci?.upper?.toFixed(4) ?? '--'}]</td>
                <td>${coef.statistic.toFixed(2)}</td>
                <td>${coef.pValue < 0.001 ? '<0.001' : coef.pValue.toFixed(3)}</td>
            </tr>
        `).join('');

        setText('metareg-tau2', mr.tau2?.toFixed(4) ?? '--');
        setText('metareg-i2', (mr.I2Residual?.toFixed(1) ?? '--') + '%');
        setText('metareg-r2', (mr.R2 !== undefined ? (mr.R2 * 100).toFixed(1) : '--') + '%');
        setText('metareg-qm', mr.QM?.toFixed(2) ?? '--');
        setText('metareg-qm-df', mr.dfM ?? '--');
        setText('metareg-qm-p', mr.pQM !== undefined ? (mr.pQM < 0.001 ? '<0.001' : mr.pQM.toFixed(3)) : '--');
    }

    function runLeaveOneOut() {
        if (!state.processedData.length) return;

        const effects = state.processedData.map(d => d.effect);
        const variances = state.processedData.map(d => d.variance);
        const names = state.processedData.map(d => d.study);

        state.sensitivity = MetaAnalysis.leaveOneOut(effects, variances, names);

        updateSensitivityDisplay('loo');
    }

    function runCumulative() {
        if (!state.processedData.length) return;

        const effects = state.processedData.map(d => d.effect);
        const variances = state.processedData.map(d => d.variance);
        const names = state.processedData.map(d => d.study);

        state.sensitivity = {
            results: MetaAnalysis.cumulativeMetaAnalysis(effects, variances, names),
            type: 'cumulative'
        };

        updateSensitivityDisplay('cumulative');
    }

    function runInfluence() {
        if (!state.processedData.length) return;

        const effects = state.processedData.map(d => d.effect);
        const variances = state.processedData.map(d => d.variance);

        state.sensitivity = MetaAnalysis.influenceDiagnostics(effects, variances);
        state.sensitivity.type = 'influence';

        updateSensitivityDisplay('influence');
    }

    function updateSensitivityDisplay(type) {
        const container = document.getElementById('sensitivity-results');
        const thead = document.querySelector('#sensitivity-table thead');
        const tbody = document.querySelector('#sensitivity-table tbody');

        if (!container || !thead || !tbody || !state.sensitivity) return;

        container.classList.remove('hidden');

        const measure = state.analysisType === 'prognostic' ?
            state.effectMeasure : state.performanceMetric;
        const isRatio = ['HR', 'OR', 'RR'].includes(measure);

        if (type === 'loo') {
            thead.innerHTML = '<tr><th>Excluded</th><th>Effect</th><th>95% CI</th><th>I²</th></tr>';
            tbody.innerHTML = (state.sensitivity?.results || []).map(row => `
                <tr>
                    <td>${escapeHtml(row.excluded)}</td>
                    <td>${isRatio ? Math.exp(row.effect).toFixed(2) : row.effect.toFixed(3)}</td>
                    <td>[${isRatio ? Math.exp(row.ci.lower).toFixed(2) : row.ci.lower.toFixed(3)},
                        ${isRatio ? Math.exp(row.ci.upper).toFixed(2) : row.ci.upper.toFixed(3)}]</td>
                    <td>${row.I2?.toFixed(1) ?? '--'}%</td>
                </tr>
            `).join('');
        } else if (type === 'influence') {
            thead.innerHTML = '<tr><th>Study</th><th>Weight</th><th>Std. Resid</th><th>Cook\'s D</th><th>Influential</th></tr>';
            tbody.innerHTML = (state.sensitivity?.diagnostics || []).map(row => `
                <tr>
                    <td>Study ${row?.study ?? 'N/A'}</td>
                    <td>${(row?.weight ?? 0).toFixed(1)}%</td>
                    <td>${(row?.standardizedResidual ?? 0).toFixed(2)}</td>
                    <td>${(row?.cooksD ?? 0).toFixed(4)}</td>
                    <td>${row?.influential ? 'Yes' : 'No'}</td>
                </tr>
            `).join('');
        }
    }

    // ============================================
    // Export Functions
    // ============================================

    function setupExport() {
        document.getElementById('btn-export-results-csv')?.addEventListener('click', exportResultsCSV);
        document.getElementById('btn-export-results-excel')?.addEventListener('click', exportResultsExcel);
        document.getElementById('btn-report-html')?.addEventListener('click', generateHTMLReport);
        document.getElementById('btn-report-pdf')?.addEventListener('click', generatePDFReport);
        document.getElementById('btn-code-r')?.addEventListener('click', () => generateCode('r'));
        document.getElementById('btn-code-stata')?.addEventListener('click', () => generateCode('stata'));
        document.getElementById('btn-code-python')?.addEventListener('click', () => generateCode('python'));
        document.getElementById('btn-copy-code')?.addEventListener('click', copyCode);
    }

    function exportResultsCSV() {
        if (!state.results) return;
        if (typeof Export === 'undefined') {
            showMessage('Export module not loaded', 'error');
            return;
        }

        const csv = Export.exportResultsCSV(state.results, state.processedData, {
            analysisType: state.analysisType,
            effectMeasure: state.analysisType === 'prognostic' ? state.effectMeasure : state.performanceMetric
        });

        DataHandler.downloadFile(csv, 'meta_analysis_results.csv', 'text/csv');
    }

    function exportResultsExcel() {
        // Similar to CSV but using XLSX
        showMessage('Excel export coming soon', 'info');
    }

    function generateHTMLReport() {
        if (!state.results) {
            showMessage('Run analysis first', 'warning');
            return;
        }

        const analysisData = {
            data: state.processedData,
            results: state.results,
            settings: {
                analysisType: state.analysisType,
                effectMeasure: state.analysisType === 'prognostic' ? state.effectMeasure : state.performanceMetric,
                ...state.settings
            },
            biasTests: state.biasTests,
            subgroups: state.subgroups,
            metaRegression: state.metaRegression,
            sensitivity: state.sensitivity
        };

        const html = Export.generateHTMLReport(analysisData, {
            includeSummary: document.getElementById('report-summary')?.checked,
            includeForest: document.getElementById('report-forest')?.checked,
            includeHeterogeneity: document.getElementById('report-heterogeneity')?.checked,
            includeFunnel: document.getElementById('report-funnel')?.checked,
            includeBias: document.getElementById('report-bias')?.checked,
            includeSubgroup: document.getElementById('report-subgroup')?.checked,
            includeMetareg: document.getElementById('report-metareg')?.checked,
            includeSensitivity: document.getElementById('report-sensitivity')?.checked
        });

        DataHandler.downloadFile(html, 'meta_analysis_report.html', 'text/html');
    }

    function generatePDFReport() {
        showMessage('PDF export requires additional processing', 'info');
        // Would use jsPDF with html2canvas
    }

    function generateCode(language) {
        if (!state.results) {
            showMessage('Run analysis first', 'warning');
            return;
        }

        const settings = {
            analysisType: state.analysisType,
            effectMeasure: state.analysisType === 'prognostic' ? state.effectMeasure : state.performanceMetric,
            tau2Method: state.settings.tau2Estimator,
            hksjAdjustment: state.settings.hksjAdjustment
        };

        let code;
        switch (language) {
            case 'r':
                code = Export.generateRCode(state.processedData, settings, state.results);
                break;
            case 'stata':
                code = Export.generateStataCode(state.processedData, settings);
                break;
            case 'python':
                code = Export.generatePythonCode(state.processedData, settings);
                break;
        }

        const codeOutput = document.getElementById('code-output');
        const codeEl = document.getElementById('generated-code');

        if (codeOutput && codeEl) {
            codeOutput.classList.remove('hidden');
            codeEl.textContent = code;
        }
    }

    function copyCode() {
        const codeEl = document.getElementById('generated-code');
        if (codeEl) {
            navigator.clipboard.writeText(codeEl.textContent)
                .then(() => showMessage('Code copied to clipboard', 'success'))
                .catch(() => showMessage('Failed to copy code', 'error'));
        }
    }

    // ============================================
    // Project Management
    // ============================================

    function setupProjectManagement() {
        document.getElementById('btn-new-project')?.addEventListener('click', newProject);
        document.getElementById('btn-load-project')?.addEventListener('click', () => {
            document.getElementById('file-input-project')?.click();
        });
        document.getElementById('btn-save-project')?.addEventListener('click', saveProject);

        document.getElementById('file-input-project')?.addEventListener('change', loadProject);
    }

    function newProject() {
        if (confirm('Start a new project? This will clear all current data.')) {
            state.data = [];
            state.processedData = [];
            state.results = null;
            state.biasTests = null;
            state.subgroups = null;
            state.metaRegression = null;
            state.sensitivity = null;
            state.bayesianResults = null;

            updateDataRows();
            clearResults();
            switchTab('data');
        }
    }

    function saveProject() {
        const projectData = DataHandler.saveProject({
            analysisType: state.analysisType,
            effectMeasure: state.analysisType === 'prognostic' ? state.effectMeasure : state.performanceMetric,
            data: state.data,
            settings: state.settings,
            results: state.results
        });

        DataHandler.downloadFile(projectData, 'prognosismeta_project.json', 'application/json');
    }

    async function loadProject(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const project = DataHandler.loadProject(text);

            state.analysisType = project.analysisType;
            state.effectMeasure = project.effectMeasure;
            state.performanceMetric = project.effectMeasure;
            state.data = project.data;
            state.settings = project.settings;
            state.results = project.results;

            // Update UI
            const allowedTypes = ['prognostic', 'prediction'];
            if (allowedTypes.includes(state.analysisType)) {
                const radioBtn = document.querySelector(`input[name="analysis-type"][value="${state.analysisType}"]`);
                if (radioBtn) radioBtn.checked = true;
            }
            updateAnalysisTypeUI();
            updateTableHeaders();
            updateDataRows();

            if (state.results) {
                updateResultsDisplay();
            }

            showMessage('Project loaded successfully', 'success');
        } catch (error) {
            showMessage('Error loading project: ' + error.message, 'error');
        }

        e.target.value = '';
    }

    // ============================================
    // Utility Functions
    // ============================================

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text || '--';
    }

    function showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const msg = document.getElementById('loading-message');
        if (overlay) overlay.classList.remove('hidden');
        if (msg) msg.textContent = message;
    }

    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    function showMessage(message, type = 'info') {
        // Could use a toast notification system
        console.log(`[${type.toUpperCase()}] ${message}`);

        const panel = document.getElementById('validation-messages');
        if (panel) {
            const div = document.createElement('div');
            div.className = `validation-message ${type}`;
            div.textContent = message;
            panel.insertBefore(div, panel.firstChild);

            setTimeout(() => div.remove(), 5000);
        }
    }

    function clearResults() {
        setText('result-effect', '--');
        setText('result-effect-ci', '95% CI: [-- , --]');
        setText('result-z', '--');
        setText('result-p', 'p = --');
        setText('result-pi', '--');
        setText('result-tau2', '--');
        setText('result-tau', '--');
        setText('result-i2', '--');
        setText('result-h2', '--');
        setText('result-q', '--');

        const tbody = document.getElementById('weights-table-body');
        if (tbody) tbody.innerHTML = '';

        const plotArea = document.getElementById('plot-area');
        if (plotArea) plotArea.innerHTML = '';
    }

    function getEffectLabel(measure) {
        const labels = {
            'HR': 'Hazard Ratio',
            'OR': 'Odds Ratio',
            'RR': 'Risk Ratio',
            'beta': 'Coefficient',
            'cstat': 'C-statistic',
            'oe-ratio': 'O:E Ratio',
            'cal-slope': 'Calibration Slope',
            'cal-intercept': 'Calibration Intercept',
            'brier': 'Brier Score'
        };
        return labels[measure] || 'Effect Size';
    }

    // ============================================
    // Dose-Response Meta-Analysis
    // ============================================

    // Demo datasets
    const drDemoData = {
        coffee: {
            name: 'Coffee & Mortality',
            xLabel: 'Coffee (cups/day)',
            yLabel: 'Log Relative Risk',
            data: [
                { study: 'Freedman 2012', dose: 0, yi: 0, vi: 0, n: 52089, cases: 5034 },
                { study: 'Freedman 2012', dose: 1, yi: -0.06, vi: 0.0012, n: 78412, cases: 7102 },
                { study: 'Freedman 2012', dose: 2, yi: -0.10, vi: 0.0010, n: 98765, cases: 8234 },
                { study: 'Freedman 2012', dose: 4, yi: -0.12, vi: 0.0015, n: 45678, cases: 3567 },
                { study: 'Freedman 2012', dose: 6, yi: -0.10, vi: 0.0025, n: 23456, cases: 1890 },
                { study: 'Loftfield 2015', dose: 0, yi: 0, vi: 0, n: 34567, cases: 2345 },
                { study: 'Loftfield 2015', dose: 1, yi: -0.08, vi: 0.0018, n: 45678, cases: 2890 },
                { study: 'Loftfield 2015', dose: 3, yi: -0.15, vi: 0.0014, n: 56789, cases: 3123 },
                { study: 'Loftfield 2015', dose: 5, yi: -0.12, vi: 0.0022, n: 34567, cases: 1987 },
                { study: 'Gunter 2017', dose: 0, yi: 0, vi: 0, n: 67890, cases: 4567 },
                { study: 'Gunter 2017', dose: 2, yi: -0.09, vi: 0.0011, n: 89012, cases: 5678 },
                { study: 'Gunter 2017', dose: 4, yi: -0.14, vi: 0.0016, n: 56789, cases: 3456 },
                { study: 'Poole 2017', dose: 0, yi: 0, vi: 0, n: 45678, cases: 3234 },
                { study: 'Poole 2017', dose: 1.5, yi: -0.07, vi: 0.0015, n: 56789, cases: 3890 },
                { study: 'Poole 2017', dose: 3.5, yi: -0.13, vi: 0.0013, n: 67890, cases: 4123 },
                { study: 'Poole 2017', dose: 5.5, yi: -0.09, vi: 0.0020, n: 34567, cases: 2345 }
            ]
        },
        alcohol: {
            name: 'Alcohol & CVD',
            xLabel: 'Alcohol (g/day)',
            yLabel: 'Log Relative Risk',
            data: [
                { study: 'Di Castelnuovo 2006', dose: 0, yi: 0, vi: 0, n: 123456, cases: 8765 },
                { study: 'Di Castelnuovo 2006', dose: 5, yi: -0.15, vi: 0.0020, n: 98765, cases: 5678 },
                { study: 'Di Castelnuovo 2006', dose: 15, yi: -0.20, vi: 0.0018, n: 87654, cases: 4567 },
                { study: 'Di Castelnuovo 2006', dose: 30, yi: -0.12, vi: 0.0025, n: 56789, cases: 3456 },
                { study: 'Di Castelnuovo 2006', dose: 50, yi: 0.08, vi: 0.0035, n: 34567, cases: 2890 },
                { study: 'Ronksley 2011', dose: 0, yi: 0, vi: 0, n: 89012, cases: 6543 },
                { study: 'Ronksley 2011', dose: 10, yi: -0.18, vi: 0.0022, n: 78901, cases: 5234 },
                { study: 'Ronksley 2011', dose: 25, yi: -0.14, vi: 0.0024, n: 56789, cases: 3890 },
                { study: 'Ronksley 2011', dose: 45, yi: 0.05, vi: 0.0040, n: 34567, cases: 2678 },
                { study: 'Wood 2018', dose: 0, yi: 0, vi: 0, n: 234567, cases: 15678 },
                { study: 'Wood 2018', dose: 5, yi: -0.10, vi: 0.0012, n: 198765, cases: 12345 },
                { study: 'Wood 2018', dose: 15, yi: -0.08, vi: 0.0010, n: 167890, cases: 10234 },
                { study: 'Wood 2018', dose: 35, yi: 0.12, vi: 0.0015, n: 98765, cases: 7890 },
                { study: 'Wood 2018', dose: 60, yi: 0.35, vi: 0.0030, n: 45678, cases: 4567 }
            ]
        },
        activity: {
            name: 'Physical Activity & Depression',
            xLabel: 'Activity (min/week)',
            yLabel: 'Log Relative Risk',
            data: [
                { study: 'Schuch 2016', dose: 0, yi: 0, vi: 0, n: 12345, cases: 890 },
                { study: 'Schuch 2016', dose: 150, yi: -0.25, vi: 0.0030, n: 15678, cases: 567 },
                { study: 'Schuch 2016', dose: 300, yi: -0.32, vi: 0.0035, n: 13456, cases: 423 },
                { study: 'Schuch 2016', dose: 600, yi: -0.35, vi: 0.0045, n: 8901, cases: 267 },
                { study: 'Pearce 2022', dose: 0, yi: 0, vi: 0, n: 23456, cases: 1567 },
                { study: 'Pearce 2022', dose: 75, yi: -0.12, vi: 0.0025, n: 28901, cases: 1890 },
                { study: 'Pearce 2022', dose: 200, yi: -0.28, vi: 0.0028, n: 25678, cases: 1234 },
                { study: 'Pearce 2022', dose: 450, yi: -0.30, vi: 0.0038, n: 18901, cases: 890 },
                { study: 'Singh 2023', dose: 0, yi: 0, vi: 0, n: 34567, cases: 2345 },
                { study: 'Singh 2023', dose: 100, yi: -0.18, vi: 0.0022, n: 38901, cases: 2123 },
                { study: 'Singh 2023', dose: 250, yi: -0.30, vi: 0.0026, n: 32456, cases: 1678 },
                { study: 'Singh 2023', dose: 500, yi: -0.33, vi: 0.0035, n: 23456, cases: 1123 }
            ]
        },
        bmi: {
            name: 'BMI & Diabetes',
            xLabel: 'BMI (kg/m²)',
            yLabel: 'Log Relative Risk',
            data: [
                { study: 'Aune 2015', dose: 22, yi: 0, vi: 0, n: 45678, cases: 890 },
                { study: 'Aune 2015', dose: 25, yi: 0.35, vi: 0.0015, n: 56789, cases: 1567 },
                { study: 'Aune 2015', dose: 28, yi: 0.75, vi: 0.0018, n: 43210, cases: 2345 },
                { study: 'Aune 2015', dose: 32, yi: 1.20, vi: 0.0025, n: 32109, cases: 3456 },
                { study: 'Aune 2015', dose: 36, yi: 1.55, vi: 0.0035, n: 21098, cases: 3890 },
                { study: 'Kodama 2014', dose: 22, yi: 0, vi: 0, n: 34567, cases: 678 },
                { study: 'Kodama 2014', dose: 24, yi: 0.22, vi: 0.0012, n: 45678, cases: 1234 },
                { study: 'Kodama 2014', dose: 27, yi: 0.58, vi: 0.0016, n: 38901, cases: 1890 },
                { study: 'Kodama 2014', dose: 30, yi: 0.95, vi: 0.0022, n: 28765, cases: 2345 },
                { study: 'Kodama 2014', dose: 35, yi: 1.45, vi: 0.0032, n: 18901, cases: 2890 }
            ]
        }
    };

    let drState = {
        data: null,
        currentDataset: null,
        result: null,
        xLabel: 'Dose',
        yLabel: 'Effect'
    };

    function setupDoseResponse() {
        // Demo card selection
        document.querySelectorAll('.demo-card').forEach(card => {
            card.addEventListener('click', () => {
                const demo = card.dataset.demo;
                if (drDemoData[demo]) {
                    loadDRDemoData(demo);
                    // Highlight selected card
                    document.querySelectorAll('.demo-card').forEach(c => {
                        c.style.borderColor = '#e2e8f0';
                        c.style.background = '#f8fafc';
                    });
                    card.style.borderColor = '#2563eb';
                    card.style.background = '#eff6ff';
                    // Auto-run analysis
                    setTimeout(() => runDRAnalysis(), 100);
                }
            });
        });

        // Button handlers
        document.getElementById('btn-dr-load-demo')?.addEventListener('click', () => {
            loadDRDemoData('coffee'); // Default to coffee
            const card = document.querySelector('.demo-card[data-demo="coffee"]');
            if (card) {
                card.style.borderColor = '#2563eb';
                card.style.background = '#eff6ff';
            }
            // Auto-run analysis after loading
            setTimeout(() => runDRAnalysis(), 100);
        });

        document.getElementById('btn-dr-clear')?.addEventListener('click', clearDRData);
        document.getElementById('btn-dr-run')?.addEventListener('click', runDRAnalysis);
        document.getElementById('btn-dr-compare')?.addEventListener('click', runDRComparison);
        document.getElementById('btn-dr-bayesian')?.addEventListener('click', runDRBayesian);
        document.getElementById('btn-dr-bmd')?.addEventListener('click', runBMDAnalysis);
        document.getElementById('btn-dr-optimal')?.addEventListener('click', runOptimalDoseAnalysis);
        document.getElementById('btn-dr-cv')?.addEventListener('click', runCrossValidation);

        // Plot option handlers
        ['dr-show-ci', 'dr-show-points', 'dr-show-rug'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                if (drState.result) updateDRPlot();
            });
        });
    }

    function loadDRDemoData(datasetKey) {
        const dataset = drDemoData[datasetKey];
        if (!dataset) return;

        drState.data = dataset.data;
        drState.currentDataset = datasetKey;
        drState.xLabel = dataset.xLabel;
        drState.yLabel = dataset.yLabel;

        // Update table
        const tbody = document.getElementById('dr-table-body');
        if (tbody) {
            tbody.innerHTML = dataset.data.map(d => `
                <tr>
                    <td>${escapeHtml(d.study)}</td>
                    <td>${d.dose.toFixed(2)}</td>
                    <td>${d.yi.toFixed(4)}</td>
                    <td>${d.vi.toFixed(4)}</td>
                    <td>${d.n.toLocaleString()}</td>
                    <td>${d.cases.toLocaleString()}</td>
                </tr>
            `).join('');
        }

        showMessage(`Loaded ${dataset.name} dataset (${dataset.data.length} data points)`, 'success');
    }

    function clearDRData() {
        drState.data = null;
        drState.result = null;
        drState.currentDataset = null;

        const tbody = document.getElementById('dr-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b;">Click a demo dataset above or load your own data</td></tr>';
        }

        const drResults = document.getElementById('dr-results');
        if (drResults) drResults.style.display = 'none';
        const drComparison = document.getElementById('dr-comparison-results');
        if (drComparison) drComparison.style.display = 'none';

        const plotContainer = document.getElementById('dr-plot-container');
        if (plotContainer) {
            plotContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 450px; color: #64748b;">Run an analysis to see the dose-response curve</div>';
        }

        // Reset card highlighting
        document.querySelectorAll('.demo-card').forEach(c => {
            c.style.borderColor = '#e2e8f0';
            c.style.background = '#f8fafc';
        });
    }

    function runDRAnalysis() {
        if (!drState.data || drState.data.length === 0) {
            showMessage('Please load data first', 'error');
            return;
        }

        if (!AdvancedMethods || !AdvancedMethods.doseResponseMA) {
            showMessage('Dose-response module not loaded', 'error');
            return;
        }

        const modelType = document.getElementById('dr-model-type')?.value || 'spline';
        const tauEstimator = document.getElementById('dr-tau-estimator')?.value || 'REML';
        const knots = parseInt(document.getElementById('dr-knots')?.value || '3');
        const referenceIntake = parseFloat(document.getElementById('dr-reference-dose')?.value || '0');

        // Advanced options
        const useOneStage = document.getElementById('dr-one-stage')?.checked || false;
        const useDecorrelatedQ = document.getElementById('dr-decorrelated-q')?.checked || false;
        const includeInfluence = document.getElementById('dr-influence')?.checked || false;

        try {
            let result;

            // Handle special model types
            if (modelType === 'fp-optimal') {
                // Fractional polynomial with optimal power search
                result = AdvancedMethods.fractionalPolynomialDR(drState.data, {
                    degree: 2,
                    method: tauEstimator
                });
                result.model = 'fp-optimal';
            } else if (modelType === 'spike-at-zero') {
                // Spike-at-zero threshold model
                result = AdvancedMethods.spikeAtZeroDR(drState.data, 'linear', {
                    method: tauEstimator
                });
                result.model = 'spike-at-zero';
            } else if (modelType === 'model-averaging') {
                // Model averaging with Akaike weights
                result = AdvancedMethods.modelAveragingDR(drState.data,
                    ['linear', 'quadratic', 'spline', 'emax'], {
                    method: tauEstimator,
                    knots: knots
                });
                result.model = 'model-averaging';
            } else if (useOneStage) {
                // One-stage pooling approach
                result = AdvancedMethods.oneStageDoesResponse(drState.data, {
                    model: modelType,
                    knots: knots
                });
            } else {
                // Standard two-stage approach
                const options = {
                    model: modelType,
                    method: tauEstimator,
                    knots: knots,
                    referenceIntake: referenceIntake,
                    includeNonlinearityTest: true,
                    includePredictionInterval: true
                };
                result = AdvancedMethods.doseResponseMA(drState.data, options);
            }

            // Add decorrelated Q-test if requested
            if (useDecorrelatedQ && result && AdvancedMethods.decorrelatedQTest) {
                const qTest = AdvancedMethods.decorrelatedQTest(drState.data, result, modelType);
                result.decorrelatedQ = qTest;
            }

            // Add influence diagnostics if requested
            if (includeInfluence && result && AdvancedMethods.calculateLeaveOneOut) {
                const influence = AdvancedMethods.calculateLeaveOneOut(drState.data, modelType, tauEstimator, knots);
                result.influence = influence;
            }

            drState.result = result;
            if (result) {
                displayDRResults(result);
                updateDRPlot();
                showMessage('Dose-response analysis complete', 'success');
            } else {
                showMessage('Analysis returned no results', 'warning');
            }
        } catch (e) {
            showMessage('Analysis error: ' + (e?.message || String(e)), 'error');
            console.error(e);
        }
    }

    function displayDRResults(result) {
        const summaryDiv = document.getElementById('dr-results-summary');
        const coefDiv = document.getElementById('dr-coefficients');
        const resultsSection = document.getElementById('dr-results');

        if (!summaryDiv || !coefDiv || !resultsSection) return;

        // Format model name
        const modelNames = {
            'linear': 'Linear',
            'quadratic': 'Quadratic',
            'spline': 'Restricted Cubic Spline',
            'loglinear': 'Log-Linear',
            'piecewise': 'Piecewise Linear',
            'emax': 'Emax',
            'fp1': 'Fractional Polynomial (1)',
            'fp2': 'Fractional Polynomial (2)',
            'fp-optimal': 'FP Optimal (grid search)',
            'spike-at-zero': 'Spike-at-Zero (threshold)',
            'model-averaging': 'Model Averaging (AIC weights)'
        };
        const modelName = modelNames[result?.model] || result?.model || 'Unknown';

        // Summary cards with enhanced statistics
        summaryDiv.innerHTML = `
            <div class="result-card" style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                <span style="font-size: 0.85rem; color: #64748b;">Model</span>
                <span style="font-size: 1.1rem; font-weight: 600;">${modelName}</span>
                <span style="font-size: 0.75rem; color: #94a3b8;">${result?.method || 'REML'}</span>
            </div>
            <div class="result-card" style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                <span style="font-size: 0.85rem; color: #64748b;">Heterogeneity (τ²)</span>
                <span style="font-size: 1.1rem; font-weight: 600;">${formatNum(result?.tau2, 4)}</span>
            </div>
            <div class="result-card" style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                <span style="font-size: 0.85rem; color: #64748b;">I²</span>
                <span style="font-size: 1.1rem; font-weight: 600;">${formatNum(result?.I2, 1)}%</span>
            </div>
            <div class="result-card" style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                <span style="font-size: 0.85rem; color: #64748b;">Q-statistic</span>
                <span style="font-size: 1.1rem; font-weight: 600;">${formatNum(result?.Q, 2)}</span>
                <span style="font-size: 0.75rem; color: #94a3b8;">p = ${formatNum(result?.Qpvalue, 4)}</span>
            </div>
            <div class="result-card" style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                <span style="font-size: 0.85rem; color: #64748b;">AIC</span>
                <span style="font-size: 1.1rem; font-weight: 600;">${formatNum(result?.AIC, 2)}</span>
            </div>
            <div class="result-card" style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                <span style="font-size: 0.85rem; color: #64748b;">BIC</span>
                <span style="font-size: 1.1rem; font-weight: 600;">${formatNum(result?.BIC, 2)}</span>
            </div>
        `;

        // Build coefficients and additional info
        let coefHtml = '';

        // Coefficients table
        if (result?.coefficients && result?.coefficients?.length > 0) {
            coefHtml += `
                <h4 style="margin-top: 1rem; margin-bottom: 0.5rem;">Model Coefficients</h4>
                <table class="results-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th>Parameter</th>
                            <th>Estimate</th>
                            <th>SE</th>
                            <th>95% CI</th>
                            <th>p-value</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            result.coefficients.forEach(c => {
                const est = c.estimate !== undefined ? c.estimate : c.mean;
                const se = c.se !== undefined ? c.se : c.sd;
                const lower = est - 1.96 * se;
                const upper = est + 1.96 * se;
                const z = se > 0 ? Math.abs(est / se) : 0;
                const pval = 2 * (1 - Statistics.pnorm(z));

                coefHtml += `
                    <tr>
                        <td>${c.name || 'Coefficient'}</td>
                        <td>${formatNum(est, 4)}</td>
                        <td>${formatNum(se, 4)}</td>
                        <td>[${formatNum(lower, 4)}, ${formatNum(upper, 4)}]</td>
                        <td>${formatNum(pval, 4)}</td>
                    </tr>
                `;
            });

            coefHtml += '</tbody></table>';
        }

        // Non-linearity test (LRT and Wald)
        if (result.nonlinearityTest) {
            const nlt = result.nonlinearityTest;
            const sigColor = nlt.significant ? '#16a34a' : '#64748b';
            let testDetails = '';

            // LRT results
            if (nlt.lrt) {
                testDetails += `<strong>LRT:</strong> χ² = ${formatNum(nlt.lrt.statistic, 2)}, df = ${nlt.lrt.df}, p = ${formatNum(nlt.lrt.pvalue, 4)}`;
            } else {
                testDetails += `<strong>LRT:</strong> χ² = ${formatNum(nlt.statistic, 2)}, df = ${nlt.df}, p = ${formatNum(nlt.pvalue, 4)}`;
            }

            // Wald results
            if (nlt.wald && nlt.wald.statistic > 0) {
                testDetails += `<br><strong>Wald:</strong> χ² = ${formatNum(nlt.wald.statistic, 2)}, df = ${nlt.wald.df}, p = ${formatNum(nlt.wald.pvalue, 4)}`;
            }

            coefHtml += `
                <div style="margin-top: 1rem; padding: 0.75rem; background: #f0fdf4; border-radius: 6px; border-left: 3px solid ${sigColor};">
                    <strong>Non-linearity Tests (vs Linear)</strong><br>
                    <span style="font-size: 0.9rem;">${testDetails}</span><br>
                    <span style="font-size: 0.85rem; color: ${sigColor};">${nlt.interpretation}</span>
                </div>
            `;
        }

        // Goodness of fit
        if (result.goodnessOfFit) {
            const gof = result.goodnessOfFit;
            coefHtml += `
                <div style="margin-top: 1rem; padding: 0.75rem; background: #f8fafc; border-radius: 6px;">
                    <strong>Goodness of Fit</strong><br>
                    <span style="font-size: 0.9rem;">
                        Deviance: ${formatNum(gof.deviance, 2)} (df=${gof.devianceDf}, p=${formatNum(gof.deviancePvalue, 4)}) |
                        R² = ${formatNum(gof.R2 * 100, 1)}%
                    </span>
                </div>
            `;
        }

        // Knots info for spline models
        if (result.knots && result.knots.length > 0) {
            coefHtml += `
                <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #64748b;">
                    Knot locations: ${result.knots.map(k => formatNum(k, 2)).join(', ')}
                </div>
            `;
        }

        // Influence diagnostics
        if (result.influence && result.influence.available) {
            const inf = result.influence;
            let infHtml = `<strong>Leave-One-Out Analysis</strong> (${inf.nStudies} studies)<br>`;

            if (inf.potentiallyInfluential && inf.potentiallyInfluential.length > 0) {
                infHtml += `<span style="color: #dc2626;">⚠ Potentially influential: ${inf.potentiallyInfluential.join(', ')}</span>`;
            } else {
                infHtml += `<span style="color: #16a34a;">✓ No highly influential studies detected</span>`;
            }

            coefHtml += `
                <div style="margin-top: 1rem; padding: 0.75rem; background: #fefce8; border-radius: 6px;">
                    <span style="font-size: 0.9rem;">${infHtml}</span>
                </div>
            `;
        }

        // Covariance assumptions note
        if (result.covarianceAssumptions) {
            coefHtml += `
                <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #94a3b8; font-style: italic;">
                    Note: ${result.covarianceAssumptions.note}
                </div>
            `;
        }

        // Model averaging results (Akaike weights)
        if (result.modelWeights && result.modelWeights.length > 0) {
            let maHtml = '<strong>Model Averaging (Akaike Weights)</strong><br>';
            maHtml += '<table style="width:100%; font-size:0.85rem; margin-top:0.5rem;">';
            maHtml += '<tr><th>Model</th><th>AIC</th><th>Weight</th></tr>';
            result.modelWeights.forEach(m => {
                const pct = (m.weight * 100).toFixed(1);
                const barWidth = Math.round(m.weight * 100);
                maHtml += '<tr><td>' + m.model + '</td><td>' + formatNum(m.AIC, 2) + '</td><td><div style="display:flex;align-items:center;gap:0.5rem;"><div style="width:60px;height:8px;background:#e2e8f0;border-radius:4px;"><div style="width:' + barWidth + '%;height:100%;background:#3b82f6;border-radius:4px;"></div></div><span>' + pct + '%</span></div></td></tr>';
            });
            maHtml += '</table>';
            coefHtml += '<div style="margin-top: 1rem; padding: 0.75rem; background: #eff6ff; border-radius: 6px;">' + maHtml + '</div>';
        }

        // Decorrelated Q-test results
        if (result.decorrelatedQ) {
            const dq = result.decorrelatedQ;
            const sigColor = dq.pValue < 0.05 ? '#dc2626' : '#16a34a';
            const sigText = dq.pValue < 0.05 ? 'Significant heterogeneity detected' : 'No significant heterogeneity';
            coefHtml += '<div style="margin-top: 1rem; padding: 0.75rem; background: #faf5ff; border-radius: 6px; border-left: 3px solid ' + sigColor + ';"><strong>Decorrelated Residuals Q-Test</strong><br><span style="font-size: 0.9rem;">Q<sub>dec</sub> = ' + formatNum(dq.Q, 2) + ', df = ' + dq.df + ', p = ' + formatNum(dq.pValue, 4) + '</span><br><span style="font-size: 0.85rem; color: ' + sigColor + ';">' + sigText + '</span></div>';
        }

        // Spike-at-zero threshold
        if (result.threshold !== undefined) {
            const thresholdSig = result.thresholdTest?.pvalue < 0.05 ? 'significant' : 'not significant';
            coefHtml += '<div style="margin-top: 1rem; padding: 0.75rem; background: #fef3c7; border-radius: 6px;"><strong>Spike-at-Zero Threshold Model</strong><br><span style="font-size: 0.9rem;">Estimated threshold: ' + formatNum(result.threshold, 3) + ' ' + (result.doseUnit || '') + (result.thresholdTest ? '<br>Threshold effect: ' + thresholdSig + ' (p = ' + formatNum(result.thresholdTest.pvalue, 4) + ')' : '') + '</span></div>';
        }

        // Optimal fractional polynomial powers
        if (result.optimalPowers && result.optimalPowers.length > 0) {
            coefHtml += '<div style="margin-top: 1rem; padding: 0.75rem; background: #ecfdf5; border-radius: 6px;"><strong>Optimal Fractional Polynomial</strong><br><span style="font-size: 0.9rem;">Powers: ' + result.optimalPowers.join(', ') + ' (from grid search over {-2, -1, -0.5, 0, 0.5, 1, 2, 3})</span></div>';
        }

        coefDiv.innerHTML = coefHtml;
        resultsSection.style.display = 'block';
    }

    // Helper function to format numbers safely
    function formatNum(val, decimals = 2) {
        if (val === undefined || val === null || !isFinite(val)) return '--';
        return val.toFixed(decimals);
    }

    function updateDRPlot() {
        const container = document.getElementById('dr-plot-container');
        if (!container) {
            console.error('DR Plot: container not found');
            return;
        }
        if (!drState.result) {
            console.error('DR Plot: no result');
            return;
        }
        if (!Visualization || !Visualization.doseResponsePlot) {
            console.error('DR Plot: Visualization.doseResponsePlot not available');
            return;
        }

        // Check if result has prediction curve
        if (!drState.result.predictionCurve || drState.result.predictionCurve.length === 0) {
            console.warn('DR Plot: No prediction curve, generating one...');
            // Generate prediction curve if missing
            if (AdvancedMethods && AdvancedMethods.getDoseResponsePlotData) {
                const plotData = AdvancedMethods.getDoseResponsePlotData(drState.result, {
                    minDose: Math.min(...drState.data.map(d => d.dose)),
                    maxDose: Math.max(...drState.data.map(d => d.dose)),
                    nPoints: 100
                });
                drState.result.predictionCurve = plotData.curve;
            }
        }

        // Clear container and ensure visibility
        container.innerHTML = '';
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.opacity = '1';

        const showCI = document.getElementById('dr-show-ci')?.checked ?? true;
        const showPoints = document.getElementById('dr-show-points')?.checked ?? true;

        // Get container dimensions - force minimum width
        let plotWidth = container.clientWidth;
        if (!plotWidth || plotWidth < 100) {
            plotWidth = container.offsetWidth || container.parentElement?.clientWidth || 800;
        }
        if (plotWidth < 100) plotWidth = 800;

        console.log('DR Plot: Container dimensions:', container.clientWidth, 'x', container.clientHeight);
        console.log('DR Plot: Using width:', plotWidth);
        console.log('DR Plot: Curve points:', drState.result.predictionCurve?.length);

        try {
            const svgNode = Visualization.doseResponsePlot(container, drState.result, drState.data, {
                width: plotWidth,
                height: 450,
                showCI,
                showStudyPoints: showPoints,
                xLabel: drState.xLabel,
                yLabel: drState.yLabel,
                title: drDemoData[drState.currentDataset]?.name || 'Dose-Response Curve'
            });

            // Ensure SVG is visible with explicit styles
            if (svgNode) {
                svgNode.style.display = 'block';
                svgNode.style.visibility = 'visible';
                svgNode.style.margin = '0 auto';
                svgNode.style.maxWidth = '100%';
                console.log('DR Plot: SVG created, dimensions:', svgNode.getAttribute('width'), 'x', svgNode.getAttribute('height'));
            } else {
                console.error('DR Plot: svgNode is null/undefined');
            }

            // Check if SVG was actually added to container
            const svgInContainer = container.querySelector('svg');
            if (svgInContainer) {
                console.log('DR Plot: SVG found in container, viewBox:', svgInContainer.getAttribute('viewBox'));
            } else {
                console.error('DR Plot: No SVG found in container after rendering!');
                container.innerHTML = '<div style="color: red; padding: 1rem;">Error: Chart failed to render. Please try again.</div>';
            }

            // Scroll to plot
            setTimeout(() => {
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        } catch (e) {
            console.error('DR Plot error:', e);
            console.error('DR Plot error stack:', e.stack);
            container.innerHTML = `<div style="color: red; padding: 1rem;">Plot error: ${escapeHtml(e.message)}</div>`;
        }
    }

    function runDRComparison() {
        if (!drState.data || drState.data.length === 0) {
            showMessage('Please load data first', 'error');
            return;
        }

        if (!AdvancedMethods || !AdvancedMethods.compareDoseResponseModels) {
            showMessage('Dose-response module not loaded', 'error');
            return;
        }

        const tauEstimator = document.getElementById('dr-tau-estimator')?.value || 'REML';

        try {
            const comparison = AdvancedMethods.compareDoseResponseModels(drState.data, tauEstimator);

            // Display results
            const resultsDiv = document.getElementById('dr-comparison-results');
            const tbody = resultsDiv?.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = comparison.models.map(m => {
                    const isBest = m.model === comparison.bestModel;
                    return `
                        <tr style="${isBest ? 'background: #dcfce7;' : ''}">
                            <td>${m.model}${isBest ? ' ✓' : ''}</td>
                            <td>${m.aic?.toFixed(2) || '--'}</td>
                            <td>${m.bic?.toFixed(2) || '--'}</td>
                            <td>${((m.weight || 0) * 100).toFixed(1)}%</td>
                            <td>${m.lrtPvalue?.toFixed(4) || '-'}</td>
                        </tr>
                    `;
                }).join('');
            }

            if (resultsDiv) resultsDiv.style.display = 'block';

            // Show comparison plot
            const container = document.getElementById('dr-plot-container');
            if (container && Visualization && Visualization.doseResponseComparisonPlot) {
                container.innerHTML = '';
                const models = {};
                comparison.models.slice(0, 4).forEach(m => {
                    try {
                        models[m.model] = AdvancedMethods.doseResponseMA(drState.data, m.model, tauEstimator);
                    } catch (e) { /* skip failed models */ }
                });

                Visualization.doseResponseComparisonPlot(container, models, drState.data, {
                    width: container.clientWidth || 800,
                    height: 450,
                    showCI: false,
                    showStudyPoints: true,
                    showAIC: true,
                    xLabel: drState.xLabel,
                    yLabel: drState.yLabel,
                    title: 'Model Comparison'
                });
            }

            showMessage(`Best model: ${comparison.bestModel}`, 'success');
        } catch (e) {
            showMessage('Comparison error: ' + e.message, 'error');
            console.error(e);
        }
    }

    function runDRBayesian() {
        if (!drState.data || drState.data.length === 0) {
            showMessage('Please load data first', 'error');
            return;
        }

        if (!BayesianMA || !BayesianMA.bayesianDoseResponse) {
            showMessage('Bayesian module not loaded', 'error');
            return;
        }

        const modelType = document.getElementById('dr-model-type')?.value || 'linear';
        const validModels = ['linear', 'quadratic', 'spline'];
        const bayesModel = validModels.includes(modelType) ? modelType : 'linear';

        showMessage('Running Bayesian analysis (this may take a moment)...', 'info');

        setTimeout(() => {
            try {
                const result = BayesianMA.bayesianDoseResponse(drState.data, {
                    model: bayesModel,
                    iterations: 5000,
                    burnin: 1000,
                    chains: 2
                });

                drState.result = result;
                displayBayesDRResults(result);
                updateDRPlot();

                const rhat = result.diagnostics?.beta?.[0]?.rhat;
                if (rhat > 1.1) {
                    showMessage(`Bayesian analysis complete (Warning: Rhat=${rhat.toFixed(3)} > 1.1)`, 'warning');
                } else {
                    showMessage('Bayesian analysis complete', 'success');
                }
            } catch (e) {
                showMessage('Bayesian error: ' + e.message, 'error');
                console.error(e);
            }
        }, 100);
    }

    function displayBayesDRResults(result) {
        const summaryDiv = document.getElementById('dr-results-summary');
        const coefDiv = document.getElementById('dr-coefficients');
        const resultsSection = document.getElementById('dr-results');

        if (!summaryDiv || !coefDiv || !resultsSection) return;

        const rhat = result.diagnostics?.beta?.[0]?.rhat || 0;
        const ess = result.diagnostics?.beta?.[0]?.ess || 0;

        summaryDiv.innerHTML = `
            <div class="result-card" style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                <span style="font-size: 0.85rem; color: #64748b;">Model</span>
                <span style="font-size: 1.2rem; font-weight: 600;">Bayesian ${result.model || 'linear'}</span>
            </div>
            <div class="result-card" style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                <span style="font-size: 0.85rem; color: #64748b;">τ (posterior mean)</span>
                <span style="font-size: 1.2rem; font-weight: 600;">${result.tau?.mean?.toFixed(4) || '--'}</span>
            </div>
            <div class="result-card" style="background: ${rhat < 1.1 ? '#dcfce7' : '#fee2e2'}; padding: 1rem; border-radius: 8px;">
                <span style="font-size: 0.85rem; color: #64748b;">Rhat</span>
                <span style="font-size: 1.2rem; font-weight: 600;">${rhat.toFixed(3)} ${rhat < 1.1 ? '✓' : '⚠️'}</span>
            </div>
            <div class="result-card" style="background: ${ess > 400 ? '#dcfce7' : '#fef3c7'}; padding: 1rem; border-radius: 8px;">
                <span style="font-size: 0.85rem; color: #64748b;">ESS</span>
                <span style="font-size: 1.2rem; font-weight: 600;">${Math.round(ess)} ${ess > 400 ? '✓' : '⚠️'}</span>
            </div>
        `;

        if (result?.coefficients && result?.coefficients?.length > 0) {
            let coefHtml = `
                <table class="results-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th>Parameter</th>
                            <th>Mean</th>
                            <th>Median</th>
                            <th>SD</th>
                            <th>95% CrI</th>
                            <th>P(< 0)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            result.coefficients.forEach(c => {
                const ci = c.ci95 ? `[${c.ci95.lower.toFixed(4)}, ${c.ci95.upper.toFixed(4)}]` : '--';
                coefHtml += `
                    <tr>
                        <td>${c.name || 'Coefficient'}</td>
                        <td>${c.mean?.toFixed(4) || '--'}</td>
                        <td>${c.median?.toFixed(4) || '--'}</td>
                        <td>${c.sd?.toFixed(4) || '--'}</td>
                        <td>${ci}</td>
                        <td>${((c.probNegative || 0) * 100).toFixed(1)}%</td>
                    </tr>
                `;
            });

            coefHtml += '</tbody></table>';
            coefDiv.innerHTML = coefHtml;
        }

        resultsSection.style.display = 'block';
    }


    // ============================================
    // BEYOND R: Advanced Analysis Functions
    // ============================================

    function runBMDAnalysis() {
        if (!drState.data || !drState.result) {
            showMessage('Please run standard analysis first', 'error');
            return;
        }

        if (!AdvancedMethods || !AdvancedMethods.benchmarkDose) {
            showMessage('BMD module not available', 'error');
            return;
        }

        try {
            const bmr = 0.1;
            const bmd = AdvancedMethods.benchmarkDose(drState.data, drState.result, bmr, {
                type: 'extra',
                direction: 'up',
                ciMethod: 'delta'
            });

            const coefDiv = document.getElementById('dr-coefficients');
            if (coefDiv) {
                coefDiv.innerHTML += '<div style="margin-top: 1rem; padding: 1rem; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;"><h4 style="margin: 0 0 0.5rem 0; color: #92400e;">Benchmark Dose Analysis (BMD)</h4><table style="width: 100%; font-size: 0.9rem;"><tr><td><strong>BMR:</strong></td><td>' + (bmd.BMR * 100).toFixed(0) + '% ' + bmd.type + ' risk</td></tr><tr><td><strong>BMD:</strong></td><td>' + bmd.BMD.toFixed(4) + '</td></tr><tr><td><strong>BMDL (lower 95%):</strong></td><td>' + bmd.BMDL.toFixed(4) + '</td></tr><tr><td><strong>BMDU (upper 95%):</strong></td><td>' + bmd.BMDU.toFixed(4) + '</td></tr></table><p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #78350f;">' + bmd.interpretation + '</p></div>';
            }
            showMessage('BMD analysis complete', 'success');
        } catch (e) {
            showMessage('BMD error: ' + e.message, 'error');
            console.error(e);
        }
    }

    function runOptimalDoseAnalysis() {
        if (!drState.data || !drState.result) {
            showMessage('Please run standard analysis first', 'error');
            return;
        }

        if (!AdvancedMethods || !AdvancedMethods.findOptimalDose) {
            showMessage('Optimal dose module not available', 'error');
            return;
        }

        showMessage('Finding optimal dose (bootstrapping)...', 'info');

        setTimeout(function() {
            try {
                var optMin = AdvancedMethods.findOptimalDose(drState.data, drState.result, {
                    type: 'minimum',
                    nBoot: 200
                });

                var med = AdvancedMethods.minimumEffectiveDose(drState.data, drState.result, {
                    alpha: 0.05,
                    direction: 'lower'
                });

                var shape = AdvancedMethods.testDRShape(drState.data, drState.result);

                var coefDiv = document.getElementById('dr-coefficients');
                if (coefDiv) {
                    var html = '<div style="margin-top: 1rem; padding: 1rem; background: #ecfdf5; border-radius: 8px; border-left: 4px solid #10b981;"><h4 style="margin: 0 0 0.5rem 0; color: #065f46;">Dose Finding Analysis</h4><table style="width: 100%; font-size: 0.9rem;"><tr><td><strong>Curve Shape:</strong></td><td>' + shape.shape + (shape.monotonic ? ' (monotonic)' : '') + '</td></tr><tr><td><strong>Optimal Dose:</strong></td><td>' + optMin.optimalDose.toFixed(4) + ' [95% CI: ' + optMin.ci95[0].toFixed(4) + ', ' + optMin.ci95[1].toFixed(4) + ']</td></tr><tr><td><strong>Effect at optimum:</strong></td><td>' + optMin.effectAtOptimum.toFixed(4) + '</td></tr>';
                    if (med.found) {
                        html += '<tr><td><strong>Min Effective Dose:</strong></td><td>' + med.MED.toFixed(4) + '</td></tr>';
                    }
                    html += '</table><p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #047857;">' + optMin.interpretation + '</p></div>';
                    coefDiv.innerHTML += html;
                }
                showMessage('Optimal dose analysis complete', 'success');
            } catch (e) {
                showMessage('Optimal dose error: ' + e.message, 'error');
                console.error(e);
            }
        }, 100);
    }

    function runCrossValidation() {
        if (!drState.data || drState.data.length === 0) {
            showMessage('Please load data first', 'error');
            return;
        }

        if (!AdvancedMethods || !AdvancedMethods.crossValidateDR) {
            showMessage('CV module not available', 'error');
            return;
        }

        showMessage('Running cross-validation...', 'info');

        setTimeout(function() {
            try {
                var cv = AdvancedMethods.crossValidateDR(drState.data,
                    ['linear', 'quadratic', 'spline', 'loglinear'],
                    { method: 'REML' }
                );

                var loo = AdvancedMethods.studyLevelLOO(drState.data, {
                    model: drState.result ? drState.result.model : 'spline'
                });

                var pbias = null;
                if (drState.result && AdvancedMethods.drPublicationBias) {
                    pbias = AdvancedMethods.drPublicationBias(drState.data, drState.result);
                }

                var coefDiv = document.getElementById('dr-coefficients');
                if (coefDiv) {
                    var cvHtml = '<div style="margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;"><h4 style="margin: 0 0 0.5rem 0; color: #1e40af;">Cross-Validation & Diagnostics</h4><table style="width: 100%; font-size: 0.9rem;"><tr><th>Model</th><th>RMSE</th></tr>';
                    cv.results.forEach(function(r) {
                        var best = r.model === cv.bestModel ? ' *' : '';
                        cvHtml += '<tr><td>' + r.model + best + '</td><td>' + r.rmse.toFixed(4) + '</td></tr>';
                    });
                    cvHtml += '</table><p style="margin: 0.5rem 0; font-size: 0.85rem; color: #1e3a8a;">' + cv.interpretation + '</p>';

                    if (loo.influentialStudies && loo.influentialStudies.length > 0) {
                        cvHtml += '<p style="color: #dc2626; font-size: 0.85rem;">Warning: Influential studies: ' + loo.influentialStudies.join(', ') + '</p>';
                    } else {
                        cvHtml += '<p style="color: #16a34a; font-size: 0.85rem;">No highly influential studies detected</p>';
                    }

                    if (pbias && pbias.pValue != null) {
                        var biasColor = Math.abs(pbias.intercept) > 2 ? '#dc2626' : '#16a34a';
                        cvHtml += '<p style="font-size: 0.85rem; color: ' + biasColor + ';">Publication bias (Egger): intercept = ' + (pbias.intercept != null ? pbias.intercept.toFixed(3) : 'N/A') + ' - ' + pbias.interpretation + '</p>';
                    }

                    cvHtml += '</div>';
                    coefDiv.innerHTML += cvHtml;
                }
                showMessage('Cross-validation complete', 'success');
            } catch (e) {
                showMessage('CV error: ' + e.message, 'error');
                console.error(e);
            }
        }, 100);
    }


    // ============================================
    // Public API
    // ============================================

    return {
        init,
        state,
        runAnalysis,
        generateForestPlot,
        generateFunnelPlot
    };

})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
