/**
 * PatientRegistrationFlow.jsx
 * 
 * Progressive staged patient registration with real-time ML analysis.
 * Unlocks stages sequentially based on qSOFA forward-chaining rules.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import MonitoringSession from './MonitoringSession.jsx';
import { generateMedicalReport } from '../utils/pdfGenerator';

// Clinical thresholds for alerts
const THRESHOLDS = {
    temp_high: 38.0,
    resp_qsofa: 22,
    sbp_qsofa: 100,
    hr_high: 100,
    wbc_high: 12000
};

// Stage configurations
const STAGES = {
    1: {
        title: 'Stage 1: Infection Screening',
        description: 'Fever and respiratory assessment',
        fields: ['temperature', 'respiratory_rate'],
        unlockMessage: 'Temperature or respiratory abnormality detected. Proceeding to hemodynamic assessment...'
    },
    2: {
        title: 'Stage 2: Hemodynamic Assessment',
        description: 'Blood pressure and heart rate monitoring',
        fields: ['systolic_bp', 'diastolic_bp', 'heart_rate'],
        unlockMessage: 'Hemodynamic instability detected. Proceeding to inflammatory markers...'
    },
    3: {
        title: 'Stage 3: Inflammatory Markers',
        description: 'White blood cell count and final assessment',
        fields: ['wbc', 'spo2'],
        unlockMessage: 'Inflammatory response confirmed. Full sepsis screening complete.'
    }
};

function PatientRegistrationFlow({
    patientInfo,
    onComplete,
    onCancel
}) {
    // State
    const [currentStage, setCurrentStage] = useState(1);
    const [activeMonitoring, setActiveMonitoring] = useState(null); // If non-null, we are in a monitoring session
    const [vitals, setVitals] = useState({
        temperature: '',
        respiratory_rate: '',
        heart_rate: '',
        systolic_bp: '',
        diastolic_bp: '',
        spo2: '',
        wbc: '',
        iculos: '1'
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [riskResult, setRiskResult] = useState(null);
    const [predictions, setPredictions] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [stageHistory, setStageHistory] = useState([]);

    // Evaluate if we should advance to next stage
    const evaluateStageAdvance = useCallback((data, stage) => {
        const newAlerts = [];

        if (stage === 1) {
            const temp = parseFloat(data.temperature);
            const resp = parseFloat(data.respiratory_rate);

            if (temp > THRESHOLDS.temp_high) {
                newAlerts.push(`Fever detected: ${temp}°C (threshold: ${THRESHOLDS.temp_high}°C)`);
            }
            if (resp >= THRESHOLDS.resp_qsofa) {
                newAlerts.push(`Elevated respiratory rate: ${resp}/min (qSOFA threshold: ${THRESHOLDS.resp_qsofa})`);
            }

            // Advance to stage 2 if any abnormality
            return {
                advance: temp > THRESHOLDS.temp_high || resp >= THRESHOLDS.resp_qsofa,
                alerts: newAlerts
            };
        }

        if (stage === 2) {
            const sbp = parseFloat(data.systolic_bp);
            const hr = parseFloat(data.heart_rate);

            if (sbp <= THRESHOLDS.sbp_qsofa) {
                newAlerts.push(`Hypotension: SBP ${sbp} mmHg (qSOFA threshold: ≤${THRESHOLDS.sbp_qsofa})`);
            }
            if (hr > THRESHOLDS.hr_high) {
                newAlerts.push(`Tachycardia: HR ${hr} bpm (threshold: >${THRESHOLDS.hr_high})`);
            }

            return {
                advance: sbp <= THRESHOLDS.sbp_qsofa || hr > THRESHOLDS.hr_high,
                alerts: newAlerts
            };
        }

        return { advance: false, alerts: newAlerts };
    }, []);

    // Submit stage data to backend
    const submitStage = async () => {
        setIsProcessing(true);

        try {
            // Prepare vitals data
            const vitalsData = {
                heart_rate: vitals.heart_rate ? parseFloat(vitals.heart_rate) : null,
                spo2: vitals.spo2 ? parseFloat(vitals.spo2) : null,
                systolic_bp: vitals.systolic_bp ? parseFloat(vitals.systolic_bp) : null,
                diastolic_bp: vitals.diastolic_bp ? parseFloat(vitals.diastolic_bp) : null,
                temperature: vitals.temperature ? parseFloat(vitals.temperature) : null,
                respiratory_rate: vitals.respiratory_rate ? parseFloat(vitals.respiratory_rate) : null,
                wbc: vitals.wbc ? parseInt(vitals.wbc) : null,
                iculos: vitals.iculos ? parseInt(vitals.iculos) : 1,
                source: 'manual',
                processed: false,
                stage: currentStage
            };

            // Insert vitals
            const { data: insertedVitals, error: insertError } = await supabase
                .from('vitals')
                .insert(vitalsData)
                .select()
                .single();

            if (insertError) throw insertError;

            console.log('[Registration] Vitals submitted:', insertedVitals.id);

            // Subscribe to risk assessment result
            const subscription = supabase
                .channel(`risk_${insertedVitals.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'risk_assessments',
                        filter: `vitals_id=eq.${insertedVitals.id}`
                    },
                    (payload) => {
                        console.log('[Registration] Risk result received:', payload.new);
                        setRiskResult(payload.new);

                        // Fetch predictions
                        fetchPredictions(payload.new.simulation_id);
                    }
                )
                .subscribe();

            // Poll for result (backup)
            let attempts = 0;
            const maxAttempts = 15;

            const pollInterval = setInterval(async () => {
                attempts++;

                const { data: assessment } = await supabase
                    .from('risk_assessments')
                    .select('*')
                    .eq('vitals_id', insertedVitals.id)
                    .single();

                if (assessment) {
                    clearInterval(pollInterval);
                    setRiskResult(assessment);
                    fetchPredictions(assessment.simulation_id);
                    setIsProcessing(false);

                    // Evaluate stage advance
                    const { advance, alerts: newAlerts } = evaluateStageAdvance(vitals, currentStage);
                    setAlerts(prev => [...prev, ...newAlerts]);

                    // Don't auto-advance in immersive mode, wait for user "Proceed"
                }

                if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                    setIsProcessing(false);
                }
            }, 2000);

            // Cleanup subscription after 30s
            setTimeout(() => {
                subscription.unsubscribe();
            }, 30000);

        } catch (error) {
            console.error('[Registration] Error:', error);
            setIsProcessing(false);
        }
    };

    // Fetch forecast predictions
    const fetchPredictions = async (simulationId) => {
        if (!simulationId) return;

        const { data, error } = await supabase
            .from('vital_predictions')
            .select('*')
            .eq('simulation_id', simulationId)
            .order('sequence_index');

        if (data && !error) {
            setPredictions(data);
        }
    };

    // Handle final completion
    const handleComplete = () => {
        onComplete?.({
            vitals,
            riskResult,
            predictions,
            alerts,
            stageHistory
        });
    };

    // Submit stage data -> Start Immersive Monitoring
    const startMonitoring = () => {
        // Switch to monitoring mode for current stage
        setActiveMonitoring(currentStage);
    };

    // Handle result from MonitoringSession
    const handleMonitoringResult = ({ stage, riskResult, canProceed }) => {
        // Create updated history locally to ensure we have the latest item
        const updatedHistory = [...stageHistory, {
            stage,
            vitals: { ...vitals }, // Snapshot vitals at this stage
            result: riskResult
        }];

        // Save result to history state
        setStageHistory(updatedHistory);

        // Stop monitoring view
        setActiveMonitoring(null);

        // Advance stage or complete
        if (canProceed && stage < 3) {
            setCurrentStage(prev => prev + 1);
        } else if (stage === 3) {
            // Generate PDF Report on completion
            generateMedicalReport(patientInfo, updatedHistory, riskResult);

            onComplete?.({
                vitals,
                riskResult,
                stageHistory: updatedHistory
            });
        }
    };

    // Input change handler
    const handleInputChange = (field, value) => {
        setVitals(prev => ({ ...prev, [field]: value }));
    };

    // If active monitoring, render MonitoringSession
    if (activeMonitoring) {
        return (
            <MonitoringSession
                patient={patientInfo}
                stage={activeMonitoring}
                initialVitals={vitals}
                riskResult={riskResult}
                onAnalysisStart={submitStage}
                onResult={handleMonitoringResult}
                onCancel={() => setActiveMonitoring(null)}
            />
        );
    }

    // Render input field
    const renderField = (field) => {
        const fieldConfig = {
            temperature: { label: 'Temperature', unit: '°C', placeholder: '36.5 - 37.5', type: 'number', step: '0.1' },
            respiratory_rate: { label: 'Respiratory Rate', unit: '/min', placeholder: '12 - 20', type: 'number' },
            heart_rate: { label: 'Heart Rate', unit: 'bpm', placeholder: '60 - 100', type: 'number' },
            systolic_bp: { label: 'Systolic BP', unit: 'mmHg', placeholder: '90 - 140', type: 'number' },
            diastolic_bp: { label: 'Diastolic BP', unit: 'mmHg', placeholder: '60 - 90', type: 'number' },
            spo2: { label: 'SpO2', unit: '%', placeholder: '95 - 100', type: 'number' },
            wbc: { label: 'WBC Count', unit: 'cells/µL', placeholder: '4000 - 11000', type: 'number' },
            iculos: { label: 'Hours Since Admission', unit: 'hrs', placeholder: '1', type: 'number' }
        };

        const config = fieldConfig[field];
        if (!config) return null;

        return (
            <div className="form-field" key={field}>
                <label>
                    {config.label}
                    <span className="field-unit">{config.unit}</span>
                </label>
                <input
                    type={config.type}
                    step={config.step}
                    placeholder={config.placeholder}
                    value={vitals[field]}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                />
            </div>
        );
    };

    // Get current stage config
    const stageConfig = STAGES[currentStage];

    // Only show fields relevant to CURRENT stage input
    // (Previous stages are already captured)
    const currentStageFields = stageConfig.fields;

    return (
        <div className="registration-flow split-layout">
            {/* Left Sidebar: Vertical Timeline */}
            <div className="flow-sidebar">
                <div className="timeline-header">
                    <h3>Sepsis Screening</h3>
                    <p>Timeline Flow</p>
                </div>

                <div className="vertical-timeline">
                    {[1, 2, 3].map((stage, index) => {
                        const isActive = stage === currentStage;
                        const isCompleted = stage < currentStage;
                        const isNext = stage === currentStage + 1;

                        return (
                            <div key={stage} className={`timeline-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isNext ? 'next' : ''}`}>
                                <div className="timeline-marker-container">
                                    <div className="timeline-marker">
                                        {isCompleted ? '✓' : stage}
                                    </div>
                                    {/* Connectivity Line */}
                                    {stage !== 3 && <div className="timeline-line"></div>}
                                </div>

                                <div className="timeline-content">
                                    <span className="stage-title">Stage {stage}</span>
                                    <span className="stage-name">{STAGES[stage].title.split(':')[1].trim()}</span>
                                    <p className="stage-summary">{STAGES[stage].description}</p>
                                </div>

                                {/* Active Arrow Indicator */}
                                {isActive && (
                                    <div className="active-arrow">→</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Main Content */}
            <div className="flow-main">
                <div className="flow-header">
                    <h2>{stageConfig.title}</h2>
                    {patientInfo && (
                        <p className="patient-info">
                            Patient: <strong>{patientInfo.name || patientInfo.id}</strong>
                        </p>
                    )}
                </div>

                <div className="stage-content">
                    <p className="stage-instruction">{stageConfig.description}</p>

                    {/* Input Fields */}
                    <div className="stage-fields grid-layout">
                        {currentStageFields.map(field => renderField(field))}
                        {currentStage === 1 && renderField('iculos')}
                    </div>
                </div>

                {/* Actions */}
                <div className="flow-actions">
                    <button
                        className="btn-cancel"
                        onClick={onCancel}
                        disabled={isProcessing}
                    >
                        Cancel
                    </button>

                    <button
                        className="btn-submit"
                        onClick={startMonitoring}
                        disabled={isProcessing || !currentStageFields.every(f => vitals[f])}
                    >
                        Start Monitoring
                        <span className="btn-icon">▶</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PatientRegistrationFlow;
