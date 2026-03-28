/**
 * PrognosisMeta - Visualization Module
 * Comprehensive D3.js-based plotting for meta-analysis
 * Publication-quality visualizations
 */

const Visualization = (function() {
    'use strict';

    // Module dependency check
    if (typeof d3 === 'undefined') {
        console.warn('D3.js not loaded - Visualization module will have limited functionality');
    }

    // ============================================
    // Default Settings
    // ============================================

    const DEFAULTS = {
        width: 800,
        height: 600,
        margin: { top: 40, right: 80, bottom: 60, left: 200 },
        colors: {
            primary: '#2563eb',
            secondary: '#64748b',
            pooled: '#dc2626',
            prediction: '#16a34a',
            grid: '#e5e7eb',
            axis: '#374151',
            text: '#1f2937',
            ci: 'rgba(37, 99, 235, 0.3)',
            significant: '#22c55e',
            nonsignificant: '#ef4444',
            contour1: 'rgba(37, 99, 235, 0.1)',
            contour2: 'rgba(37, 99, 235, 0.05)',
            contour3: 'rgba(37, 99, 235, 0.02)'
        },
        fonts: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            sizeSmall: 10,
            sizeMedium: 12,
            sizeLarge: 14,
            sizeTitle: 16
        }
    };

    // ============================================
    // Utility Functions
    // ============================================

    function createSVG(container, width, height) {
        d3.select(container).selectAll('*').remove();

        return d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('xmlns', 'http://www.w3.org/2000/svg');
    }

    function formatNumber(num, decimals = 2) {
        if (num === undefined || num === null || isNaN(num)) return '--';
        return num.toFixed(decimals);
    }

    // ============================================
    // Forest Plot
    // ============================================

    function forestPlot(container, data, options = {}) {
        const {
            width = DEFAULTS.width,
            margin = DEFAULTS.margin,
            nullLine = 1,  // For ratios, use 1; for differences, use 0
            showWeights = true,
            showPI = true,
            sortByEffect = false,
            xLabel = 'Effect Size',
            title = 'Forest Plot',
            logScale = true,
            pooledResult = null,
            predictionInterval = null
        } = options;

        // Validate data
        if (!data || data.length === 0) {
            console.warn('Forest plot: No data provided');
            return null;
        }

        // Sort data if requested
        let sortedData = [...data];
        if (sortByEffect) {
            sortedData.sort((a, b) => a.effect - b.effect);
        }

        // Calculate dimensions
        const rowHeight = 25;
        const height = margin.top + margin.bottom + (sortedData.length + 3) * rowHeight;

        // Create SVG
        const svg = createSVG(container, width, height);

        // Calculate plot area
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        // Create scales
        let allEffects = sortedData.map(d => d.effect);
        let allLower = sortedData.map(d => d.effect - 1.96 * d.se);
        let allUpper = sortedData.map(d => d.effect + 1.96 * d.se);

        if (pooledResult) {
            allEffects.push(pooledResult.effect);
            allLower.push(pooledResult.ci.lower);
            allUpper.push(pooledResult.ci.upper);
        }

        const xMin = allLower.length > 0 ? Math.min(...allLower, Math.log(0.1)) : Math.log(0.1);
        const xMax = allUpper.length > 0 ? Math.max(...allUpper, Math.log(10)) : Math.log(10);

        const xScale = d3.scaleLinear()
            .domain([xMin * 1.1, xMax * 1.1])
            .range([0, plotWidth]);

        const yScale = d3.scalePoint()
            .domain(sortedData.map((d, i) => i))
            .range([rowHeight, plotHeight - rowHeight * 2])
            .padding(0.5);

        // Main group
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeTitle)
            .attr('font-weight', 'bold')
            .attr('fill', DEFAULTS.colors.text)
            .text(title);

        // Null line
        const nullX = xScale(logScale ? 0 : nullLine);
        g.append('line')
            .attr('x1', nullX)
            .attr('x2', nullX)
            .attr('y1', 0)
            .attr('y2', plotHeight - rowHeight)
            .attr('stroke', DEFAULTS.colors.secondary)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '5,5');

        // Study rows
        sortedData.forEach((study, i) => {
            const y = yScale(i);
            const effect = study.effect;
            const lower = effect - 1.96 * study.se;
            const upper = effect + 1.96 * study.se;

            // Study name
            g.append('text')
                .attr('x', -10)
                .attr('y', y)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', DEFAULTS.fonts.sizeMedium)
                .attr('fill', DEFAULTS.colors.text)
                .text(study.study);

            // Confidence interval line
            g.append('line')
                .attr('x1', xScale(lower))
                .attr('x2', xScale(upper))
                .attr('y1', y)
                .attr('y2', y)
                .attr('stroke', DEFAULTS.colors.primary)
                .attr('stroke-width', 2);

            // Point estimate (square sized by weight)
            const size = showWeights && study.weight ? Math.sqrt(study.weight) * 2 : 6;
            g.append('rect')
                .attr('x', xScale(effect) - size / 2)
                .attr('y', y - size / 2)
                .attr('width', size)
                .attr('height', size)
                .attr('fill', DEFAULTS.colors.primary);

            // Effect size and CI text on the right
            const effectDisplay = logScale ? Math.exp(effect).toFixed(2) : effect.toFixed(2);
            const lowerDisplay = logScale ? Math.exp(lower).toFixed(2) : lower.toFixed(2);
            const upperDisplay = logScale ? Math.exp(upper).toFixed(2) : upper.toFixed(2);

            g.append('text')
                .attr('x', plotWidth + 10)
                .attr('y', y)
                .attr('dominant-baseline', 'middle')
                .attr('font-size', DEFAULTS.fonts.sizeSmall)
                .attr('fill', DEFAULTS.colors.text)
                .text(`${effectDisplay} [${lowerDisplay}, ${upperDisplay}]`);

            // Weight percentage
            if (showWeights && study.weight) {
                g.append('text')
                    .attr('x', plotWidth + 70)
                    .attr('y', y)
                    .attr('dominant-baseline', 'middle')
                    .attr('font-size', DEFAULTS.fonts.sizeSmall)
                    .attr('fill', DEFAULTS.colors.secondary)
                    .text(`${study.weight.toFixed(1)}%`);
            }
        });

        // Pooled estimate (diamond)
        if (pooledResult) {
            const pooledY = plotHeight - rowHeight;
            const effect = pooledResult.effect;
            const lower = pooledResult.ci.lower;
            const upper = pooledResult.ci.upper;

            // Separating line
            g.append('line')
                .attr('x1', 0)
                .attr('x2', plotWidth)
                .attr('y1', pooledY - rowHeight / 2)
                .attr('y2', pooledY - rowHeight / 2)
                .attr('stroke', DEFAULTS.colors.grid)
                .attr('stroke-width', 1);

            // Diamond shape
            const diamondPoints = [
                [xScale(lower), pooledY],
                [xScale(effect), pooledY - 8],
                [xScale(upper), pooledY],
                [xScale(effect), pooledY + 8]
            ];

            g.append('polygon')
                .attr('points', diamondPoints.map(p => p.join(',')).join(' '))
                .attr('fill', DEFAULTS.colors.pooled);

            // Prediction interval
            if (showPI && predictionInterval) {
                g.append('line')
                    .attr('x1', xScale(predictionInterval.lower))
                    .attr('x2', xScale(predictionInterval.upper))
                    .attr('y1', pooledY)
                    .attr('y2', pooledY)
                    .attr('stroke', DEFAULTS.colors.prediction)
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '3,3');
            }

            // Label
            g.append('text')
                .attr('x', -10)
                .attr('y', pooledY)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', DEFAULTS.fonts.sizeMedium)
                .attr('font-weight', 'bold')
                .attr('fill', DEFAULTS.colors.pooled)
                .text('Pooled');

            // Values
            const effectDisplay = logScale ? Math.exp(effect).toFixed(2) : effect.toFixed(2);
            const lowerDisplay = logScale ? Math.exp(lower).toFixed(2) : lower.toFixed(2);
            const upperDisplay = logScale ? Math.exp(upper).toFixed(2) : upper.toFixed(2);

            g.append('text')
                .attr('x', plotWidth + 10)
                .attr('y', pooledY)
                .attr('dominant-baseline', 'middle')
                .attr('font-size', DEFAULTS.fonts.sizeSmall)
                .attr('font-weight', 'bold')
                .attr('fill', DEFAULTS.colors.pooled)
                .text(`${effectDisplay} [${lowerDisplay}, ${upperDisplay}]`);
        }

        // X-axis
        const xAxis = logScale ?
            d3.axisBottom(xScale)
                .tickValues([-2, -1, 0, 1, 2].filter(v => v >= xMin && v <= xMax))
                .tickFormat(d => Math.exp(d).toFixed(1)) :
            d3.axisBottom(xScale);

        g.append('g')
            .attr('transform', `translate(0, ${plotHeight - rowHeight / 2})`)
            .call(xAxis);

        // X-axis label
        g.append('text')
            .attr('x', plotWidth / 2)
            .attr('y', plotHeight + 35)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .attr('fill', DEFAULTS.colors.text)
            .text(xLabel);

        // Column headers
        g.append('text')
            .attr('x', plotWidth + 40)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeSmall)
            .attr('font-weight', 'bold')
            .attr('fill', DEFAULTS.colors.text)
            .text('Effect [95% CI]');

        if (showWeights) {
            g.append('text')
                .attr('x', plotWidth + 75)
                .attr('y', -10)
                .attr('text-anchor', 'start')
                .attr('font-size', DEFAULTS.fonts.sizeSmall)
                .attr('font-weight', 'bold')
                .attr('fill', DEFAULTS.colors.text)
                .text('Weight');
        }

        return svg.node();
    }

    // ============================================
    // Funnel Plot
    // ============================================

    function funnelPlot(container, data, options = {}) {
        const {
            width = DEFAULTS.width,
            height = DEFAULTS.height,
            margin = DEFAULTS.margin,
            yAxisType = 'se',  // 'se', 'var', 'invvar', 'n'
            showContour = false,
            showTrimFill = false,
            trimFillData = null,
            pooledEffect = 0,
            title = 'Funnel Plot'
        } = options;

        // Create SVG
        const svg = createSVG(container, width, height);

        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        // Calculate y-values based on type
        let yValues;
        switch (yAxisType) {
            case 'var':
                yValues = data.map(d => d.variance);
                break;
            case 'invvar':
                yValues = data.map(d => d.variance > 0 ? 1 / d.variance : 0);
                break;
            case 'n':
                yValues = data.map(d => d.n || 100);
                break;
            default:
                yValues = data.map(d => d.se);
        }

        // Scales (guard against empty arrays)
        const effects = data.map(d => d.effect);
        const xMin = effects.length > 0 ? Math.min(...effects, pooledEffect) - 0.5 : pooledEffect - 1;
        const xMax = effects.length > 0 ? Math.max(...effects, pooledEffect) + 0.5 : pooledEffect + 1;

        const xScale = d3.scaleLinear()
            .domain([xMin, xMax])
            .range([0, plotWidth]);

        const maxY = yValues.length > 0 ? Math.max(...yValues) : 1;
        const yScale = d3.scaleLinear()
            .domain([0, maxY * 1.1])
            .range([0, plotHeight]);

        // Main group
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeTitle)
            .attr('font-weight', 'bold')
            .attr('fill', DEFAULTS.colors.text)
            .text(title);

        // Contour-enhanced regions (guard against empty yValues)
        if (showContour && yValues.length > 0) {
            const maxSE = Math.max(...yValues);

            // 99% CI region
            g.append('polygon')
                .attr('points', [
                    [xScale(pooledEffect - 2.576 * maxSE), yScale(maxSE)],
                    [xScale(pooledEffect), yScale(0)],
                    [xScale(pooledEffect + 2.576 * maxSE), yScale(maxSE)]
                ].map(p => p.join(',')).join(' '))
                .attr('fill', DEFAULTS.colors.contour3);

            // 95% CI region
            g.append('polygon')
                .attr('points', [
                    [xScale(pooledEffect - 1.96 * maxSE), yScale(maxSE)],
                    [xScale(pooledEffect), yScale(0)],
                    [xScale(pooledEffect + 1.96 * maxSE), yScale(maxSE)]
                ].map(p => p.join(',')).join(' '))
                .attr('fill', DEFAULTS.colors.contour2);

            // 90% CI region
            g.append('polygon')
                .attr('points', [
                    [xScale(pooledEffect - 1.645 * maxSE), yScale(maxSE)],
                    [xScale(pooledEffect), yScale(0)],
                    [xScale(pooledEffect + 1.645 * maxSE), yScale(maxSE)]
                ].map(p => p.join(',')).join(' '))
                .attr('fill', DEFAULTS.colors.contour1);
        }

        // Pseudo 95% CI lines (guard against empty yValues)
        const maxSE = yValues.length > 0 ? Math.max(...yValues) : 1;
        g.append('line')
            .attr('x1', xScale(pooledEffect))
            .attr('y1', yScale(0))
            .attr('x2', xScale(pooledEffect - 1.96 * maxSE))
            .attr('y2', yScale(maxSE))
            .attr('stroke', DEFAULTS.colors.secondary)
            .attr('stroke-dasharray', '5,5');

        g.append('line')
            .attr('x1', xScale(pooledEffect))
            .attr('y1', yScale(0))
            .attr('x2', xScale(pooledEffect + 1.96 * maxSE))
            .attr('y2', yScale(maxSE))
            .attr('stroke', DEFAULTS.colors.secondary)
            .attr('stroke-dasharray', '5,5');

        // Vertical line at pooled effect
        g.append('line')
            .attr('x1', xScale(pooledEffect))
            .attr('x2', xScale(pooledEffect))
            .attr('y1', 0)
            .attr('y2', plotHeight)
            .attr('stroke', DEFAULTS.colors.pooled)
            .attr('stroke-width', 1);

        // Plot studies
        data.forEach((study, i) => {
            g.append('circle')
                .attr('cx', xScale(study.effect))
                .attr('cy', yScale(yValues[i]))
                .attr('r', 5)
                .attr('fill', DEFAULTS.colors.primary)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
        });

        // Trim and fill imputed studies
        if (showTrimFill && trimFillData) {
            trimFillData.imputed.forEach(study => {
                g.append('circle')
                    .attr('cx', xScale(study.effect))
                    .attr('cy', yScale(study.se))
                    .attr('r', 5)
                    .attr('fill', 'none')
                    .attr('stroke', DEFAULTS.colors.pooled)
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '3,3');
            });

            // Adjusted effect line
            g.append('line')
                .attr('x1', xScale(trimFillData.adjustedEffect))
                .attr('x2', xScale(trimFillData.adjustedEffect))
                .attr('y1', 0)
                .attr('y2', plotHeight)
                .attr('stroke', DEFAULTS.colors.prediction)
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '5,5');
        }

        // Axes
        g.append('g')
            .attr('transform', `translate(0, ${plotHeight})`)
            .call(d3.axisBottom(xScale));

        g.append('g')
            .call(d3.axisLeft(yScale).tickFormat(d => d.toFixed(2)));

        // Axis labels
        g.append('text')
            .attr('x', plotWidth / 2)
            .attr('y', plotHeight + 40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text('Effect Size');

        const yAxisLabels = {
            'se': 'Standard Error',
            'var': 'Variance',
            'invvar': 'Precision (1/Var)',
            'n': 'Sample Size'
        };

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -plotHeight / 2)
            .attr('y', -50)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text(yAxisLabels[yAxisType]);

        return svg.node();
    }

    // ============================================
    // SROC Curve
    // ============================================

    function srocCurve(container, data, options = {}) {
        const {
            width = DEFAULTS.width,
            height = DEFAULTS.height,
            margin = DEFAULTS.margin,
            pooledSens = null,
            pooledSpec = null,
            showConfidenceRegion = true,
            showPredictionRegion = true,
            title = 'SROC Curve'
        } = options;

        const svg = createSVG(container, width, height);
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeTitle)
            .attr('font-weight', 'bold')
            .text(title);

        // Scales (1-specificity on x, sensitivity on y)
        const xScale = d3.scaleLinear().domain([0, 1]).range([0, plotWidth]);
        const yScale = d3.scaleLinear().domain([0, 1]).range([plotHeight, 0]);

        // Diagonal reference line (no discrimination)
        g.append('line')
            .attr('x1', xScale(0))
            .attr('y1', yScale(0))
            .attr('x2', xScale(1))
            .attr('y2', yScale(1))
            .attr('stroke', DEFAULTS.colors.grid)
            .attr('stroke-dasharray', '5,5');

        // SROC curve (Moses-Littenberg model approximation)
        if (data && data.length >= 3) {
            // Simple SROC based on data points
            const lineGenerator = d3.line()
                .x(d => xScale(1 - d.specificity))
                .y(d => yScale(d.sensitivity))
                .curve(d3.curveMonotoneX);

            // Sort by specificity for smooth curve
            const sortedData = [...data].sort((a, b) => b.specificity - a.specificity);

            // Generate curve points
            const curvePoints = [];
            for (let fpr = 0; fpr <= 1; fpr += 0.02) {
                // Interpolate or use model
                const tpr = estimateSROC(fpr, sortedData);
                curvePoints.push({ fpr, tpr });
            }

            g.append('path')
                .datum(curvePoints)
                .attr('d', d3.line()
                    .x(d => xScale(d.fpr))
                    .y(d => yScale(d.tpr))
                    .curve(d3.curveBasis))
                .attr('fill', 'none')
                .attr('stroke', DEFAULTS.colors.primary)
                .attr('stroke-width', 2);
        }

        // Study points (sized by sample size)
        data.forEach(study => {
            const size = (study.n && study.n > 0) ? Math.sqrt(study.n) / 5 : 6;

            g.append('circle')
                .attr('cx', xScale(1 - study.specificity))
                .attr('cy', yScale(study.sensitivity))
                .attr('r', Math.max(3, Math.min(15, size)))
                .attr('fill', DEFAULTS.colors.primary)
                .attr('opacity', 0.7)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
        });

        // Summary operating point
        if (pooledSens !== null && pooledSpec !== null) {
            // Confidence region (ellipse approximation)
            if (showConfidenceRegion) {
                // Simple circular approximation
                g.append('circle')
                    .attr('cx', xScale(1 - pooledSpec))
                    .attr('cy', yScale(pooledSens))
                    .attr('r', 20)
                    .attr('fill', DEFAULTS.colors.ci)
                    .attr('stroke', DEFAULTS.colors.primary)
                    .attr('stroke-dasharray', '3,3');
            }

            // Summary point
            g.append('rect')
                .attr('x', xScale(1 - pooledSpec) - 8)
                .attr('y', yScale(pooledSens) - 8)
                .attr('width', 16)
                .attr('height', 16)
                .attr('fill', DEFAULTS.colors.pooled)
                .attr('transform', `rotate(45, ${xScale(1 - pooledSpec)}, ${yScale(pooledSens)})`);
        }

        // Axes
        g.append('g')
            .attr('transform', `translate(0, ${plotHeight})`)
            .call(d3.axisBottom(xScale).ticks(5));

        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5));

        // Axis labels
        g.append('text')
            .attr('x', plotWidth / 2)
            .attr('y', plotHeight + 40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text('1 - Specificity (False Positive Rate)');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -plotHeight / 2)
            .attr('y', -40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text('Sensitivity (True Positive Rate)');

        return svg.node();
    }

    function estimateSROC(fpr, data) {
        // Simple interpolation for SROC estimation
        if (!data || data.length === 0) return 0.5;

        let sumW = 0;
        let sumWY = 0;
        data.forEach(d => {
            const w = 1 / (1 + Math.pow(fpr - (1 - d.specificity), 2) * 100);
            sumW += w;
            sumWY += w * d.sensitivity;
        });

        const tpr = sumW > 0 ? sumWY / sumW : 0.5;
        return Math.max(0, Math.min(1, tpr));
    }

    // ============================================
    // Bubble Plot (Meta-Regression)
    // ============================================

    function bubblePlot(container, data, options = {}) {
        const {
            width = DEFAULTS.width,
            height = DEFAULTS.height,
            margin = DEFAULTS.margin,
            moderator = 'year',
            xLabel = 'Moderator',
            yLabel = 'Effect Size',
            regressionLine = null,
            title = 'Bubble Plot'
        } = options;

        const svg = createSVG(container, width, height);
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeTitle)
            .attr('font-weight', 'bold')
            .text(title);

        // Get moderator values
        const modValues = data.map(d => d[moderator]).filter(v => v !== null && !isNaN(v));
        const effects = data.map(d => d.effect);

        // Scales
        const xMin = modValues.length > 0 ? Math.min(...modValues) : 0;
        const xMax = modValues.length > 0 ? Math.max(...modValues) : 1;
        const yMin = effects.length > 0 ? Math.min(...effects) : 0;
        const yMax = effects.length > 0 ? Math.max(...effects) : 1;

        const xScale = d3.scaleLinear()
            .domain([xMin * 0.95, xMax * 1.05])
            .range([0, plotWidth]);

        const yScale = d3.scaleLinear()
            .domain([yMin - 0.5, yMax + 0.5])
            .range([plotHeight, 0]);

        // Regression line (guard against empty modValues)
        if (regressionLine && modValues.length > 0) {
            const { intercept, slope } = regressionLine;
            const x1 = Math.min(...modValues);
            const x2 = Math.max(...modValues);

            g.append('line')
                .attr('x1', xScale(x1))
                .attr('y1', yScale(intercept + slope * x1))
                .attr('x2', xScale(x2))
                .attr('y2', yScale(intercept + slope * x2))
                .attr('stroke', DEFAULTS.colors.pooled)
                .attr('stroke-width', 2);
        }

        // Plot bubbles
        data.forEach(study => {
            if (study[moderator] === null || isNaN(study[moderator])) return;

            const size = (study.weight && study.weight > 0) ? Math.sqrt(study.weight) * 2 : 8;

            g.append('circle')
                .attr('cx', xScale(study[moderator]))
                .attr('cy', yScale(study.effect))
                .attr('r', Math.max(4, Math.min(30, size)))
                .attr('fill', DEFAULTS.colors.primary)
                .attr('opacity', 0.6)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
        });

        // Axes
        g.append('g')
            .attr('transform', `translate(0, ${plotHeight})`)
            .call(d3.axisBottom(xScale));

        g.append('g')
            .call(d3.axisLeft(yScale));

        // Labels
        g.append('text')
            .attr('x', plotWidth / 2)
            .attr('y', plotHeight + 40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text(xLabel);

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -plotHeight / 2)
            .attr('y', -40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text(yLabel);

        return svg.node();
    }

    // ============================================
    // L'Abbé Plot
    // ============================================

    function labbePlot(container, data, options = {}) {
        const {
            width = DEFAULTS.width,
            height = DEFAULTS.height,
            margin = DEFAULTS.margin,
            title = "L'Abbé Plot"
        } = options;

        const svg = createSVG(container, width, height);
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeTitle)
            .attr('font-weight', 'bold')
            .text(title);

        // Scales (0 to 1 for proportions)
        const xScale = d3.scaleLinear().domain([0, 1]).range([0, plotWidth]);
        const yScale = d3.scaleLinear().domain([0, 1]).range([plotHeight, 0]);

        // Diagonal line (no effect)
        g.append('line')
            .attr('x1', xScale(0))
            .attr('y1', yScale(0))
            .attr('x2', xScale(1))
            .attr('y2', yScale(1))
            .attr('stroke', DEFAULTS.colors.grid)
            .attr('stroke-width', 1);

        // Plot studies
        data.forEach(study => {
            if (!study.a || !study.b || !study.c || !study.d) return;

            const nTreat = study.a + study.b;
            const nControl = study.c + study.d;
            const pTreatment = nTreat > 0 ? study.a / nTreat : 0;
            const pControl = nControl > 0 ? study.c / nControl : 0;
            const n = study.a + study.b + study.c + study.d;
            const radius = n > 0 ? Math.sqrt(n) / 5 : 3;

            g.append('circle')
                .attr('cx', xScale(pControl))
                .attr('cy', yScale(pTreatment))
                .attr('r', Math.max(3, radius))
                .attr('fill', pTreatment > pControl ? DEFAULTS.colors.significant : DEFAULTS.colors.nonsignificant)
                .attr('opacity', 0.6)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
        });

        // Axes
        g.append('g')
            .attr('transform', `translate(0, ${plotHeight})`)
            .call(d3.axisBottom(xScale).ticks(5));

        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5));

        // Labels
        g.append('text')
            .attr('x', plotWidth / 2)
            .attr('y', plotHeight + 40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text('Control Event Rate');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -plotHeight / 2)
            .attr('y', -40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text('Treatment Event Rate');

        return svg.node();
    }

    // ============================================
    // Radial (Galbraith) Plot
    // ============================================

    function radialPlot(container, data, options = {}) {
        const {
            width = DEFAULTS.width,
            height = DEFAULTS.height,
            margin = DEFAULTS.margin,
            pooledEffect = 0,
            title = 'Radial Plot'
        } = options;

        const svg = createSVG(container, width, height);
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeTitle)
            .attr('font-weight', 'bold')
            .text(title);

        // Calculate z-scores and precision (protect against se=0)
        const plotData = data
            .filter(d => d.se > 0)
            .map(d => ({
                precision: 1 / d.se,
                z: d.effect / d.se,
                study: d.study
            }));
        if (plotData.length === 0) {
            console.warn('Radial plot: No valid data (all SE values are zero or negative)');
            return null;
        }

        // Scales
        const maxPrec = plotData.length > 0 ? Math.max(...plotData.map(d => d.precision)) : 1;
        const xScale = d3.scaleLinear()
            .domain([0, maxPrec * 1.1])
            .range([0, plotWidth]);

        const yMin = plotData.length > 0 ? Math.min(...plotData.map(d => d.z)) : -3;
        const yMax = plotData.length > 0 ? Math.max(...plotData.map(d => d.z)) : 3;
        const yScale = d3.scaleLinear()
            .domain([Math.min(yMin, -3), Math.max(yMax, 3)])
            .range([plotHeight, 0]);

        // Regression line through origin with slope = pooled effect
        g.append('line')
            .attr('x1', xScale(0))
            .attr('y1', yScale(0))
            .attr('x2', xScale.range()[1])
            .attr('y2', yScale(pooledEffect * xScale.domain()[1]))
            .attr('stroke', DEFAULTS.colors.pooled)
            .attr('stroke-width', 2);

        // 95% confidence bands
        const scaleMaxPrec = xScale.domain()[1];
        g.append('line')
            .attr('x1', xScale(0))
            .attr('y1', yScale(0))
            .attr('x2', xScale(scaleMaxPrec))
            .attr('y2', yScale((pooledEffect + 1.96 / scaleMaxPrec) * scaleMaxPrec))
            .attr('stroke', DEFAULTS.colors.secondary)
            .attr('stroke-dasharray', '5,5');

        g.append('line')
            .attr('x1', xScale(0))
            .attr('y1', yScale(0))
            .attr('x2', xScale(scaleMaxPrec))
            .attr('y2', yScale((pooledEffect - 1.96 / scaleMaxPrec) * scaleMaxPrec))
            .attr('stroke', DEFAULTS.colors.secondary)
            .attr('stroke-dasharray', '5,5');

        // Plot points
        plotData.forEach(d => {
            g.append('circle')
                .attr('cx', xScale(d.precision))
                .attr('cy', yScale(d.z))
                .attr('r', 5)
                .attr('fill', DEFAULTS.colors.primary)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
        });

        // Axes
        g.append('g')
            .attr('transform', `translate(0, ${plotHeight})`)
            .call(d3.axisBottom(xScale));

        g.append('g')
            .call(d3.axisLeft(yScale));

        // Labels
        g.append('text')
            .attr('x', plotWidth / 2)
            .attr('y', plotHeight + 40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text('Precision (1/SE)');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -plotHeight / 2)
            .attr('y', -40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text('Standardized Effect (z)');

        return svg.node();
    }

    // ============================================
    // Calibration Plot
    // ============================================

    function calibrationPlot(container, data, options = {}) {
        const {
            width = DEFAULTS.width,
            height = DEFAULTS.height,
            margin = DEFAULTS.margin,
            title = 'Calibration Plot'
        } = options;

        const svg = createSVG(container, width, height);
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeTitle)
            .attr('font-weight', 'bold')
            .text(title);

        // Scales
        const xScale = d3.scaleLinear().domain([0, 1]).range([0, plotWidth]);
        const yScale = d3.scaleLinear().domain([0, 1]).range([plotHeight, 0]);

        // Perfect calibration line
        g.append('line')
            .attr('x1', xScale(0))
            .attr('y1', yScale(0))
            .attr('x2', xScale(1))
            .attr('y2', yScale(1))
            .attr('stroke', DEFAULTS.colors.grid)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '5,5');

        // Calibration data (deciles)
        if (data.deciles) {
            const line = d3.line()
                .x(d => xScale(d.predicted))
                .y(d => yScale(d.observed))
                .curve(d3.curveMonotoneX);

            g.append('path')
                .datum(data.deciles)
                .attr('d', line)
                .attr('fill', 'none')
                .attr('stroke', DEFAULTS.colors.primary)
                .attr('stroke-width', 2);

            // Points
            data.deciles.forEach(d => {
                g.append('circle')
                    .attr('cx', xScale(d.predicted))
                    .attr('cy', yScale(d.observed))
                    .attr('r', 6)
                    .attr('fill', DEFAULTS.colors.primary);
            });
        }

        // Axes
        g.append('g')
            .attr('transform', `translate(0, ${plotHeight})`)
            .call(d3.axisBottom(xScale).ticks(5));

        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5));

        // Labels
        g.append('text')
            .attr('x', plotWidth / 2)
            .attr('y', plotHeight + 40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text('Predicted Probability');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -plotHeight / 2)
            .attr('y', -40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text('Observed Probability');

        return svg.node();
    }

    // ============================================
    // P-Curve Plot
    // ============================================

    function pCurvePlot(container, pValues, options = {}) {
        const {
            width = DEFAULTS.width,
            height = 300,
            margin = { top: 40, right: 40, bottom: 60, left: 60 },
            title = 'P-Curve'
        } = options;

        const svg = createSVG(container, width, height);
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeTitle)
            .attr('font-weight', 'bold')
            .text(title);

        // Filter significant p-values
        const sigP = pValues.filter(p => p < 0.05 && p > 0);

        // Create bins
        const bins = [0, 0.01, 0.02, 0.03, 0.04, 0.05];
        const counts = bins.slice(0, -1).map((b, i) =>
            sigP.filter(p => p >= b && p < bins[i + 1]).length
        );

        // Scales
        const xScale = d3.scaleBand()
            .domain(['0.00-0.01', '0.01-0.02', '0.02-0.03', '0.03-0.04', '0.04-0.05'])
            .range([0, plotWidth])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, Math.max(...counts, 1) * 1.2])
            .range([plotHeight, 0]);

        // Expected under null (uniform)
        const expected = sigP.length / 5;
        g.append('line')
            .attr('x1', 0)
            .attr('y1', yScale(expected))
            .attr('x2', plotWidth)
            .attr('y2', yScale(expected))
            .attr('stroke', DEFAULTS.colors.secondary)
            .attr('stroke-dasharray', '5,5');

        // Bars
        const binLabels = ['0.00-0.01', '0.01-0.02', '0.02-0.03', '0.03-0.04', '0.04-0.05'];
        counts.forEach((count, i) => {
            g.append('rect')
                .attr('x', xScale(binLabels[i]))
                .attr('y', yScale(count))
                .attr('width', xScale.bandwidth())
                .attr('height', plotHeight - yScale(count))
                .attr('fill', DEFAULTS.colors.primary);
        });

        // Axes
        g.append('g')
            .attr('transform', `translate(0, ${plotHeight})`)
            .call(d3.axisBottom(xScale));

        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5));

        // Labels
        g.append('text')
            .attr('x', plotWidth / 2)
            .attr('y', plotHeight + 45)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text('P-value Range');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -plotHeight / 2)
            .attr('y', -40)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text('Count');

        return svg.node();
    }

    // ============================================
    // Bayesian Trace/Density Plots
    // ============================================

    function tracePlot(container, samples, options = {}) {
        // Guard against empty samples
        if (!samples || samples.length === 0) return null;

        const {
            width = DEFAULTS.width,
            height = 200,
            margin = { top: 30, right: 20, bottom: 40, left: 60 },
            parameter = 'μ',
            chains = null
        } = options;

        const svg = createSVG(container, width, height);
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeLarge)
            .attr('font-weight', 'bold')
            .text(`Trace: ${parameter}`);

        // Scales
        const xScale = d3.scaleLinear()
            .domain([0, samples.length])
            .range([0, plotWidth]);

        const yScale = d3.scaleLinear()
            .domain([Math.min(...samples), Math.max(...samples)])
            .range([plotHeight, 0]);

        // Line
        const line = d3.line()
            .x((d, i) => xScale(i))
            .y(d => yScale(d));

        g.append('path')
            .datum(samples)
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', DEFAULTS.colors.primary)
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.7);

        // Axes
        g.append('g')
            .attr('transform', `translate(0, ${plotHeight})`)
            .call(d3.axisBottom(xScale).ticks(5));

        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5));

        return svg.node();
    }

    function densityPlot(container, samples, options = {}) {
        // Guard against empty samples
        if (!samples || samples.length === 0) return null;

        const {
            width = DEFAULTS.width,
            height = 200,
            margin = { top: 30, right: 20, bottom: 40, left: 60 },
            parameter = 'μ',
            showCI = true
        } = options;

        const svg = createSVG(container, width, height);
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeLarge)
            .attr('font-weight', 'bold')
            .text(`Posterior: ${parameter}`);

        // Kernel density estimation
        const kde = kernelDensityEstimator(
            kernelEpanechnikov(0.5),
            d3.range(Math.min(...samples) - 1, Math.max(...samples) + 1, 0.1)
        );
        const density = kde(samples);

        // Scales
        const xScale = d3.scaleLinear()
            .domain([Math.min(...samples) - 1, Math.max(...samples) + 1])
            .range([0, plotWidth]);

        const maxDensity = density.length > 0 ? Math.max(...density.map(d => d[1])) : 1;
        const yScale = d3.scaleLinear()
            .domain([0, maxDensity])
            .range([plotHeight, 0]);

        // CI shading
        if (showCI) {
            const sorted = [...samples].sort((a, b) => a - b);
            const ci = {
                lower: sorted[Math.floor(samples.length * 0.025)],
                upper: sorted[Math.floor(samples.length * 0.975)]
            };

            const ciArea = d3.area()
                .x(d => xScale(d[0]))
                .y0(plotHeight)
                .y1(d => yScale(d[1]));

            g.append('path')
                .datum(density.filter(d => d[0] >= ci.lower && d[0] <= ci.upper))
                .attr('d', ciArea)
                .attr('fill', DEFAULTS.colors.ci);
        }

        // Density curve
        const line = d3.line()
            .x(d => xScale(d[0]))
            .y(d => yScale(d[1]))
            .curve(d3.curveBasis);

        g.append('path')
            .datum(density)
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', DEFAULTS.colors.primary)
            .attr('stroke-width', 2);

        // Axes
        g.append('g')
            .attr('transform', `translate(0, ${plotHeight})`)
            .call(d3.axisBottom(xScale));

        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5));

        return svg.node();
    }

    function kernelDensityEstimator(kernel, X) {
        return function(V) {
            return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
        };
    }

    function kernelEpanechnikov(k) {
        return function(v) {
            return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
        };
    }

    // ============================================
    // Dose-Response Curve Plot
    // ============================================

    /**
     * Dose-response curve plot with confidence bands
     * Displays fitted curve with study-level data points
     *
     * @param {string|Element} container - Container element or selector
     * @param {Object} result - Result from doseResponseMA or bayesianDoseResponse
     * @param {Array} studyData - Original study-level data points
     * @param {Object} options - Plot options
     * @returns {SVGElement} - The created SVG element
     */
    function doseResponsePlot(container, result, studyData = [], options = {}) {
        const {
            width = DEFAULTS.width,
            height = 500,
            margin = { top: 50, right: 60, bottom: 80, left: 80 },
            xLabel = 'Dose',
            yLabel = 'log(Relative Risk)',
            title = 'Dose-Response Curve',
            showCI = true,
            showStudyPoints = true,
            showReference = true,
            logYScale = false,
            curveColor = DEFAULTS.colors.primary,
            ciColor = 'rgba(37, 99, 235, 0.2)',
            studyColor = DEFAULTS.colors.secondary,
            referenceValue = 0
        } = options;

        // Create SVG
        const svg = createSVG(container, width, height);

        // Calculate plot area
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        // Get curve data
        let curve = result.predictionCurve || [];

        // Filter out any NaN values
        curve = curve.filter(d => !isNaN(d.dose) && !isNaN(d.effect));

        if (curve.length === 0) {
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .text('No dose-response curve data available');
            return svg.node();
        }

        // Calculate domains with safety checks
        const xMin = d3.min(curve, d => d.dose) || 0;
        const xMax = d3.max(curve, d => d.dose) || 10;
        const xDomain = [xMin, xMax];

        let yMin = d3.min(curve, d => {
            if (d.ci && !isNaN(d.ci[0])) return d.ci[0];
            return d.effect;
        });
        let yMax = d3.max(curve, d => {
            if (d.ci && !isNaN(d.ci[1])) return d.ci[1];
            return d.effect;
        });

        // Include study points in domain if available
        if (studyData && studyData.length > 0) {
            const studyEffects = studyData
                .filter(d => !isNaN(d.yi) && d.yi !== undefined)
                .map(d => d.yi);
            if (studyEffects.length > 0) {
                const studyMin = d3.min(studyEffects);
                const studyMax = d3.max(studyEffects);
                if (!isNaN(studyMin)) yMin = Math.min(yMin, studyMin);
                if (!isNaN(studyMax)) yMax = Math.max(yMax, studyMax);
            }
        }

        // Ensure valid y domain
        if (isNaN(yMin) || isNaN(yMax)) {
            yMin = -1;
            yMax = 1;
        }

        // Add padding
        const yPad = Math.max((yMax - yMin) * 0.1, 0.1);
        const yDomain = [yMin - yPad, yMax + yPad];

        // Create scales
        const xScale = d3.scaleLinear()
            .domain(xDomain)
            .range([0, plotWidth]);

        const yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([plotHeight, 0]);

        // Create main group
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 25)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeTitle)
            .attr('font-weight', 'bold')
            .attr('font-family', DEFAULTS.fonts.family)
            .text(title);

        // Add subtitle with model info
        if (result.model) {
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', 42)
                .attr('text-anchor', 'middle')
                .attr('font-size', DEFAULTS.fonts.sizeSmall)
                .attr('font-family', DEFAULTS.fonts.family)
                .attr('fill', DEFAULTS.colors.secondary)
                .text(`Model: ${result.model}${result.nStudies ? `, ${result.nStudies} studies, ${result.nPoints} data points` : ''}`);
        }

        // Draw reference line (null effect)
        if (showReference) {
            g.append('line')
                .attr('x1', 0)
                .attr('x2', plotWidth)
                .attr('y1', yScale(referenceValue))
                .attr('y2', yScale(referenceValue))
                .attr('stroke', DEFAULTS.colors.axis)
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '4,4');
        }

        // Draw confidence band
        if (showCI && curve[0].ci) {
            const area = d3.area()
                .x(d => xScale(d.dose))
                .y0(d => yScale(d.ci[0]))
                .y1(d => yScale(d.ci[1]))
                .curve(d3.curveBasis);

            g.append('path')
                .datum(curve)
                .attr('d', area)
                .attr('fill', ciColor)
                .attr('stroke', 'none');
        }

        // Add visible background for debugging
        g.append('rect')
            .attr('width', plotWidth)
            .attr('height', plotHeight)
            .attr('fill', '#f8fafc')
            .attr('stroke', '#e2e8f0');

        // Draw main curve
        const line = d3.line()
            .x(d => xScale(d.dose))
            .y(d => yScale(d.effect))
            .curve(d3.curveBasis);

        const pathData = line(curve);
        console.log('DR Viz: Path data length:', pathData?.length, 'First 200 chars:', pathData?.substring(0, 200));
        console.log('DR Viz: Scale domains - X:', xScale.domain(), 'Y:', yScale.domain());
        console.log('DR Viz: First curve point:', curve[0], '-> x:', xScale(curve[0]?.dose), 'y:', yScale(curve[0]?.effect));

        g.append('path')
            .datum(curve)
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', curveColor)
            .attr('stroke-width', 3);

        // Draw study points
        if (showStudyPoints && studyData && studyData.length > 0) {
            // Filter valid study data
            const validStudyData = studyData.filter(d =>
                !isNaN(d.dose) && !isNaN(d.yi) && d.yi !== undefined
            );

            if (validStudyData.length > 0) {
                // Calculate weights for bubble sizes
                const weights = validStudyData.map(d => 1 / (d.vi || d.se * d.se || 1));
                const maxWeight = d3.max(weights) || 1;
                const minRadius = 4;
                const maxRadius = 15;

                g.selectAll('.study-point')
                    .data(validStudyData)
                    .enter()
                    .append('circle')
                    .attr('class', 'study-point')
                    .attr('cx', d => xScale(d.dose))
                    .attr('cy', d => yScale(d.yi))
                    .attr('r', (d, i) => {
                        const w = weights[i] / maxWeight;
                        return minRadius + (maxRadius - minRadius) * Math.sqrt(w);
                    })
                    .attr('fill', studyColor)
                    .attr('fill-opacity', 0.5)
                    .attr('stroke', studyColor)
                    .attr('stroke-width', 1);

                // Add study labels on hover (tooltip effect)
                g.selectAll('.study-point')
                    .on('mouseover', function(event, d) {
                        const point = d3.select(this);
                        point.attr('fill-opacity', 0.8);

                        // Add tooltip
                        const tooltip = g.append('g')
                            .attr('class', 'tooltip');

                        tooltip.append('rect')
                            .attr('x', xScale(d.dose) + 10)
                            .attr('y', yScale(d.yi) - 25)
                            .attr('width', 120)
                            .attr('height', 40)
                            .attr('fill', 'white')
                            .attr('stroke', '#ccc')
                            .attr('rx', 4);

                        tooltip.append('text')
                            .attr('x', xScale(d.dose) + 15)
                            .attr('y', yScale(d.yi) - 10)
                            .attr('font-size', 10)
                            .text(`${d.study || 'Study'}`);

                        tooltip.append('text')
                            .attr('x', xScale(d.dose) + 15)
                            .attr('y', yScale(d.yi) + 5)
                            .attr('font-size', 10)
                            .text(`Dose: ${d.dose.toFixed(2)}, Effect: ${d.yi.toFixed(3)}`);
                    })
                    .on('mouseout', function() {
                        d3.select(this).attr('fill-opacity', 0.5);
                        g.selectAll('.tooltip').remove();
                    });
            }
        }

        // X-axis
        g.append('g')
            .attr('transform', `translate(0, ${plotHeight})`)
            .call(d3.axisBottom(xScale).ticks(10))
            .append('text')
            .attr('x', plotWidth / 2)
            .attr('y', 45)
            .attr('fill', DEFAULTS.colors.text)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text(xLabel);

        // Y-axis
        g.append('g')
            .call(d3.axisLeft(yScale).ticks(8))
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -plotHeight / 2)
            .attr('y', -55)
            .attr('fill', DEFAULTS.colors.text)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeMedium)
            .text(yLabel);

        // Add coefficient info box
        if (result.coefficients && result.coefficients.length > 0) {
            const infoBox = svg.append('g')
                .attr('transform', `translate(${width - margin.right - 150}, ${margin.top + 10})`);

            infoBox.append('rect')
                .attr('width', 140)
                .attr('height', 20 + result.coefficients.length * 15)
                .attr('fill', 'white')
                .attr('stroke', '#ddd')
                .attr('rx', 4);

            infoBox.append('text')
                .attr('x', 10)
                .attr('y', 15)
                .attr('font-size', 10)
                .attr('font-weight', 'bold')
                .text('Coefficients:');

            result.coefficients.forEach((coef, i) => {
                const est = coef.estimate !== undefined ? coef.estimate : coef.mean;
                const se = coef.se !== undefined ? coef.se : coef.sd;
                infoBox.append('text')
                    .attr('x', 10)
                    .attr('y', 30 + i * 15)
                    .attr('font-size', 9)
                    .text(`${coef.name}: ${formatNumber(est, 4)} (${formatNumber(se, 4)})`);
            });
        }

        return svg.node();
    }

    /**
     * Dose-response model comparison plot
     * Shows multiple models overlaid for comparison
     */
    function doseResponseComparisonPlot(container, modelResults, studyData = [], options = {}) {
        const {
            width = DEFAULTS.width,
            height = 500,
            margin = { top: 50, right: 180, bottom: 80, left: 80 },
            xLabel = 'Dose',
            yLabel = 'log(Relative Risk)',
            title = 'Dose-Response Model Comparison',
            showStudies = true
        } = options;

        // Model colors
        const modelColors = [
            '#2563eb',  // blue
            '#dc2626',  // red
            '#16a34a',  // green
            '#9333ea',  // purple
            '#f59e0b',  // amber
            '#06b6d4'   // cyan
        ];

        // Create SVG
        const svg = createSVG(container, width, height);
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        // Calculate domains from all curves
        let allDoses = [];
        let allEffects = [];

        modelResults.forEach(r => {
            const curve = r.predictionCurve || [];
            curve.forEach(d => {
                allDoses.push(d.dose);
                allEffects.push(d.effect);
                if (d.ci) {
                    allEffects.push(d.ci[0], d.ci[1]);
                }
            });
        });

        if (studyData && studyData.length > 0) {
            studyData.forEach(d => {
                allDoses.push(d.dose);
                allEffects.push(d.yi || d.effect);
            });
        }

        const xScale = d3.scaleLinear()
            .domain([d3.min(allDoses), d3.max(allDoses)])
            .range([0, plotWidth]);

        const yPad = (d3.max(allEffects) - d3.min(allEffects)) * 0.1;
        const yScale = d3.scaleLinear()
            .domain([d3.min(allEffects) - yPad, d3.max(allEffects) + yPad])
            .range([plotHeight, 0]);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 25)
            .attr('text-anchor', 'middle')
            .attr('font-size', DEFAULTS.fonts.sizeTitle)
            .attr('font-weight', 'bold')
            .text(title);

        // Reference line
        g.append('line')
            .attr('x1', 0)
            .attr('x2', plotWidth)
            .attr('y1', yScale(0))
            .attr('y2', yScale(0))
            .attr('stroke', '#888')
            .attr('stroke-dasharray', '4,4');

        // Draw study points first (background)
        if (showStudies && studyData && studyData.length > 0) {
            g.selectAll('.study-point')
                .data(studyData)
                .enter()
                .append('circle')
                .attr('cx', d => xScale(d.dose))
                .attr('cy', d => yScale(d.yi || d.effect))
                .attr('r', 5)
                .attr('fill', '#999')
                .attr('fill-opacity', 0.4);
        }

        // Draw each model curve
        const line = d3.line()
            .x(d => xScale(d.dose))
            .y(d => yScale(d.effect))
            .curve(d3.curveBasis);

        modelResults.forEach((r, i) => {
            const curve = r.predictionCurve || [];
            const color = modelColors[i % modelColors.length];

            g.append('path')
                .datum(curve)
                .attr('d', line)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', 2);
        });

        // Axes
        g.append('g')
            .attr('transform', `translate(0, ${plotHeight})`)
            .call(d3.axisBottom(xScale))
            .append('text')
            .attr('x', plotWidth / 2)
            .attr('y', 45)
            .attr('fill', 'black')
            .attr('text-anchor', 'middle')
            .text(xLabel);

        g.append('g')
            .call(d3.axisLeft(yScale))
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -plotHeight / 2)
            .attr('y', -55)
            .attr('fill', 'black')
            .attr('text-anchor', 'middle')
            .text(yLabel);

        // Legend
        const legend = svg.append('g')
            .attr('transform', `translate(${width - margin.right + 10}, ${margin.top + 20})`);

        legend.append('text')
            .attr('font-weight', 'bold')
            .attr('font-size', 11)
            .text('Models:');

        modelResults.forEach((r, i) => {
            const color = modelColors[i % modelColors.length];
            const y = 20 + i * 25;

            legend.append('line')
                .attr('x1', 0)
                .attr('x2', 30)
                .attr('y1', y)
                .attr('y2', y)
                .attr('stroke', color)
                .attr('stroke-width', 2);

            const modelName = r.model || `Model ${i + 1}`;
            const aic = r.AIC !== undefined ? ` (AIC: ${r.AIC.toFixed(1)})` : '';

            legend.append('text')
                .attr('x', 35)
                .attr('y', y + 4)
                .attr('font-size', 10)
                .text(modelName + aic);
        });

        return svg.node();
    }

    // ============================================
    // Export Functions
    // ============================================

    function exportSVG(svgNode) {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgNode);
        return svgString;
    }

    function exportPNG(svgNode, callback) {
        const svgString = exportSVG(svgNode);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.onload = function() {
            canvas.width = img.width * 2;  // High DPI
            canvas.height = img.height * 2;
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0);
            callback(canvas.toDataURL('image/png'));
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
    }

    // ============================================
    // Public API
    // ============================================

    return {
        // Main plots
        forestPlot,
        funnelPlot,
        srocCurve,
        bubblePlot,
        labbePlot,
        radialPlot,
        calibrationPlot,
        pCurvePlot,

        // Dose-response plots
        doseResponsePlot,
        doseResponseComparisonPlot,

        // Bayesian plots
        tracePlot,
        densityPlot,

        // Export
        exportSVG,
        exportPNG,

        // Settings
        DEFAULTS
    };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Visualization;
}
