import React, { useState, useEffect, useRef, useCallback } from 'react';
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

/**
 * RealTimeVitalChart
 * 
 * Classic ICU monitor style chart with dark background
 * and bright colored waveforms. Supports inverted thresholds.
 */

const BUFFER_SIZE = 60;

function RealTimeVitalChart({
    threshold,
    dataStream,
    vitalType,
    theme,
    invertThreshold = false,
    onValueUpdate
}) {
    const [data, setData] = useState([]);
    const [currentValue, setCurrentValue] = useState('--');
    const [isAlerting, setIsAlerting] = useState(false);
    const unsubscribeRef = useRef(null);

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

    const getYDomain = () => {
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
    };

    return (
        <div style={{
            backgroundColor: VITAL_THEME.cardBackground,
            borderRadius: '4px',
            padding: '4px',
            border: isAlerting ? '1px solid #ff4444' : 'none',
            boxShadow: isAlerting ? '0 0 10px rgba(255,68,68,0.3)' : 'none'
        }}>
            <ResponsiveContainer width="100%" height={100}>
                <LineChart
                    data={data}
                    margin={{ top: 5, right: 5, left: -15, bottom: 5 }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={VITAL_THEME.gridColor}
                        vertical={true}
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
                        domain={getYDomain()}
                        tick={{ fontSize: 7, fill: VITAL_THEME.textSecondary }}
                        axisLine={{ stroke: VITAL_THEME.gridColor }}
                        tickLine={false}
                        width={25}
                    />
                    <ReferenceLine
                        y={threshold}
                        stroke={theme.threshold}
                        strokeDasharray="4 4"
                        strokeWidth={1}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={isAlerting ? '#ff4444' : theme.waveColor}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={true}
                        animationDuration={150}
                        connectNulls
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export default RealTimeVitalChart;
