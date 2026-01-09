/**
 * AnimatedVitalChart.jsx
 * 
 * High-performance real-time vital chart with:
 * - Smooth animated transitions
 * - Flow direction arrows on the line
 * - Sensitive, fast updates
 * - Clinical-grade aesthetics
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    ReferenceLine,
    ResponsiveContainer,
    CartesianGrid
} from 'recharts';
import VITAL_THEME from '../theme/vitalTheme.js';

const BUFFER_SIZE = 100;
const UPDATE_INTERVAL = 500; // Faster updates for sensitivity

// Custom dot with directional arrow
const FlowArrowDot = (props) => {
    const { cx, cy, stroke, payload, data, index } = props;

    // Only show arrow on every 5th point to avoid clutter
    if (index % 5 !== 0 || !data || index < 1) return null;

    // Calculate direction from previous point
    const prevPoint = data[index - 1];
    if (!prevPoint) return null;

    const prevCx = props.cx - (payload.value - prevPoint.value) * 2;
    const dx = cx - prevCx;
    const dy = (payload.value - prevPoint.value) * -1; // Invert for screen coords

    // Calculate angle
    const angle = Math.atan2(dy, 10) * (180 / Math.PI);

    return (
        <g transform={`translate(${cx}, ${cy})`}>
            {/* Direction arrow */}
            <polygon
                points="0,-4 8,0 0,4"
                fill={stroke}
                opacity={0.8}
                transform={`rotate(${angle})`}
            />
        </g>
    );
};

// Animated pulse dot at the current value
const PulseDot = (props) => {
    const { cx, cy, stroke, isLast } = props;

    if (!isLast) return null;

    return (
        <g>
            {/* Pulse ring */}
            <circle
                cx={cx}
                cy={cy}
                r={6}
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                opacity={0.6}
            >
                <animate
                    attributeName="r"
                    from="4"
                    to="12"
                    dur="1s"
                    repeatCount="indefinite"
                />
                <animate
                    attributeName="opacity"
                    from="0.6"
                    to="0"
                    dur="1s"
                    repeatCount="indefinite"
                />
            </circle>
            {/* Center dot */}
            <circle
                cx={cx}
                cy={cy}
                r={4}
                fill={stroke}
            />
        </g>
    );
};

