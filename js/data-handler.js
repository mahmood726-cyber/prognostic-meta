/**
 * PrognosisMeta - Data Handler Module
 * Handles data import, export, validation, and transformation
 */

const DataHandler = (function() {
    'use strict';

    // ============================================
    // Data Structure Definitions
    // ============================================

    // Column definitions for different analysis types
    const COLUMN_DEFINITIONS = {
        prognostic: {
            HR: [
                { id: 'study', label: 'Study', type: 'text', required: true },
                { id: 'year', label: 'Year', type: 'number', required: false },
                { id: 'n', label: 'N', type: 'number', required: false },
                { id: 'events', label: 'Events', type: 'number', required: false },
                { id: 'hr', label: 'HR', type: 'number', required: true },
                { id: 'lower', label: 'Lower CI', type: 'number', required: true },
                { id: 'upper', label: 'Upper CI', type: 'number', required: true },
                { id: 'se', label: 'SE (log)', type: 'number', required: false },
                { id: 'subgroup', label: 'Subgroup', type: 'text', required: false }
            ],
            OR: [
                { id: 'study', label: 'Study', type: 'text', required: true },
                { id: 'year', label: 'Year', type: 'number', required: false },
                { id: 'or', label: 'OR', type: 'number', required: true },
                { id: 'lower', label: 'Lower CI', type: 'number', required: true },
                { id: 'upper', label: 'Upper CI', type: 'number', required: true },
                { id: 'se', label: 'SE (log)', type: 'number', required: false },
                { id: 'a', label: 'Events Tx', type: 'number', required: false },
                { id: 'b', label: 'Non-events Tx', type: 'number', required: false },
                { id: 'c', label: 'Events Ctrl', type: 'number', required: false },
                { id: 'd', label: 'Non-events Ctrl', type: 'number', required: false },
                { id: 'subgroup', label: 'Subgroup', type: 'text', required: false }
            ],
            RR: [
                { id: 'study', label: 'Study', type: 'text', required: true },
                { id: 'year', label: 'Year', type: 'number', required: false },
                { id: 'rr', label: 'RR', type: 'number', required: true },
                { id: 'lower', label: 'Lower CI', type: 'number', required: true },
                { id: 'upper', label: 'Upper CI', type: 'number', required: true },
                { id: 'se', label: 'SE (log)', type: 'number', required: false },
                { id: 'subgroup', label: 'Subgroup', type: 'text', required: false }
            ],
            beta: [
                { id: 'study', label: 'Study', type: 'text', required: true },
                { id: 'year', label: 'Year', type: 'number', required: false },
                { id: 'n', label: 'N', type: 'number', required: false },
                { id: 'beta', label: 'β', type: 'number', required: true },
                { id: 'se', label: 'SE', type: 'number', required: true },
                { id: 'lower', label: 'Lower CI', type: 'number', required: false },
                { id: 'upper', label: 'Upper CI', type: 'number', required: false },
                { id: 'subgroup', label: 'Subgroup', type: 'text', required: false }
            ]
        },
        prediction: {
            cstat: [
                { id: 'study', label: 'Study', type: 'text', required: true },
                { id: 'year', label: 'Year', type: 'number', required: false },
                { id: 'n', label: 'N', type: 'number', required: false },
                { id: 'events', label: 'Events', type: 'number', required: false },
                { id: 'cstat', label: 'C-statistic', type: 'number', required: true },
                { id: 'lower', label: 'Lower CI', type: 'number', required: false },
                { id: 'upper', label: 'Upper CI', type: 'number', required: false },
                { id: 'se', label: 'SE', type: 'number', required: false },
                { id: 'validation', label: 'Validation', type: 'text', required: false },
                { id: 'subgroup', label: 'Subgroup', type: 'text', required: false }
            ],
            'oe-ratio': [
                { id: 'study', label: 'Study', type: 'text', required: true },
                { id: 'year', label: 'Year', type: 'number', required: false },
                { id: 'n', label: 'N', type: 'number', required: false },
                { id: 'observed', label: 'Observed', type: 'number', required: false },
                { id: 'expected', label: 'Expected', type: 'number', required: false },
                { id: 'oe', label: 'O:E Ratio', type: 'number', required: true },
                { id: 'lower', label: 'Lower CI', type: 'number', required: false },
                { id: 'upper', label: 'Upper CI', type: 'number', required: false },
                { id: 'se', label: 'SE', type: 'number', required: false },
                { id: 'subgroup', label: 'Subgroup', type: 'text', required: false }
            ],
            'cal-slope': [
                { id: 'study', label: 'Study', type: 'text', required: true },
                { id: 'year', label: 'Year', type: 'number', required: false },
                { id: 'n', label: 'N', type: 'number', required: false },
                { id: 'slope', label: 'Calibration Slope', type: 'number', required: true },
                { id: 'se', label: 'SE', type: 'number', required: true },
                { id: 'lower', label: 'Lower CI', type: 'number', required: false },
                { id: 'upper', label: 'Upper CI', type: 'number', required: false },
                { id: 'subgroup', label: 'Subgroup', type: 'text', required: false }
            ],
            'cal-intercept': [
                { id: 'study', label: 'Study', type: 'text', required: true },
                { id: 'year', label: 'Year', type: 'number', required: false },
                { id: 'n', label: 'N', type: 'number', required: false },
                { id: 'intercept', label: 'Calibration Intercept', type: 'number', required: true },
                { id: 'se', label: 'SE', type: 'number', required: true },
                { id: 'lower', label: 'Lower CI', type: 'number', required: false },
                { id: 'upper', label: 'Upper CI', type: 'number', required: false },
                { id: 'subgroup', label: 'Subgroup', type: 'text', required: false }
            ],
            brier: [
                { id: 'study', label: 'Study', type: 'text', required: true },
                { id: 'year', label: 'Year', type: 'number', required: false },
                { id: 'n', label: 'N', type: 'number', required: false },
                { id: 'brier', label: 'Brier Score', type: 'number', required: true },
                { id: 'se', label: 'SE', type: 'number', required: false },
                { id: 'lower', label: 'Lower CI', type: 'number', required: false },
                { id: 'upper', label: 'Upper CI', type: 'number', required: false },
                { id: 'subgroup', label: 'Subgroup', type: 'text', required: false }
            ],
            'sens-spec': [
                { id: 'study', label: 'Study', type: 'text', required: true },
                { id: 'year', label: 'Year', type: 'number', required: false },
                { id: 'n', label: 'N', type: 'number', required: false },
                { id: 'tp', label: 'True Positive', type: 'number', required: true },
                { id: 'fp', label: 'False Positive', type: 'number', required: true },
                { id: 'fn', label: 'False Negative', type: 'number', required: true },
                { id: 'tn', label: 'True Negative', type: 'number', required: true },
                { id: 'sens', label: 'Sensitivity', type: 'number', required: false },
                { id: 'spec', label: 'Specificity', type: 'number', required: false },
                { id: 'subgroup', label: 'Subgroup', type: 'text', required: false }
            ]
        }
    };

    // ============================================
    // Get Column Definitions
    // ============================================

    function getColumns(analysisType, effectMeasure) {
        return COLUMN_DEFINITIONS[analysisType]?.[effectMeasure] || [];
    }

    // ============================================
    // Data Validation
    // ============================================

    function validateData(data, columns) {
        const errors = [];
        const warnings = [];

        if (!data || data.length === 0) {
            errors.push('No data provided');
            return { valid: false, errors, warnings };
        }

        // Check each row
        data.forEach((row, rowIndex) => {
            const rowNum = rowIndex + 1;

            // Check required fields
            columns.filter(col => col.required).forEach(col => {
                if (row[col.id] === undefined || row[col.id] === null || row[col.id] === '') {
                    errors.push(`Row ${rowNum}: Missing required field "${col.label}"`);
                }
            });

            // Validate numeric fields
            columns.filter(col => col.type === 'number').forEach(col => {
                const value = row[col.id];
                if (value !== undefined && value !== null && value !== '') {
                    if (isNaN(parseFloat(value))) {
                        errors.push(`Row ${rowNum}: "${col.label}" must be a number`);
                    }
                }
            });

            // Specific validations
            if (row.hr !== undefined && row.hr <= 0) {
                errors.push(`Row ${rowNum}: HR must be positive`);
            }
            if (row.or !== undefined && row.or <= 0) {
                errors.push(`Row ${rowNum}: OR must be positive`);
            }
            if (row.rr !== undefined && row.rr <= 0) {
                errors.push(`Row ${rowNum}: RR must be positive`);
            }
            if (row.cstat !== undefined && (row.cstat < 0 || row.cstat > 1)) {
                errors.push(`Row ${rowNum}: C-statistic must be between 0 and 1`);
            }
            if (row.sens !== undefined && (row.sens < 0 || row.sens > 1)) {
                errors.push(`Row ${rowNum}: Sensitivity must be between 0 and 1`);
            }
            if (row.spec !== undefined && (row.spec < 0 || row.spec > 1)) {
                errors.push(`Row ${rowNum}: Specificity must be between 0 and 1`);
            }

            // Check CI ordering
            if (row.lower !== undefined && row.upper !== undefined) {
                if (parseFloat(row.lower) > parseFloat(row.upper)) {
                    errors.push(`Row ${rowNum}: Lower CI must be less than Upper CI`);
                }
            }

            // Warnings for optional but recommended fields
            if (row.n === undefined || row.n === '') {
                warnings.push(`Row ${rowNum}: Sample size (N) not provided - some analyses may be limited`);
            }
        });

        // Check minimum number of studies
        if (data.length < 2) {
            warnings.push('At least 2 studies recommended for meta-analysis');
        }
        if (data.length < 3) {
            warnings.push('At least 3 studies recommended for heterogeneity assessment');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    // ============================================
    // Effect Size Calculations
    // ============================================

    /**
     * Calculate effect sizes and variances from input data
     */
    function calculateEffectSizes(data, analysisType, effectMeasure) {
        const processed = [];

        // Use for loop instead of forEach so 'continue' works properly
        for (let index = 0; index < data.length; index++) {
            const row = data[index];
            const rowNum = index + 1;

            // Use explicit null checks to preserve valid zero values
            const parsedYear = parseFloat(row.year);
            const parsedN = parseFloat(row.n);
            const study = {
                id: index,
                study: row.study,
                year: isFinite(parsedYear) ? parsedYear : null,
                n: isFinite(parsedN) ? parsedN : null,
                subgroup: row.subgroup || null
            };

            let skipRow = false;  // Flag to skip invalid rows

            if (analysisType === 'prognostic') {
                switch (effectMeasure) {
                    case 'HR':
                        const hr = parseFloat(row.hr);
                        if (!isFinite(hr) || hr <= 0) {
                            console.warn(`Row ${rowNum}: HR must be a positive number, skipping`);
                            skipRow = true;
                            break;
                        }
                        const logHR = Math.log(hr);
                        let seLogHR;

                        if (row.se && !isNaN(parseFloat(row.se))) {
                            seLogHR = parseFloat(row.se);
                        } else {
                            const lowerCI = parseFloat(row.lower);
                            const upperCI = parseFloat(row.upper);
                            if (!isFinite(lowerCI) || lowerCI <= 0 || !isFinite(upperCI) || upperCI <= 0) {
                                console.warn(`Row ${rowNum}: CI bounds must be positive numbers, skipping`);
                                skipRow = true;
                                break;
                            }
                            const lower = Math.log(lowerCI);
                            const upper = Math.log(upperCI);
                            seLogHR = (upper - lower) / (2 * 1.96);
                        }

                        study.effect = logHR;
                        study.se = seLogHR;
                        study.variance = seLogHR * seLogHR;
                        study.originalEffect = hr;
                        study.originalLower = parseFloat(row.lower);
                        study.originalUpper = parseFloat(row.upper);
                        study.events = parseFloat(row.events) || null;
                        break;

                    case 'OR':
                        const or = parseFloat(row.or);
                        if (!isFinite(or) || or <= 0) {
                            console.warn(`Row ${rowNum}: OR must be a positive number, skipping`);
                            skipRow = true;
                            break;
                        }
                        const logOR = Math.log(or);
                        let seLogOR;

                        if (row.se && !isNaN(parseFloat(row.se))) {
                            seLogOR = parseFloat(row.se);
                        } else if (row.a !== undefined && row.b !== undefined &&
                                   row.c !== undefined && row.d !== undefined) {
                            // From 2x2 table
                            const a = parseFloat(row.a);
                            const b = parseFloat(row.b);
                            const c = parseFloat(row.c);
                            const d = parseFloat(row.d);
                            seLogOR = Math.sqrt(1/Math.max(0.5, a) + 1/Math.max(0.5, b) + 1/Math.max(0.5, c) + 1/Math.max(0.5, d));
                            study.a = a;
                            study.b = b;
                            study.c = c;
                            study.d = d;
                        } else {
                            const lowerCI = parseFloat(row.lower);
                            const upperCI = parseFloat(row.upper);
                            if (!isFinite(lowerCI) || lowerCI <= 0 || !isFinite(upperCI) || upperCI <= 0) {
                                console.warn(`Row ${rowNum}: CI bounds must be positive numbers, skipping`);
                                skipRow = true;
                                break;
                            }
                            const lower = Math.log(lowerCI);
                            const upper = Math.log(upperCI);
                            seLogOR = (upper - lower) / (2 * 1.96);
                        }

                        study.effect = logOR;
                        study.se = seLogOR;
                        study.variance = seLogOR * seLogOR;
                        study.originalEffect = or;
                        study.originalLower = parseFloat(row.lower);
                        study.originalUpper = parseFloat(row.upper);
                        break;

                    case 'RR':
                        const rr = parseFloat(row.rr);
                        if (!isFinite(rr) || rr <= 0) {
                            console.warn(`Row ${rowNum}: RR must be a positive number, skipping`);
                            skipRow = true;
                            break;
                        }
                        const logRR = Math.log(rr);
                        let seLogRR;

                        if (row.se && !isNaN(parseFloat(row.se))) {
                            seLogRR = parseFloat(row.se);
                        } else {
                            const lowerCI = parseFloat(row.lower);
                            const upperCI = parseFloat(row.upper);
                            if (!isFinite(lowerCI) || lowerCI <= 0 || !isFinite(upperCI) || upperCI <= 0) {
                                console.warn(`Row ${rowNum}: CI bounds must be positive numbers, skipping`);
                                skipRow = true;
                                break;
                            }
                            const lower = Math.log(lowerCI);
                            const upper = Math.log(upperCI);
                            seLogRR = (upper - lower) / (2 * 1.96);
                        }

                        study.effect = logRR;
                        study.se = seLogRR;
                        study.variance = seLogRR * seLogRR;
                        study.originalEffect = rr;
                        study.originalLower = parseFloat(row.lower);
                        study.originalUpper = parseFloat(row.upper);
                        break;

                    case 'beta':
                        const beta = parseFloat(row.beta);
                        const seBeta = parseFloat(row.se);

                        study.effect = beta;
                        study.se = seBeta;
                        study.variance = seBeta * seBeta;
                        study.originalEffect = beta;
                        if (row.lower && row.upper) {
                            study.originalLower = parseFloat(row.lower);
                            study.originalUpper = parseFloat(row.upper);
                        } else {
                            study.originalLower = beta - 1.96 * seBeta;
                            study.originalUpper = beta + 1.96 * seBeta;
                        }
                        break;
                }
            } else if (analysisType === 'prediction') {
                switch (effectMeasure) {
                    case 'cstat':
                        const cstatRaw = parseFloat(row.cstat);
                        // Clamp to (0.001, 0.999) to avoid division by zero in logit transform
                        const cstat = Math.max(0.001, Math.min(0.999, cstatRaw));
                        const logitC = Math.log(cstat / (1 - cstat));
                        let seCstat;

                        if (row.se && !isNaN(parseFloat(row.se))) {
                            seCstat = parseFloat(row.se);
                        } else if (row.lower && row.upper) {
                            seCstat = (parseFloat(row.upper) - parseFloat(row.lower)) / (2 * 1.96);
                        } else if (row.n && row.events) {
                            // Hanley-McNeil approximation
                            const n = parseFloat(row.n);
                            const events = parseFloat(row.events);
                            const q1 = cstat / (2 - cstat);
                            const q2 = 2 * cstat * cstat / (1 + cstat);
                            seCstat = Math.sqrt((cstat * (1 - cstat) + (events - 1) * (q1 - cstat * cstat) +
                                      (n - events - 1) * (q2 - cstat * cstat)) / (events * (n - events)));
                        } else {
                            seCstat = 0.05;  // Default placeholder
                            console.warn(`Row ${rowNum}: SE for C-statistic imputed as 0.05 - provide SE or CI for accurate analysis`);
                        }

                        // Transform to logit scale
                        const seLogitC = seCstat / (cstat * (1 - cstat));

                        study.effect = logitC;
                        study.se = seLogitC;
                        study.variance = seLogitC * seLogitC;
                        study.originalEffect = cstat;
                        study.originalSE = seCstat;
                        study.originalLower = row.lower ? parseFloat(row.lower) : cstat - 1.96 * seCstat;
                        study.originalUpper = row.upper ? parseFloat(row.upper) : cstat + 1.96 * seCstat;
                        study.events = parseFloat(row.events) || null;
                        study.validation = row.validation || null;
                        break;

                    case 'oe-ratio':
                        const oeRaw = parseFloat(row.oe);
                        // Clamp to avoid log(0) and division by zero
                        const oe = Math.max(0.001, oeRaw);
                        const logOE = Math.log(oe);
                        let seOE;

                        if (row.se && !isNaN(parseFloat(row.se))) {
                            seOE = parseFloat(row.se);
                        } else if (row.lower && row.upper) {
                            seOE = (parseFloat(row.upper) - parseFloat(row.lower)) / (2 * 1.96);
                        } else if (row.observed && row.expected) {
                            // Approximation from O and E
                            const O = parseFloat(row.observed);
                            seOE = 1 / Math.sqrt(O);
                        } else {
                            seOE = 0.1;  // Default placeholder
                        }

                        const seLogOE = seOE / oe;

                        study.effect = logOE;
                        study.se = seLogOE;
                        study.variance = seLogOE * seLogOE;
                        study.originalEffect = oe;
                        study.originalSE = seOE;
                        study.observed = parseFloat(row.observed) || null;
                        study.expected = parseFloat(row.expected) || null;
                        break;

                    case 'cal-slope':
                        const slope = parseFloat(row.slope);
                        const seSlope = parseFloat(row.se);

                        study.effect = slope;
                        study.se = seSlope;
                        study.variance = seSlope * seSlope;
                        study.originalEffect = slope;
                        break;

                    case 'cal-intercept':
                        const intercept = parseFloat(row.intercept);
                        const seIntercept = parseFloat(row.se);

                        study.effect = intercept;
                        study.se = seIntercept;
                        study.variance = seIntercept * seIntercept;
                        study.originalEffect = intercept;
                        break;

                    case 'brier':
                        const brier = parseFloat(row.brier);
                        let seBrier;

                        if (row.se && !isNaN(parseFloat(row.se))) {
                            seBrier = parseFloat(row.se);
                        } else if (row.lower && row.upper) {
                            seBrier = (parseFloat(row.upper) - parseFloat(row.lower)) / (2 * 1.96);
                        } else {
                            seBrier = 0.02;  // Default placeholder
                        }

                        study.effect = brier;
                        study.se = seBrier;
                        study.variance = seBrier * seBrier;
                        study.originalEffect = brier;
                        break;

                    case 'sens-spec':
                        const tp = parseFloat(row.tp);
                        const fp = parseFloat(row.fp);
                        const fn = parseFloat(row.fn);
                        const tn = parseFloat(row.tn);

                        const nPos = tp + fn;
                        const nNeg = tn + fp;

                        // Guard against zero denominators
                        const sens = nPos > 0 ? tp / nPos : 0;
                        const spec = nNeg > 0 ? tn / nNeg : 0;

                        const varSens = nPos > 0 ? sens * (1 - sens) / nPos : 0;
                        const varSpec = nNeg > 0 ? spec * (1 - spec) / nNeg : 0;

                        study.sensitivity = sens;
                        study.specificity = spec;
                        study.varSens = varSens;
                        study.varSpec = varSpec;
                        study.tp = tp;
                        study.fp = fp;
                        study.fn = fn;
                        study.tn = tn;

                        // Set effect/se/variance using logit-transformed sensitivity
                        const sensClamp = Math.max(0.001, Math.min(0.999, sens));
                        study.effect = Math.log(sensClamp / (1 - sensClamp));
                        study.se = nPos > 0 ? 1 / Math.sqrt(nPos * sensClamp * (1 - sensClamp)) : 1;
                        study.variance = study.se * study.se;
                        break;
                }
            }

            // Skip rows that had validation errors
            if (skipRow) continue;

            // Final SE/variance validation - ensure no negative or NaN values
            if (!isFinite(study.se) || study.se <= 0) {
                console.warn(`Row ${rowNum}: SE must be a positive finite number (got ${study.se}), skipping`);
                continue;
            }
            if (!isFinite(study.variance) || study.variance <= 0) {
                console.warn(`Row ${rowNum}: Variance must be positive finite (got ${study.variance}), skipping`);
                continue;
            }
            if (!isFinite(study.effect)) {
                console.warn(`Row ${rowNum}: Effect must be finite (got ${study.effect}), skipping`);
                continue;
            }

            processed.push(study);
        }

        return processed;
    }

    // ============================================
    // File Import Functions
    // ============================================

    /**
     * Parse CSV file
     */
    function parseCSV(content) {
        const lines = content.trim().split(/\r?\n/);
        if (lines.length < 2) return [];

        // Parse header
        const header = parseCSVLine(lines[0]);

        // Parse data rows
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;

            const values = parseCSVLine(lines[i]);
            const row = {};

            header.forEach((col, j) => {
                row[col.toLowerCase().replace(/\s+/g, '_')] = values[j] || '';
            });

            data.push(row);
        }

        return data;
    }

    /**
     * Parse a single CSV line (handling quoted values)
     */
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    /**
     * Parse Excel file using SheetJS
     */
    function parseExcel(arrayBuffer) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded');
        }

        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        // Normalize column names
        return data.map(row => {
            const normalized = {};
            Object.keys(row).forEach(key => {
                normalized[key.toLowerCase().replace(/\s+/g, '_')] = row[key];
            });
            return normalized;
        });
    }

    /**
     * Read file and parse content
     */
    function importFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    let data;
                    const fileName = file.name.toLowerCase();

                    if (fileName.endsWith('.csv')) {
                        data = parseCSV(e.target.result);
                    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                        data = parseExcel(e.target.result);
                    } else if (fileName.endsWith('.json')) {
                        data = JSON.parse(e.target.result);
                    } else {
                        reject(new Error('Unsupported file format'));
                        return;
                    }

                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));

            if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.json')) {
                reader.readAsText(file);
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    // ============================================
    // File Export Functions
    // ============================================

    /**
     * Export data to CSV
     */
    function exportCSV(data, columns) {
        function csvSafe(value) {
            if (value === undefined || value === null) return '';
            let str = String(value);
            // Prevent CSV formula injection
            if (/^[=+\-@\t\r]/.test(str)) {
                str = "'" + str;
            }
            // Quote if contains comma, double quote, or newline; escape inner quotes
            if (/[,"\n\r]/.test(str)) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        }

        const header = columns.map(col => csvSafe(col.label)).join(',');
        const rows = data.map(row =>
            columns.map(col => csvSafe(row[col.id])).join(',')
        );

        return header + '\n' + rows.join('\n');
    }

    /**
     * Export data to Excel
     */
    function exportExcel(data, columns, filename = 'meta_analysis_data.xlsx') {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded');
        }

        const wsData = [columns.map(col => col.label)];
        data.forEach(row => {
            wsData.push(columns.map(col => row[col.id] || ''));
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');

        XLSX.writeFile(wb, filename);
    }

    /**
     * Generate template file
     */
    function generateTemplate(analysisType, effectMeasure, format = 'csv') {
        const columns = getColumns(analysisType, effectMeasure);

        // Sample data row
        const sampleRow = {};
        columns.forEach(col => {
            switch (col.id) {
                case 'study':
                    sampleRow[col.id] = 'Author et al. 2020';
                    break;
                case 'year':
                    sampleRow[col.id] = 2020;
                    break;
                case 'n':
                    sampleRow[col.id] = 500;
                    break;
                case 'events':
                    sampleRow[col.id] = 100;
                    break;
                case 'hr':
                case 'or':
                case 'rr':
                    sampleRow[col.id] = 1.5;
                    break;
                case 'lower':
                    sampleRow[col.id] = 1.2;
                    break;
                case 'upper':
                    sampleRow[col.id] = 1.9;
                    break;
                case 'se':
                    sampleRow[col.id] = 0.15;
                    break;
                case 'cstat':
                    sampleRow[col.id] = 0.75;
                    break;
                case 'oe':
                case 'slope':
                    sampleRow[col.id] = 1.0;
                    break;
                default:
                    sampleRow[col.id] = '';
            }
        });

        if (format === 'csv') {
            return exportCSV([sampleRow], columns);
        } else {
            // Return worksheet data for Excel
            return {
                columns,
                data: [sampleRow]
            };
        }
    }

    // ============================================
    // Project Save/Load
    // ============================================

    /**
     * Save project state
     */
    function saveProject(state) {
        const projectData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            analysisType: state.analysisType,
            effectMeasure: state.effectMeasure,
            data: state.data,
            settings: state.settings,
            results: state.results
        };

        return JSON.stringify(projectData, null, 2);
    }

    /**
     * Load project state
     */
    function loadProject(jsonString) {
        const projectData = JSON.parse(jsonString);

        // Validate version
        if (!projectData.version) {
            throw new Error('Invalid project file');
        }

        return {
            analysisType: projectData.analysisType,
            effectMeasure: projectData.effectMeasure,
            data: projectData.data,
            settings: projectData.settings,
            results: projectData.results
        };
    }

    /**
     * Download file helper
     */
    function downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============================================
    // Column Mapping
    // ============================================

    /**
     * Try to auto-map imported columns to expected columns
     */
    function autoMapColumns(importedColumns, expectedColumns) {
        const mapping = {};
        const synonyms = {
            'study': ['study', 'author', 'authors', 'study_name', 'reference', 'source'],
            'year': ['year', 'pub_year', 'publication_year', 'date'],
            'n': ['n', 'sample_size', 'total', 'patients', 'participants', 'size'],
            'events': ['events', 'cases', 'outcomes', 'failures', 'deaths'],
            'hr': ['hr', 'hazard_ratio', 'hazard', 'exp_b'],
            'or': ['or', 'odds_ratio', 'odds'],
            'rr': ['rr', 'risk_ratio', 'relative_risk'],
            'beta': ['beta', 'coefficient', 'coef', 'b', 'estimate'],
            'lower': ['lower', 'lower_ci', 'ci_lower', 'lcl', 'lb', 'll', 'ci_low', 'lower_95'],
            'upper': ['upper', 'upper_ci', 'ci_upper', 'ucl', 'ub', 'ul', 'ci_high', 'upper_95'],
            'se': ['se', 'std_error', 'standard_error', 'stderr', 'std_err'],
            'cstat': ['cstat', 'c_statistic', 'c_stat', 'auc', 'auroc', 'c_index', 'c-index'],
            'oe': ['oe', 'o_e', 'oe_ratio', 'observed_expected'],
            'slope': ['slope', 'cal_slope', 'calibration_slope'],
            'intercept': ['intercept', 'cal_intercept', 'calibration_intercept'],
            'subgroup': ['subgroup', 'group', 'category', 'stratum']
        };

        expectedColumns.forEach(expected => {
            const possibleNames = synonyms[expected.id] || [expected.id];
            const normalizedImported = importedColumns.map(col => col.toLowerCase().replace(/[\s_-]+/g, '_'));

            for (const name of possibleNames) {
                const idx = normalizedImported.indexOf(name.toLowerCase().replace(/[\s_-]+/g, '_'));
                if (idx !== -1) {
                    mapping[expected.id] = importedColumns[idx];
                    break;
                }
            }
        });

        return mapping;
    }

    /**
     * Apply column mapping to data
     */
    function applyMapping(data, mapping) {
        return data.map(row => {
            const newRow = {};
            Object.entries(mapping).forEach(([targetCol, sourceCol]) => {
                if (sourceCol && row[sourceCol] !== undefined) {
                    newRow[targetCol] = row[sourceCol];
                }
            });
            return newRow;
        });
    }

    // ============================================
    // Public API
    // ============================================

    return {
        // Column definitions
        getColumns,
        COLUMN_DEFINITIONS,

        // Validation
        validateData,

        // Effect size calculation
        calculateEffectSizes,

        // File operations
        parseCSV,
        parseExcel,
        importFile,
        exportCSV,
        exportExcel,
        generateTemplate,
        downloadFile,

        // Project management
        saveProject,
        loadProject,

        // Column mapping
        autoMapColumns,
        applyMapping
    };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataHandler;
}
