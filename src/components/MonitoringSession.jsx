/**
 * MonitoringSession.jsx
 * 
 * Immersive monitoring session component.
 * Manages the flow:
 * 1. Monitoring Phase: Shows selected vital graphs (simulates real-time data collection)
 * 2. Analysis Phase: Brief "Analyzing..." state
 * 3. Result Phase: Displays risk score and next steps
 */

import React, { useState, useEffect } from 'react';
import VitalPanel from './VitalPanel.jsx';
import { motion, AnimatePresence } from 'framer-motion';

const STAGE_CONFIG = {
    1: {
        title: 'Infection Screening',
        vitals: ['temperature', 'respiratory_rate'],
        duration: 5000, // 5 seconds of monitoring
        description: 'Monitoring Temperature and Respiratory Rate...'
    },
    2: {
        title: 'Hemodynamic Assessment',
        vitals: ['heart_rate', 'systolic_bp'],
        duration: 5000,
        description: 'Monitoring Heart Rate and Blood Pressure...'
    },
    3: {
        title: 'Inflammatory Markers',
        vitals: ['wbc', 'spo2'],
        duration: 5000,
        description: 'Analyzing WBC and SpO2 levels...'
    }
};

import { mlPredictionStream } from '../streams/MLPredictionStream.js';
import DeepDiveModal from './DeepDiveModal';

function MonitoringSession({
    patient,
    stage = 1,
    initialVitals = {},
    riskResult,
    onAnalysisStart,
    onResult,
    onCancel
}) {
    const [phase, setPhase] = useState('monitoring'); // monitoring, analyzing, result
    const [elapsed, setElapsed] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const config = STAGE_CONFIG[stage];

    // Push initial vitals to stream on mount (to populate graphs)
    useEffect(() => {
        if (initialVitals && phase !== 'result') {
            const interval = setInterval(() => {
                // Determine phase for visual effect based on values
                // If checking temp/resp (Stage 1), we don't know risk yet, assume stable for now
                const simulatedPhase = 'stable';

                config.vitals.forEach(vital => {
                    if (initialVitals[vital]) {
                        // Add some tiny random jitter to make it look alive
                        const baseVal = parseFloat(initialVitals[vital]);
                        const jitter = (Math.random() - 0.5) * 0.2;
                        mlPredictionStream.pushVital(vital, baseVal + jitter, simulatedPhase);
                    }
                });
            }, 1000); // 1-second updates for "live" feel
            return () => clearInterval(interval);
        }
    }, [initialVitals, phase, config.vitals]);

    // Timer for monitoring phase
    useEffect(() => {
        if (phase === 'monitoring') {
            const timer = setInterval(() => {
                setElapsed(prev => {
                    const next = prev + 100;
                    if (next >= config.duration) {
                        clearInterval(timer);
                        setPhase('analyzing');
                        if (onAnalysisStart) onAnalysisStart();
                    }
                    return next;
                });
            }, 100);
            return () => clearInterval(timer);
        }
    }, [phase, config.duration, onAnalysisStart]);

    // Transition to result when riskResult is available
    useEffect(() => {
        if (phase === 'analyzing' && riskResult) {
            // Add a small delay for dramatic effect if result comes back too fast
            const timer = setTimeout(() => {
                setPhase('result');
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [phase, riskResult]);

    const handleProceed = () => {
        if (onResult) {
            onResult({
                stage,
                riskResult,
                canProceed: true
            });
        }
    };

    return (
        <div className="monitoring-session">
            <div className="session-header">
                <h2>{config.title}</h2>
                <div className="patient-badge">
                    Patient: {patient?.name || 'Unknown'}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="session-content">

                {/* Vital Graphs - Always visible and active */}
                <div className="graphs-container">
                    <VitalPanel visibleVitals={config.vitals} />
                </div>

                {/* Status/Footer Section */}
                <div className="session-footer">
                    {/* Phase 1: Monitoring Progress */}
                    {phase === 'monitoring' && (
                        <div className="status-panel monitoring">
                            <div className="progress-container">
                                <div
                                    className="progress-bar"
                                    style={{ width: `${(elapsed / config.duration) * 100}%` }}
                                />
                            </div>
                            <div className="status-text">{config.description}</div>
                        </div>
                    )}

                    {/* Phase 2: Analyzing */}
                    {phase === 'analyzing' && (
                        <div className="status-panel analyzing">
                            <div className="spinner-inline"></div>
                            <div className="status-text-group">
                                <h3>Analyzing Patterns...</h3>
                                <p>Running ML Sepsis Detection Model on Live Data</p>
                            </div>
                        </div>
                    )}

                    {/* Phase 3: Result */}
                    {phase === 'result' && riskResult && (
                        <div className={`status-panel result ${riskResult.risk_level.toLowerCase()}`}>
                            <div className="result-content">
                                <div className="result-info">
                                    <span className="result-label">Calculated Sepsis Risk</span>
                                    <div className="result-value">
                                        <span className="percentage">{(riskResult.risk_score * 100).toFixed(1)}%</span>
                                        <span className="badge">{riskResult.risk_level}</span>
                                    </div>
                                </div>

                                {/* Active Alerts Trigger */}
                                {riskResult.reasoning?.alerts?.length > 0 && (
                                    <div className="alert-trigger" onClick={() => setIsModalOpen(true)}>
                                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <span style={{ fontWeight: 600 }}>{riskResult.reasoning.alerts.length} Clinical Alerts</span>
                                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Click for Analysis</span>
                                        </div>
                                    </div>
                                )}

                                <div className="result-actions">
                                    <button className="btn-secondary" onClick={onCancel}>
                                        Exit
                                    </button>
                                    {stage < 3 && (
                                        <button className="btn-primary" onClick={handleProceed}>
                                            Proceed to Stage {stage + 1}
                                        </button>
                                    )}
                                    {stage === 3 && (
                                        <button className="btn-primary" onClick={handleProceed}>
                                            Finalize Report
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Deep Dive Modal */}
            <DeepDiveModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                data={riskResult}
                patientName={patient.name}
            />
        </div>
    );
}

export default MonitoringSession;
