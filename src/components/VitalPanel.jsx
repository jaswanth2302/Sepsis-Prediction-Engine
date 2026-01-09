import React, { useState, useEffect } from 'react';
import AnimatedVitalChart from './AnimatedVitalChart.jsx';
import VitalCard from './VitalCard.jsx';
import { mlPredictionStream } from '../streams/MLPredictionStream.js';
import { vitalStream } from '../streams/VitalWebSocket.js';
import { VITAL_THEME, THRESHOLDS } from '../theme/vitalTheme.js';

/**
 * VitalPanel
 * 
 * Multi-vital monitoring view with 5 vital signs:
 * - Heart Rate (HR)
 * - Respiratory Rate (RR)
 * - Temperature
 * - SpO2
 * - Blood Pressure (Systolic)
 */

const VITAL_CONFIG = [
    {
        key: 'heart_rate',
        title: 'Heart Rate',
        unit: 'bpm',
        threshold: THRESHOLDS.heart_rate.max,
        themeKey: 'heartRate',
        vitalType: 'heart_rate'
    },
    {
        key: 'respiratory_rate',
        title: 'Respiratory Rate',
        unit: '/min',
        threshold: THRESHOLDS.respiratory_rate.max,
        themeKey: 'respiratoryRate',
        vitalType: 'respiratory_rate'
    },
    {
        key: 'temperature',
        title: 'Temperature',
        unit: '°C',
        threshold: THRESHOLDS.temperature.max,
        themeKey: 'temperature',
        vitalType: 'temperature'
    },
    {
        key: 'spo2',
        title: 'SpO2',
        unit: '%',
        threshold: THRESHOLDS.spo2.min,
        themeKey: 'spo2',
        vitalType: 'spo2',
        invertThreshold: true // Alert when BELOW threshold
    },
    {
        key: 'systolic_bp',
        title: 'Blood Pressure',
        unit: 'mmHg',
        threshold: THRESHOLDS.systolic_bp.min,
        themeKey: 'bloodPressure',
        vitalType: 'systolic_bp',
        invertThreshold: true
    }
];

function VitalPanel({ onPhaseChange, visibleVitals = null }) {
    const [latestValues, setLatestValues] = useState({
        heart_rate: '--',
        respiratory_rate: '--',
        temperature: '--',
        spo2: '--',
        systolic_bp: '--'
    });
    const [currentPhase, setCurrentPhase] = useState('stable');
    const [useMLStream, setUseMLStream] = useState(true);

    const handleValueUpdate = (vitalType, value, phase) => {
        setLatestValues(prev => ({
            ...prev,
            [vitalType]: value
        }));

        if (phase && phase !== currentPhase) {
            setCurrentPhase(phase);
            if (onPhaseChange) {
                onPhaseChange(phase);
            }
        }
    };

    const getPhaseDisplay = () => {
        switch (currentPhase) {
            case 'stable': return { text: 'STABLE', color: '#00ff00' };
            case 'earlyWarning': return { text: 'EARLY WARNING', color: '#ffff00' };
            case 'deteriorating': return { text: 'DETERIORATING', color: '#ff8800' };
            case 'critical': return { text: 'CRITICAL', color: '#ff4444' };
            default: return { text: 'MONITORING', color: '#888' };
        }
    };

    const phaseInfo = getPhaseDisplay();

    // Filter vitals if visibleVitals is provided
    const activeVitals = visibleVitals
        ? VITAL_CONFIG.filter(v => visibleVitals.includes(v.key) || visibleVitals.includes(v.vitalType))
        : VITAL_CONFIG;

    // Determine grid columns based on item count
    const gridColumns = activeVitals.length <= 2 ? activeVitals.length : 3;

    return (
        <div className="vital-panel">
            <div className="vital-panel-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid #333'
            }}>
                <div>
                    <h2 style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#fff',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        {visibleVitals ? 'ACTIVE ASSESSMENT' : 'VITAL SIGNS MONITOR'}
                    </h2>
                    <span style={{
                        fontSize: '0.6875rem',
                        color: '#888',
                        fontFamily: 'monospace'
                    }}>
                        Real-time trending • 3-second updates
                    </span>
                </div>
                {!visibleVitals && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <span style={{
                            fontSize: '0.6875rem',
                            color: '#888',
                            textTransform: 'uppercase'
                        }}>
                            Patient Status:
                        </span>
                        <span style={{
                            background: `${phaseInfo.color}22`,
                            color: phaseInfo.color,
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            border: `1px solid ${phaseInfo.color}44`,
                            textShadow: `0 0 8px ${phaseInfo.color}66`,
                            animation: activeVitals.some(v => latestValues[v.vitalType] > v.threshold) ? 'pulse 0.5s ease-in-out infinite' : 'none'
                        }}>
                            {phaseInfo.text}
                        </span>
                    </div>
                )}
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                    gap: '12px'
                }}
            >
                {activeVitals.map((config) => {
                    const theme = VITAL_THEME[config.themeKey];
                    return (
                        <VitalCard
                            key={config.key}
                            title={config.title}
                            unit={config.unit}
                            theme={theme}
                        >
                            <div className="vital-value" style={{ color: theme.color }}>
                                {config.vitalType === 'temperature'
                                    ? (typeof latestValues[config.vitalType] === 'number' ? latestValues[config.vitalType].toFixed(1) : latestValues[config.vitalType])
                                    : (typeof latestValues[config.vitalType] === 'number' ? Math.round(latestValues[config.vitalType]) : latestValues[config.vitalType])
                                }
                                <span className="unit">{config.unit}</span>
                            </div>
                            <AnimatedVitalChart
                                threshold={config.threshold}
                                vitalType={config.vitalType}
                                dataStream={useMLStream ? mlPredictionStream : vitalStream}
                                theme={theme}
                                invertThreshold={config.invertThreshold}
                                showFlowArrows={true}
                                onValueUpdate={(value, phase) => handleValueUpdate(config.vitalType, value, phase)}
                            />
                        </VitalCard>
                    );
                })}
            </div>
        </div>
    );
}

export default VitalPanel;