function AnimatedVitalChart({
    threshold,
    dataStream,
    vitalType,
    theme,
    invertThreshold = false,
    onValueUpdate,
    showFlowArrows = true
}) {
    const [data, setData] = useState([]);
    const [currentValue, setCurrentValue] = useState('--');
    const [isAlerting, setIsAlerting] = useState(false);
    const [trend, setTrend] = useState('stable'); // 'up', 'down', 'stable'
    const unsubscribeRef = useRef(null);
    const lastValueRef = useRef(null);

    const formatTime = useCallback((timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }, []);

    const handleNewData = useCallback((dataPoint) => {
        const newPoint = {
            time: formatTime(dataPoint.timestamp),
            timestamp: dataPoint.timestamp,
            value: dataPoint.value
        };

        // Calculate trend
        if (lastValueRef.current !== null) {
            const diff = dataPoint.value - lastValueRef.current;
            if (diff > 0.5) setTrend('up');
            else if (diff < -0.5) setTrend('down');
            else setTrend('stable');
        }
        lastValueRef.current = dataPoint.value;

        setCurrentValue(dataPoint.value);

        // Check if alerting
        if (invertThreshold) {
            setIsAlerting(dataPoint.value < threshold);
        } else {
            setIsAlerting(dataPoint.value > threshold);
        }

        if (onValueUpdate) {
            onValueUpdate(dataPoint.value, dataPoint.phase);
        }

        setData(prevData => {
            const newData = [...prevData, newPoint];
            if (newData.length > BUFFER_SIZE) {
                return newData.slice(-BUFFER_SIZE);
            }
            return newData;
        });
    }, [formatTime, onValueUpdate, threshold, invertThreshold]);

    useEffect(() => {
        if (dataStream && vitalType) {
            unsubscribeRef.current = dataStream.subscribeToVital(vitalType, handleNewData);
        }
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [dataStream, vitalType, handleNewData]);

    const getYDomain = useMemo(() => {
        if (data.length === 0) {
            switch (vitalType) {
                case 'heart_rate': return [40, 140];
                case 'respiratory_rate': return [8, 35];
                case 'temperature': return [35, 41];
                case 'spo2': return [80, 100];
                case 'systolic_bp': return [70, 160];
                case 'diastolic_bp': return [40, 100];
                default: return [0, 100];
            }
        }

        const values = data.map(d => d.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const padding = (max - min) * 0.3 || 10;

        return [
            Math.floor(min - padding),
            Math.ceil(max + padding)
        ];
    }, [data, vitalType]);

    // Get line color based on alerting and trend
    const lineColor = useMemo(() => {
        if (isAlerting) return '#ff4444';
        return theme?.waveColor || '#00ff00';
    }, [isAlerting, theme]);

    // Trend indicator
    const getTrendIcon = () => {
        if (trend === 'up') return '↑';
        if (trend === 'down') return '↓';
        return '→';
    };

    return (
        <div style={{
            backgroundColor: VITAL_THEME.cardBackground,
            borderRadius: '4px',
            padding: '4px',
            border: isAlerting ? '2px solid #ff4444' : '1px solid #222',
            boxShadow: isAlerting ? '0 0 15px rgba(255,68,68,0.4)' : 'none',
            transition: 'all 0.3s ease',
            position: 'relative'
        }}>
            {/* Trend indicator */}
            <div style={{
                position: 'absolute',
                top: 4,
                right: 8,
                fontSize: '14px',
                color: trend === 'up' ? '#ff8800' : trend === 'down' ? '#00aaff' : '#888',
                fontWeight: 'bold',
                zIndex: 10
            }}>
                {getTrendIcon()}
            </div>

            <ResponsiveContainer width="100%" height={100}>
                <LineChart
                    data={data}
                    margin={{ top: 5, right: 20, left: -15, bottom: 5 }}
                >
                    <defs>
                        {/* Glow filter for the line */}
                        <filter id={`glow-${vitalType}`} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={VITAL_THEME.gridColor}
                        vertical={true}
                        opacity={0.3}
                    />
                    <XAxis
                        dataKey="time"
                        tick={{ fontSize: 7, fill: VITAL_THEME.textSecondary }}
                        axisLine={{ stroke: VITAL_THEME.gridColor }}
                        tickLine={false}
                        interval="preserveEnd"
                        minTickGap={80}
                    />
                    <YAxis
                        domain={getYDomain}
                        tick={{ fontSize: 7, fill: VITAL_THEME.textSecondary }}
                        axisLine={{ stroke: VITAL_THEME.gridColor }}
                        tickLine={false}
                        width={25}
                    />
                    <ReferenceLine
                        y={threshold}
                        stroke={theme?.threshold || '#ff8800'}
                        strokeDasharray="4 4"
                        strokeWidth={1}
                        opacity={0.7}
                    />

                    {/* Main vital line with glow */}
                    <Line
                        type="monotoneX"
                        dataKey="value"
                        stroke={lineColor}
                        strokeWidth={2.5}
                        dot={(props) => {
                            const isLast = props.index === data.length - 1;
                            if (isLast) {
                                return <PulseDot {...props} isLast={true} />;
                            }
                            if (showFlowArrows) {
                                return <FlowArrowDot {...props} data={data} />;
                            }
                            return null;
                        }}
                        isAnimationActive={true}
                        animationDuration={200}
                        animationEasing="ease-out"
                        connectNulls
                        filter={`url(#glow-${vitalType})`}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export default AnimatedVitalChart;
