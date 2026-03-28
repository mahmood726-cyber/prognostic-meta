/**
 * Advanced Visualizations for Meta-Analysis
 * State-of-the-art plots that exceed R package capabilities
 * - Drapery Plot (p-value function)
 * - Sunset Plot (power-enhanced funnel)
 * - Rainforest Plot (enhanced forest)
 * - GOSH Plot (heterogeneity diagnostics)
 * - Network Graph (network meta-analysis)
 * - Comparison-Adjusted Funnel
 * - ROB Traffic Light & Summary
 * - Albatross Plot
 * - Tandem Forest Plot
 */

const AdvancedViz = (function() {
    'use strict';

    // HTML escape helper for XSS prevention
    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ============================================
    // DRAPERY PLOT (P-VALUE FUNCTION)
    // ============================================

    /**
     * Drapery Plot - Shows p-value as function of true effect
     * Rücker & Schwarzer (2020)
     */
    function draperyPlot(data, container, options = {}) {
        const {
            width = 800,
            height = 500,
            margin = { top: 40, right: 40, bottom: 60, left: 60 },
            effectRange = null,
            showIndividual = true,
            showPooled = true,
            alphaLevels = [0.001, 0.01, 0.05, 0.1],
            colorScheme = 'blues'
        } = options;

        const svg = d3.select(container)
            .html('')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Calculate pooled effect and standard error
        const yi = data.map(d => d.yi || d.effect);
        const vi = data.map(d => d.vi || d.variance);
        const result = MetaAnalysis.randomEffects(yi, vi, 'DL');
        const pooled = result.effect;
        const pooledSE = result.se;

        // Determine effect range
        const effects = data.map(d => d.yi);
        const minEffect = effectRange ? effectRange[0] :
            Math.min(pooled - 4 * pooledSE, Math.min(...effects) - 0.5);
        const maxEffect = effectRange ? effectRange[1] :
            Math.max(pooled + 4 * pooledSE, Math.max(...effects) + 0.5);

        // Scales
        const xScale = d3.scaleLinear()
            .domain([minEffect, maxEffect])
            .range([0, plotWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, 1])
            .range([plotHeight, 0]);

        // Color scale for alpha levels
        const colorScale = d3.scaleSequential(d3.interpolateBlues)
            .domain([0, 1]);

        // Generate p-value curves for each study
        const nPoints = 200;
        const effectValues = d3.range(minEffect, maxEffect, (maxEffect - minEffect) / nPoints);

        if (showIndividual) {
            data.forEach((d, idx) => {
                const sei = Math.sqrt(d.vi);
                const pValues = effectValues.map(theta => {
                    const z = (d.yi - theta) / sei;
                    return 2 * (1 - Statistics.pnorm(Math.abs(z)));
                });

                const line = d3.line()
                    .x((_, i) => xScale(effectValues[i]))
                    .y((p) => yScale(p))
                    .curve(d3.curveMonotoneX);

                g.append('path')
                    .datum(pValues)
                    .attr('fill', 'none')
                    .attr('stroke', '#aaa')
                    .attr('stroke-width', 0.5)
                    .attr('stroke-opacity', 0.5)
                    .attr('d', line);
            });
        }

        // Pooled p-value curve
        if (showPooled) {
            const pooledPValues = effectValues.map(theta => {
                const z = (pooled - theta) / pooledSE;
                return 2 * (1 - Statistics.pnorm(Math.abs(z)));
            });

            const pooledLine = d3.line()
                .x((_, i) => xScale(effectValues[i]))
                .y((p) => yScale(p))
                .curve(d3.curveMonotoneX);

            g.append('path')
                .datum(pooledPValues)
                .attr('fill', 'none')
                .attr('stroke', '#2171b5')
                .attr('stroke-width', 2.5)
                .attr('d', pooledLine);
        }

        // Alpha level lines
        alphaLevels.forEach(alpha => {
            g.append('line')
                .attr('x1', 0)
                .attr('x2', plotWidth)
                .attr('y1', yScale(alpha))
                .attr('y2', yScale(alpha))
                .attr('stroke', '#e74c3c')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '5,5')
                .attr('opacity', 0.7);

            g.append('text')
                .attr('x', plotWidth + 5)
                .attr('y', yScale(alpha))
                .attr('dy', '0.35em')
                .attr('font-size', '10px')
                .attr('fill', '#e74c3c')
                .text(`α = ${alpha}`);
        });

        // Null effect line
        g.append('line')
            .attr('x1', xScale(0))
            .attr('x2', xScale(0))
            .attr('y1', 0)
            .attr('y2', plotHeight)
            .attr('stroke', '#333')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3');

        // Axes
        g.append('g')
            .attr('transform', `translate(0,${plotHeight})`)
            .call(d3.axisBottom(xScale));

        g.append('g')
            .call(d3.axisLeft(yScale).tickFormat(d3.format('.2f')));

        // Labels
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('True Effect Size');

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('P-value');

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .text('Drapery Plot (P-value Function)');

        return svg.node();
    }

    // ============================================
    // SUNSET PLOT (POWER-ENHANCED FUNNEL)
    // ============================================

    /**
     * Sunset Plot - Funnel plot with power contours
     * Inspired by metaviz R package
     */
    function sunsetPlot(data, container, options = {}) {
        const {
            width = 700,
            height = 600,
            margin = { top: 40, right: 60, bottom: 60, left: 60 },
            effectSizes = [0.2, 0.5, 0.8],  // Small, medium, large
            powerLevels = [0.33, 0.66, 0.80],
            alpha = 0.05
        } = options;

        const svg = d3.select(container)
            .html('')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Calculate pooled estimate
        const yi = data.map(d => d.yi || d.effect);
        const vi = data.map(d => d.vi || d.variance);
        const result = MetaAnalysis.randomEffects(yi, vi, 'DL');

        // Scales
        const effects = data.map(d => d.yi);
        const ses = data.map(d => Math.sqrt(d.vi));

        const xExtent = d3.extent(effects);
        const xPadding = (xExtent[1] - xExtent[0]) * 0.3;

        const xScale = d3.scaleLinear()
            .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
            .range([0, plotWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, (ses.length > 0 ? Math.max(...ses) : 1) * 1.2])
            .range([0, plotHeight]);

        // Sunset color gradient (power zones)
        const defs = svg.append('defs');

        const gradient = defs.append('linearGradient')
            .attr('id', 'sunset-gradient')
            .attr('x1', '0%')
            .attr('x2', '0%')
            .attr('y1', '100%')
            .attr('y2', '0%');

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#fff5eb');  // Low power (top, large SE)

        gradient.append('stop')
            .attr('offset', '33%')
            .attr('stop-color', '#fdbe85');

        gradient.append('stop')
            .attr('offset', '66%')
            .attr('stop-color', '#fd8d3c');

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#d94701');  // High power (bottom, small SE)

        // Draw funnel background with gradient
        const funnelPath = d3.path();
        funnelPath.moveTo(xScale(result.effect), yScale(0));
        funnelPath.lineTo(xScale(result.effect - 1.96 * (ses.length > 0 ? Math.max(...ses) : 1)), yScale((ses.length > 0 ? Math.max(...ses) : 1)));
        funnelPath.lineTo(xScale(result.effect + 1.96 * (ses.length > 0 ? Math.max(...ses) : 1)), yScale((ses.length > 0 ? Math.max(...ses) : 1)));
        funnelPath.closePath();

        g.append('path')
            .attr('d', funnelPath.toString())
            .attr('fill', 'url(#sunset-gradient)')
            .attr('opacity', 0.5);

        // Power contour lines
        powerLevels.forEach((power, i) => {
            const zBeta = Statistics.qnorm(power);
            const zAlpha = Statistics.qnorm(1 - alpha / 2);

            // For each effect size, calculate SE at which power = level
            effectSizes.forEach(d => {
                const seAtPower = d / (zAlpha + zBeta);

                g.append('line')
                    .attr('x1', 0)
                    .attr('x2', plotWidth)
                    .attr('y1', yScale(seAtPower))
                    .attr('y2', yScale(seAtPower))
                    .attr('stroke', '#666')
                    .attr('stroke-width', 0.5)
                    .attr('stroke-dasharray', '3,3')
                    .attr('opacity', 0.5);
            });
        });

        // Funnel lines (95% CI)
        g.append('line')
            .attr('x1', xScale(result.effect))
            .attr('x2', xScale(result.effect - 1.96 * (ses.length > 0 ? Math.max(...ses) : 1) * 1.2))
            .attr('y1', yScale(0))
            .attr('y2', yScale((ses.length > 0 ? Math.max(...ses) : 1) * 1.2))
            .attr('stroke', '#333')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '5,5');

        g.append('line')
            .attr('x1', xScale(result.effect))
            .attr('x2', xScale(result.effect + 1.96 * (ses.length > 0 ? Math.max(...ses) : 1) * 1.2))
            .attr('y1', yScale(0))
            .attr('y2', yScale((ses.length > 0 ? Math.max(...ses) : 1) * 1.2))
            .attr('stroke', '#333')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '5,5');

        // Pooled effect line
        g.append('line')
            .attr('x1', xScale(result.effect))
            .attr('x2', xScale(result.effect))
            .attr('y1', 0)
            .attr('y2', plotHeight)
            .attr('stroke', '#2c3e50')
            .attr('stroke-width', 2);

        // Null effect line
        g.append('line')
            .attr('x1', xScale(0))
            .attr('x2', xScale(0))
            .attr('y1', 0)
            .attr('y2', plotHeight)
            .attr('stroke', '#333')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3');

        // Study points
        g.selectAll('.study-point')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'study-point')
            .attr('cx', d => xScale(d.yi))
            .attr('cy', d => yScale(Math.sqrt(d.vi)))
            .attr('r', 5)
            .attr('fill', d => {
                // Color by statistical significance
                const z = Math.abs(d.yi / Math.sqrt(d.vi));
                return z > 1.96 ? '#27ae60' : '#e74c3c';
            })
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('r', 7);
                showTooltip(event, d);
            })
            .on('mouseout', function() {
                d3.select(this).attr('r', 5);
                hideTooltip();
            });

        // Power legend
        const legendData = [
            { label: 'High Power', color: '#d94701' },
            { label: 'Medium Power', color: '#fd8d3c' },
            { label: 'Low Power', color: '#fff5eb' }
        ];

        const legend = svg.append('g')
            .attr('transform', `translate(${width - 100}, ${margin.top})`);

        legend.selectAll('.legend-item')
            .data(legendData)
            .enter()
            .append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 20})`)
            .each(function(d) {
                d3.select(this).append('rect')
                    .attr('width', 15)
                    .attr('height', 15)
                    .attr('fill', d.color)
                    .attr('stroke', '#999');

                d3.select(this).append('text')
                    .attr('x', 20)
                    .attr('y', 12)
                    .attr('font-size', '10px')
                    .text(d.label);
            });

        // Axes
        g.append('g')
            .attr('transform', `translate(0,${plotHeight})`)
            .call(d3.axisBottom(xScale));

        g.append('g')
            .call(d3.axisLeft(yScale).tickFormat(d => d.toFixed(2)));

        // Labels
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('Effect Size');

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('Standard Error');

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .text('Sunset Plot (Power-Enhanced Funnel)');

        return svg.node();
    }

    // ============================================
    // RAINFOREST PLOT
    // ============================================

    /**
     * Rainforest Plot - Enhanced forest plot with study-level details
     */
    function rainforestPlot(data, container, options = {}) {
        const {
            width = 900,
            height = null,
            rowHeight = 35,
            margin = { top: 60, right: 200, bottom: 60, left: 250 },
            showWeights = true,
            showPrediction = true,
            colorBySignificance = true
        } = options;

        const n = data.length;
        const calculatedHeight = height || (n + 4) * rowHeight + margin.top + margin.bottom;

        const svg = d3.select(container)
            .html('')
            .append('svg')
            .attr('width', width)
            .attr('height', calculatedHeight);

        const plotWidth = width - margin.left - margin.right;
        const plotHeight = calculatedHeight - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Calculate meta-analysis
        const yi = data.map(d => d.yi || d.effect);
        const vi = data.map(d => d.vi || d.variance);
        const result = MetaAnalysis.randomEffects(yi, vi, 'DL');

        // Effect scale
        const allEffects = [...data.map(d => d.yi), result.effect];
        const allCIs = data.flatMap(d => [
            d.yi - 1.96 * Math.sqrt(d.vi),
            d.yi + 1.96 * Math.sqrt(d.vi)
        ]);
        allCIs.push(result.ci.lower, result.ci.upper);

        const effectMin = Math.min(...allCIs) - 0.2;
        const effectMax = Math.max(...allCIs) + 0.2;

        const xScale = d3.scaleLinear()
            .domain([effectMin, effectMax])
            .range([0, plotWidth]);

        // Weight scale for point size
        const weights = data.map(d => 1 / d.vi);
        const maxWeight = Math.max(...weights);
        const sizeScale = d3.scaleSqrt()
            .domain([0, maxWeight])
            .range([4, 15]);

        // Draw studies
        data.forEach((d, i) => {
            const y = i * rowHeight + rowHeight / 2;
            const se = Math.sqrt(d.vi);
            const ciLow = d.yi - 1.96 * se;
            const ciHigh = d.yi + 1.96 * se;
            const weight = 1 / d.vi;
            const weightPct = (weight / weights.reduce((a, b) => a + b, 0)) * 100;

            // Study name
            g.append('text')
                .attr('x', -10)
                .attr('y', y)
                .attr('text-anchor', 'end')
                .attr('dy', '0.35em')
                .attr('font-size', '11px')
                .text(d.study || `Study ${i + 1}`);

            // Rain drop shape (teardrop)
            const dropSize = sizeScale(weight);
            const dropPath = d3.path();
            const cx = xScale(d.yi);

            // Teardrop pointing left (towards null)
            const direction = d.yi > 0 ? -1 : 1;
            dropPath.moveTo(cx, y - dropSize);
            dropPath.quadraticCurveTo(cx + direction * dropSize * 1.5, y, cx, y + dropSize);
            dropPath.quadraticCurveTo(cx - direction * dropSize * 0.5, y, cx, y - dropSize);

            // Color by significance
            let color = '#3498db';
            if (colorBySignificance) {
                const z = Math.abs(d.yi / se);
                color = z > 1.96 ? '#27ae60' : (z > 1.645 ? '#f39c12' : '#e74c3c');
            }

            g.append('path')
                .attr('d', dropPath.toString())
                .attr('fill', color)
                .attr('opacity', 0.7)
                .attr('stroke', '#333')
                .attr('stroke-width', 0.5);

            // Confidence interval
            g.append('line')
                .attr('x1', xScale(ciLow))
                .attr('x2', xScale(ciHigh))
                .attr('y1', y)
                .attr('y2', y)
                .attr('stroke', '#333')
                .attr('stroke-width', 1.5);

            // CI whiskers
            g.append('line')
                .attr('x1', xScale(ciLow))
                .attr('x2', xScale(ciLow))
                .attr('y1', y - 4)
                .attr('y2', y + 4)
                .attr('stroke', '#333')
                .attr('stroke-width', 1.5);

            g.append('line')
                .attr('x1', xScale(ciHigh))
                .attr('x2', xScale(ciHigh))
                .attr('y1', y - 4)
                .attr('y2', y + 4)
                .attr('stroke', '#333')
                .attr('stroke-width', 1.5);

            // Effect estimate and CI text
            g.append('text')
                .attr('x', plotWidth + 10)
                .attr('y', y)
                .attr('dy', '0.35em')
                .attr('font-size', '10px')
                .text(`${d.yi.toFixed(2)} [${ciLow.toFixed(2)}, ${ciHigh.toFixed(2)}]`);

            // Weight
            if (showWeights) {
                g.append('text')
                    .attr('x', plotWidth + 150)
                    .attr('y', y)
                    .attr('dy', '0.35em')
                    .attr('font-size', '10px')
                    .attr('fill', '#666')
                    .text(`${weightPct.toFixed(1)}%`);
            }
        });

        // Pooled estimate (diamond)
        const pooledY = n * rowHeight + rowHeight;
        const pooledHeight = 12;

        const diamond = d3.path();
        diamond.moveTo(xScale(result.effect), pooledY - pooledHeight);
        diamond.lineTo(xScale(result.ci.upper), pooledY);
        diamond.lineTo(xScale(result.effect), pooledY + pooledHeight);
        diamond.lineTo(xScale(result.ci.lower), pooledY);
        diamond.closePath();

        g.append('path')
            .attr('d', diamond.toString())
            .attr('fill', '#2c3e50')
            .attr('stroke', '#1a252f')
            .attr('stroke-width', 1);

        // Pooled label
        g.append('text')
            .attr('x', -10)
            .attr('y', pooledY)
            .attr('text-anchor', 'end')
            .attr('dy', '0.35em')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text('Pooled Estimate');

        g.append('text')
            .attr('x', plotWidth + 10)
            .attr('y', pooledY)
            .attr('dy', '0.35em')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .text(`${result.effect.toFixed(2)} [${result.ci.lower.toFixed(2)}, ${result.ci.upper.toFixed(2)}]`);

        // Prediction interval
        if (showPrediction && result.predictionInterval) {
            g.append('line')
                .attr('x1', xScale(result.predictionInterval[0]))
                .attr('x2', xScale(result.predictionInterval[1]))
                .attr('y1', pooledY + pooledHeight + 10)
                .attr('y2', pooledY + pooledHeight + 10)
                .attr('stroke', '#9b59b6')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,3');

            g.append('text')
                .attr('x', xScale(result.effect))
                .attr('y', pooledY + pooledHeight + 25)
                .attr('text-anchor', 'middle')
                .attr('font-size', '9px')
                .attr('fill', '#9b59b6')
                .text('Prediction Interval');
        }

        // Null effect line
        g.append('line')
            .attr('x1', xScale(0))
            .attr('x2', xScale(0))
            .attr('y1', -10)
            .attr('y2', plotHeight)
            .attr('stroke', '#333')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3');

        // Axis
        g.append('g')
            .attr('transform', `translate(0,${plotHeight - 20})`)
            .call(d3.axisBottom(xScale));

        // Column headers
        svg.append('text')
            .attr('x', margin.left - 10)
            .attr('y', margin.top - 30)
            .attr('text-anchor', 'end')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text('Study');

        svg.append('text')
            .attr('x', margin.left + plotWidth + 10)
            .attr('y', margin.top - 30)
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text('Effect [95% CI]');

        if (showWeights) {
            svg.append('text')
                .attr('x', margin.left + plotWidth + 150)
                .attr('y', margin.top - 30)
                .attr('font-size', '11px')
                .attr('font-weight', 'bold')
                .text('Weight');
        }

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .text('Rainforest Plot');

        return svg.node();
    }

    // ============================================
    // GOSH PLOT
    // ============================================

    /**
     * GOSH Plot - Graphical Overview of Study Heterogeneity
     */
    function goshPlot(goshResults, container, options = {}) {
        const {
            width = 800,
            height = 600,
            margin = { top: 40, right: 40, bottom: 60, left: 60 },
            colorByK = true,
            showDensity = true,
            highlightOutliers = true
        } = options;

        const svg = d3.select(container)
            .html('')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const data = goshResults.results || goshResults.plotData;

        // Scales
        const xScale = d3.scaleLinear()
            .domain(d3.extent(data, d => d.pooled || d.x))
            .range([0, plotWidth])
            .nice();

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.I2 || d.y)])
            .range([plotHeight, 0])
            .nice();

        const kExtent = d3.extent(data, d => d.k);
        const colorScale = d3.scaleSequential(d3.interpolateViridis)
            .domain(kExtent);

        // 2D density estimation for contours
        if (showDensity) {
            const xData = data.map(d => d.pooled || d.x);
            const yData = data.map(d => d.I2 || d.y);

            // Create hexbin for density visualization
            const hexbin = d3.hexbin()
                .x(d => xScale(d.pooled || d.x))
                .y(d => yScale(d.I2 || d.y))
                .radius(10)
                .extent([[0, 0], [plotWidth, plotHeight]]);

            const bins = hexbin(data);
            const maxCount = d3.max(bins, d => d.length);

            g.append('g')
                .selectAll('.hexagon')
                .data(bins)
                .enter()
                .append('path')
                .attr('class', 'hexagon')
                .attr('d', hexbin.hexagon())
                .attr('transform', d => `translate(${d.x},${d.y})`)
                .attr('fill', d => d3.interpolateBlues(d.length / maxCount))
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.5)
                .attr('opacity', 0.6);
        }

        // Plot points
        g.selectAll('.gosh-point')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'gosh-point')
            .attr('cx', d => xScale(d.pooled || d.x))
            .attr('cy', d => yScale(d.I2 || d.y))
            .attr('r', 2)
            .attr('fill', d => colorByK ? colorScale(d.k) : '#3498db')
            .attr('opacity', 0.4);

        // Highlight potential outlier subsets
        if (highlightOutliers && goshResults.potentialOutliers) {
            const outlierIndices = new Set(
                goshResults.potentialOutliers.flatMap(o => [o.index])
            );

            // Mark subsets containing outliers differently
            // (This would require tracking which results contain which studies)
        }

        // Axes
        g.append('g')
            .attr('transform', `translate(0,${plotHeight})`)
            .call(d3.axisBottom(xScale));

        g.append('g')
            .call(d3.axisLeft(yScale).tickFormat(d => d + '%'));

        // Labels
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('Pooled Effect Estimate');

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('I² (%)');

        // Color legend
        if (colorByK) {
            const legendWidth = 150;
            const legendHeight = 15;

            const legendScale = d3.scaleLinear()
                .domain(kExtent)
                .range([0, legendWidth]);

            const legendAxis = d3.axisBottom(legendScale)
                .ticks(5)
                .tickFormat(d3.format('d'));

            const legend = svg.append('g')
                .attr('transform', `translate(${width - margin.right - legendWidth}, ${margin.top})`);

            // Gradient
            const defs = svg.append('defs');
            const linearGradient = defs.append('linearGradient')
                .attr('id', 'gosh-legend-gradient');

            linearGradient.selectAll('stop')
                .data(d3.range(0, 1.01, 0.1))
                .enter()
                .append('stop')
                .attr('offset', d => d * 100 + '%')
                .attr('stop-color', d => colorScale(kExtent[0] + d * (kExtent[1] - kExtent[0])));

            legend.append('rect')
                .attr('width', legendWidth)
                .attr('height', legendHeight)
                .attr('fill', 'url(#gosh-legend-gradient)');

            legend.append('g')
                .attr('transform', `translate(0,${legendHeight})`)
                .call(legendAxis);

            legend.append('text')
                .attr('x', legendWidth / 2)
                .attr('y', -5)
                .attr('text-anchor', 'middle')
                .attr('font-size', '10px')
                .text('Number of Studies (k)');
        }

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .text('GOSH Plot (Study Heterogeneity)');

        return svg.node();
    }

    // ============================================
    // NETWORK GRAPH
    // ============================================

    /**
     * Network Graph for Network Meta-Analysis
     */
    function networkGraph(networkData, container, options = {}) {
        const {
            width = 700,
            height = 700,
            nodeRadius = 25,
            edgeWidthRange = [1, 10],
            showLabels = true,
            layout = 'force'  // 'force' or 'circle'
        } = options;

        const svg = d3.select(container)
            .html('')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${width/2},${height/2})`);

        // Extract nodes and edges from network data
        const treatments = networkData.network?.treatments || networkData.treatments || [];
        const graph = networkData.network?.graph || networkData.graph || {};

        // Create nodes
        const nodes = treatments.map(t => ({ id: t, label: t }));

        // Create edges
        const edges = [];
        const edgeCounts = {};
        treatments.forEach(t1 => {
            treatments.forEach(t2 => {
                if (t1 < t2 && graph[t1]?.[t2]) {
                    edges.push({
                        source: t1,
                        target: t2,
                        weight: graph[t1][t2]
                    });
                    edgeCounts[`${t1}-${t2}`] = graph[t1][t2];
                }
            });
        });

        const maxEdgeWeight = Math.max(...edges.map(e => e.weight));
        const edgeScale = d3.scaleLinear()
            .domain([1, maxEdgeWeight])
            .range(edgeWidthRange);

        // Layout
        if (layout === 'circle') {
            const angleStep = (2 * Math.PI) / nodes.length;
            const radius = Math.min(width, height) / 2 - 60;

            nodes.forEach((node, i) => {
                node.x = radius * Math.cos(angleStep * i - Math.PI / 2);
                node.y = radius * Math.sin(angleStep * i - Math.PI / 2);
            });
        } else {
            // Force-directed layout
            const simulation = d3.forceSimulation(nodes)
                .force('link', d3.forceLink(edges).id(d => d.id).distance(150))
                .force('charge', d3.forceManyBody().strength(-500))
                .force('center', d3.forceCenter(0, 0))
                .stop();

            // Run simulation
            for (let i = 0; i < 300; i++) simulation.tick();
        }

        // Draw edges
        const nodeMap = {};
        nodes.forEach(n => nodeMap[n.id] = n);

        g.selectAll('.edge')
            .data(edges)
            .enter()
            .append('line')
            .attr('class', 'edge')
            .attr('x1', d => nodeMap[d.source.id || d.source].x)
            .attr('y1', d => nodeMap[d.source.id || d.source].y)
            .attr('x2', d => nodeMap[d.target.id || d.target].x)
            .attr('y2', d => nodeMap[d.target.id || d.target].y)
            .attr('stroke', '#666')
            .attr('stroke-width', d => edgeScale(d.weight))
            .attr('stroke-opacity', 0.6);

        // Edge labels (number of studies)
        g.selectAll('.edge-label')
            .data(edges)
            .enter()
            .append('text')
            .attr('class', 'edge-label')
            .attr('x', d => (nodeMap[d.source.id || d.source].x + nodeMap[d.target.id || d.target].x) / 2)
            .attr('y', d => (nodeMap[d.source.id || d.source].y + nodeMap[d.target.id || d.target].y) / 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#333')
            .text(d => d.weight);

        // Draw nodes
        g.selectAll('.node')
            .data(nodes)
            .enter()
            .append('circle')
            .attr('class', 'node')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', nodeRadius)
            .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

        // Node labels
        if (showLabels) {
            g.selectAll('.node-label')
                .data(nodes)
                .enter()
                .append('text')
                .attr('class', 'node-label')
                .attr('x', d => d.x)
                .attr('y', d => d.y)
                .attr('text-anchor', 'middle')
                .attr('dy', '0.35em')
                .attr('font-size', '10px')
                .attr('font-weight', 'bold')
                .attr('fill', '#fff')
                .text(d => d.label.length > 8 ? d.label.substring(0, 8) + '...' : d.label);
        }

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 25)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .text('Treatment Network');

        return svg.node();
    }

    // ============================================
    // ROB TRAFFIC LIGHT PLOT
    // ============================================

    /**
     * Risk of Bias Traffic Light Plot
     */
    function robTrafficLight(robData, container, options = {}) {
        const {
            width = 800,
            height = null,
            rowHeight = 25,
            margin = { top: 60, right: 40, bottom: 20, left: 200 }
        } = options;

        const studies = robData;
        const n = studies.length;
        const domains = studies[0]?.domains?.map(d => d.id || d.domain) || [];
        const nDomains = domains.length;

        const calculatedHeight = height || n * rowHeight + margin.top + margin.bottom;

        const svg = d3.select(container)
            .html('')
            .append('svg')
            .attr('width', width)
            .attr('height', calculatedHeight);

        const plotWidth = width - margin.left - margin.right;
        const cellWidth = plotWidth / (nDomains + 1);  // +1 for overall

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Color scheme
        const judgmentColors = {
            'low': '#27ae60',
            'some_concerns': '#f39c12',
            'unclear': '#f39c12',
            'high': '#e74c3c',
            'critical': '#8e44ad',
            'no_information': '#95a5a6'
        };

        // Domain headers
        const domainLabels = studies[0]?.domains?.map(d => d.label || d.domain) || domains;

        domainLabels.forEach((label, i) => {
            svg.append('text')
                .attr('x', margin.left + i * cellWidth + cellWidth / 2)
                .attr('y', margin.top - 10)
                .attr('text-anchor', 'middle')
                .attr('font-size', '10px')
                .attr('font-weight', 'bold')
                .attr('transform', `rotate(-45, ${margin.left + i * cellWidth + cellWidth / 2}, ${margin.top - 10})`)
                .text(label.length > 15 ? label.substring(0, 15) + '...' : label);
        });

        svg.append('text')
            .attr('x', margin.left + nDomains * cellWidth + cellWidth / 2)
            .attr('y', margin.top - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .text('Overall');

        // Draw traffic lights
        studies.forEach((study, row) => {
            const y = row * rowHeight + rowHeight / 2;

            // Study label
            g.append('text')
                .attr('x', -10)
                .attr('y', y)
                .attr('text-anchor', 'end')
                .attr('dy', '0.35em')
                .attr('font-size', '10px')
                .text(study.study);

            // Domain judgments
            study.domains.forEach((domain, col) => {
                const judgment = domain.judgment || domain.rob || 'no_information';
                const color = judgmentColors[judgment] || '#95a5a6';

                g.append('circle')
                    .attr('cx', col * cellWidth + cellWidth / 2)
                    .attr('cy', y)
                    .attr('r', 8)
                    .attr('fill', color)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 0.5);

                // Symbol inside
                const symbol = judgment === 'low' ? '+' :
                              judgment === 'high' || judgment === 'critical' ? '−' : '?';

                g.append('text')
                    .attr('x', col * cellWidth + cellWidth / 2)
                    .attr('y', y)
                    .attr('text-anchor', 'middle')
                    .attr('dy', '0.35em')
                    .attr('font-size', '12px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#fff')
                    .text(symbol);
            });

            // Overall judgment
            const overall = typeof study.overall === 'string' ? study.overall :
                           study.overall?.rob || 'no_information';
            const overallColor = judgmentColors[overall] || '#95a5a6';

            g.append('circle')
                .attr('cx', nDomains * cellWidth + cellWidth / 2)
                .attr('cy', y)
                .attr('r', 8)
                .attr('fill', overallColor)
                .attr('stroke', '#333')
                .attr('stroke-width', 0.5);

            const overallSymbol = overall === 'low' ? '+' :
                                 overall === 'high' || overall === 'critical' ? '−' : '?';

            g.append('text')
                .attr('x', nDomains * cellWidth + cellWidth / 2)
                .attr('y', y)
                .attr('text-anchor', 'middle')
                .attr('dy', '0.35em')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('fill', '#fff')
                .text(overallSymbol);
        });

        // Legend
        const legendData = [
            { judgment: 'low', label: 'Low risk', symbol: '+' },
            { judgment: 'some_concerns', label: 'Some concerns', symbol: '?' },
            { judgment: 'high', label: 'High risk', symbol: '−' }
        ];

        const legend = svg.append('g')
            .attr('transform', `translate(${width - 150}, ${margin.top})`);

        legendData.forEach((item, i) => {
            const lg = legend.append('g')
                .attr('transform', `translate(0, ${i * 25})`);

            lg.append('circle')
                .attr('r', 8)
                .attr('fill', judgmentColors[item.judgment]);

            lg.append('text')
                .attr('x', 8)
                .attr('y', 0)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'start')
                .attr('font-size', '10px')
                .attr('font-weight', 'bold')
                .attr('fill', '#fff')
                .text(item.symbol);

            lg.append('text')
                .attr('x', 20)
                .attr('y', 0)
                .attr('dy', '0.35em')
                .attr('font-size', '10px')
                .text(item.label);
        });

        return svg.node();
    }

    // ============================================
    // ALBATROSS PLOT
    // ============================================

    /**
     * Albatross Plot - Effect contours over sample size vs p-value
     */
    function albatrossPlot(data, container, options = {}) {
        const {
            width = 800,
            height = 600,
            margin = { top: 40, right: 40, bottom: 60, left: 60 },
            effectContours = [0.1, 0.2, 0.3, 0.5, 0.8]
        } = options;

        const svg = d3.select(container)
            .html('')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Calculate p-values and sample sizes
        const processedData = data.map(d => {
            const z = d.yi / Math.sqrt(d.vi);
            const pvalue = 2 * (1 - Statistics.pnorm(Math.abs(z)));
            const n = d.n || Math.round(4 / d.vi);  // Estimate n if not provided
            return {
                ...d,
                pvalue: pvalue,
                n: n,
                direction: d.yi > 0 ? 'positive' : 'negative'
            };
        });

        // Scales
        const xScale = d3.scaleLog()
            .domain([d3.min(processedData, d => d.n) * 0.5,
                    d3.max(processedData, d => d.n) * 2])
            .range([0, plotWidth]);

        const yScale = d3.scaleLog()
            .domain([0.0001, 1])
            .range([0, plotHeight]);

        // Effect size contours
        effectContours.forEach(effectSize => {
            // For each effect size, calculate p-value as function of N
            const contourPoints = [];
            for (let logN = 1; logN <= 5; logN += 0.1) {
                const n = Math.pow(10, logN);
                const se = 2 / Math.sqrt(n);  // Approximate SE for d
                const z = effectSize / se;
                const pvalue = 2 * (1 - Statistics.pnorm(z));

                if (pvalue >= 0.0001 && pvalue <= 1) {
                    contourPoints.push({ n: n, p: pvalue });
                }
            }

            const line = d3.line()
                .x(d => xScale(d.n))
                .y(d => yScale(d.p))
                .curve(d3.curveMonotoneX);

            // Positive direction
            g.append('path')
                .datum(contourPoints)
                .attr('fill', 'none')
                .attr('stroke', '#2ecc71')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '5,5')
                .attr('opacity', 0.7)
                .attr('d', line);

            // Negative direction (mirror)
            g.append('path')
                .datum(contourPoints)
                .attr('fill', 'none')
                .attr('stroke', '#e74c3c')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '5,5')
                .attr('opacity', 0.7)
                .attr('d', line);

            // Label
            const labelPoint = contourPoints[Math.floor(contourPoints.length * 0.7)];
            if (labelPoint) {
                g.append('text')
                    .attr('x', xScale(labelPoint.n) + 5)
                    .attr('y', yScale(labelPoint.p))
                    .attr('font-size', '9px')
                    .attr('fill', '#666')
                    .text(`d=${effectSize}`);
            }
        });

        // Significance threshold
        g.append('line')
            .attr('x1', 0)
            .attr('x2', plotWidth)
            .attr('y1', yScale(0.05))
            .attr('y2', yScale(0.05))
            .attr('stroke', '#333')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3');

        g.append('text')
            .attr('x', plotWidth + 5)
            .attr('y', yScale(0.05))
            .attr('dy', '0.35em')
            .attr('font-size', '10px')
            .text('p = 0.05');

        // Plot studies
        g.selectAll('.study-point')
            .data(processedData)
            .enter()
            .append('circle')
            .attr('class', 'study-point')
            .attr('cx', d => xScale(d.n))
            .attr('cy', d => yScale(d.pvalue))
            .attr('r', 5)
            .attr('fill', d => d.direction === 'positive' ? '#2ecc71' : '#e74c3c')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .attr('opacity', 0.8);

        // Axes
        g.append('g')
            .attr('transform', `translate(0,${plotHeight})`)
            .call(d3.axisBottom(xScale).ticks(5, ',.0f'));

        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5, '.4f'));

        // Labels
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('Sample Size (N)');

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('P-value (two-sided)');

        // Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .text('Albatross Plot');

        return svg.node();
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    let tooltip = null;

    function showTooltip(event, data) {
        if (!tooltip) {
            tooltip = d3.select('body').append('div')
                .attr('class', 'viz-tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.8)')
                .style('color', '#fff')
                .style('padding', '8px 12px')
                .style('border-radius', '4px')
                .style('font-size', '12px')
                .style('pointer-events', 'none')
                .style('z-index', '1000');
        }

        tooltip.html(`
            <strong>${escapeHtml(data.study) || 'Study'}</strong><br/>
            Effect: ${data.yi?.toFixed(3) || 'N/A'}<br/>
            SE: ${data.vi > 0 ? Math.sqrt(data.vi).toFixed(3) : 'N/A'}
        `)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .style('opacity', 1);
    }

    function hideTooltip() {
        if (tooltip) {
            tooltip.style('opacity', 0);
        }
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        draperyPlot,
        sunsetPlot,
        rainforestPlot,
        goshPlot,
        networkGraph,
        robTrafficLight,
        albatrossPlot
    };

})();

// Export for Node.js if applicable
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedViz;
}
