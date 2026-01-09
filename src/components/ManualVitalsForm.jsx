import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

/**
 * ManualVitalsForm
 * 
 * Modal form for manually entering patient vital signs.
 * Submits to Supabase and listens for ML risk assessment results.
 */

// Clinical validation ranges
const VITAL_RANGES = {
    heartRate: { min: 20, max: 300, label: 'Heart Rate', unit: 'bpm', default: 80 },
    spo2: { min: 50, max: 100, label: 'SpO2', unit: '%', default: 97 },
    systolicBp: { min: 50, max: 250, label: 'Systolic BP', unit: 'mmHg', default: 120 },
    diastolicBp: { min: 30, max: 150, label: 'Diastolic BP', unit: 'mmHg', default: 80 },
    respiratoryRate: { min: 5, max: 60, label: 'Respiratory Rate', unit: '/min', default: 18 },
    temperature: { min: 32, max: 42, label: 'Temperature', unit: '°C', default: 37.0, step: 0.1 },
    iculos: { min: 0, max: 1000, label: 'Hours Since Admission', unit: 'hrs', default: 1 }
};

function ManualVitalsForm({ isOpen, onClose, patientId }) {
    const [formData, setFormData] = useState({
        heartRate: '',
        spo2: '',
        systolicBp: '',
        diastolicBp: '',
        respiratoryRate: '',
        temperature: '',
        iculos: ''
    });

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [processingStatus, setProcessingStatus] = useState(null); // null, 'waiting', 'complete', 'error'
    const [riskResult, setRiskResult] = useState(null);
    const [insertedVitalsId, setInsertedVitalsId] = useState(null);

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setFormData({
                heartRate: '',
                spo2: '',
                systolicBp: '',
                diastolicBp: '',
                respiratoryRate: '',
                temperature: '',
                iculos: ''
            });
            setErrors({});
            setIsSubmitting(false);
            setProcessingStatus(null);
            setRiskResult(null);
            setInsertedVitalsId(null);
        }
    }, [isOpen]);

    // Subscribe to risk_assessments when waiting for result
    useEffect(() => {
        if (!insertedVitalsId || processingStatus !== 'waiting') return;

        console.log('[ManualVitalsForm] Subscribing to risk_assessments for vitals_id:', insertedVitalsId);

        const channel = supabase
            .channel(`risk-${insertedVitalsId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'risk_assessments',
                    filter: `vitals_id=eq.${insertedVitalsId}`
                },
                (payload) => {
                    console.log('[ManualVitalsForm] Received risk assessment:', payload.new);
                    setRiskResult(payload.new);
                    setProcessingStatus('complete');
                }
            )
            .subscribe();

        // Also poll as backup (in case realtime subscription misses it)
        const pollInterval = setInterval(async () => {
            const { data } = await supabase
                .from('risk_assessments')
                .select('*')
                .eq('vitals_id', insertedVitalsId)
                .maybeSingle();

            if (data) {
                console.log('[ManualVitalsForm] Polled risk assessment:', data);
                setRiskResult(data);
                setProcessingStatus('complete');
                clearInterval(pollInterval);
            }
        }, 2000);

        // Timeout after 30 seconds
        const timeout = setTimeout(() => {
            if (processingStatus === 'waiting') {
                setProcessingStatus('error');
            }
        }, 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
            clearTimeout(timeout);
        };
    }, [insertedVitalsId, processingStatus]);

    const validateField = (name, value) => {
        const range = VITAL_RANGES[name];
        if (!range) return null;

        if (value === '' || value === null || value === undefined) {
            return null; // Optional field
        }

        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            return `${range.label} must be a number`;
        }
        if (numValue < range.min || numValue > range.max) {
            return `${range.label} must be between ${range.min} and ${range.max}`;
        }
        return null;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const validateForm = () => {
        const newErrors = {};
        let hasValue = false;

        Object.keys(formData).forEach(key => {
            const error = validateField(key, formData[key]);
            if (error) newErrors[key] = error;
            if (formData[key] !== '') hasValue = true;
        });

        // Require at least HR and one BP value
        if (!formData.heartRate) {
            newErrors.heartRate = 'Heart Rate is required';
        }
        if (!formData.systolicBp) {
            newErrors.systolicBp = 'Systolic BP is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsSubmitting(true);
        setProcessingStatus('waiting');

        try {
            // Prepare data for insert
            const vitalsData = {
                user_id: patientId || null,
                heart_rate: formData.heartRate ? parseInt(formData.heartRate, 10) : null,
                spo2: formData.spo2 ? parseInt(formData.spo2, 10) : null,
                systolic_bp: formData.systolicBp ? parseInt(formData.systolicBp, 10) : null,
                diastolic_bp: formData.diastolicBp ? parseInt(formData.diastolicBp, 10) : null,
                respiratory_rate: formData.respiratoryRate ? parseInt(formData.respiratoryRate, 10) : null,
                temperature: formData.temperature ? parseFloat(formData.temperature) : null,
                iculos: formData.iculos ? parseInt(formData.iculos, 10) : 1,
                source: 'manual',
                processed: false,
                collected_at: new Date().toISOString()
            };

            console.log('[ManualVitalsForm] Inserting vitals:', vitalsData);

            const { data, error } = await supabase
                .from('vitals')
                .insert(vitalsData)
                .select()
                .single();

            if (error) throw error;

            console.log('[ManualVitalsForm] Vitals inserted:', data);
            setInsertedVitalsId(data.id);

        } catch (error) {
            console.error('[ManualVitalsForm] Submit error:', error);
            setProcessingStatus('error');
            setErrors({ submit: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content vitals-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <h2>Manual Vitals Entry</h2>
                    <button className="modal-close" onClick={handleClose}>×</button>
                </div>

                {/* Processing State */}
                {processingStatus === 'waiting' && (
                    <div className="processing-banner">
                        <div className="processing-spinner"></div>
                        <span>Processing... Waiting for ML risk assessment</span>
                    </div>
                )}

                {/* Result Display */}
                {processingStatus === 'complete' && riskResult && (
                    <div className={`risk-result risk-${riskResult.risk_level.toLowerCase()}`}>
                        <div className="risk-header">
                            <span className="risk-label">Sepsis Risk Assessment</span>
                            <span className={`risk-badge risk-badge-${riskResult.risk_level.toLowerCase()}`}>
                                {riskResult.risk_level}
                            </span>
                        </div>
                        <div className="risk-details">
                            <div className="risk-probability">
                                <span className="prob-label">Probability</span>
                                <span className="prob-value">{(riskResult.risk_score * 100).toFixed(1)}%</span>
                            </div>
                            {riskResult.reasoning && (
                                <div className="risk-features">
                                    <span>Shock Index: {riskResult.reasoning.features?.shock_index}</span>
                                    <span>MAP: {riskResult.reasoning.features?.map}</span>
                                </div>
                            )}
                        </div>
                        <button className="btn-primary" onClick={handleClose}>
                            Close
                        </button>
                    </div>
                )}

                {/* Error State */}
                {processingStatus === 'error' && (
                    <div className="error-banner">
                        <span>⚠️ Error processing vitals. Please try again.</span>
                        {errors.submit && <p>{errors.submit}</p>}
                        <button className="btn-secondary" onClick={() => setProcessingStatus(null)}>
                            Try Again
                        </button>
                    </div>
                )}

                {/* Form */}
                {processingStatus !== 'complete' && processingStatus !== 'error' && (
                    <form onSubmit={handleSubmit} className="vitals-form">
                        <div className="form-grid-vitals">
                            {/* Heart Rate */}
                            <div className="form-group">
                                <label htmlFor="heartRate">
                                    Heart Rate <span className="required">*</span>
                                    <span className="unit">bpm</span>
                                </label>
                                <input
                                    type="number"
                                    id="heartRate"
                                    name="heartRate"
                                    value={formData.heartRate}
                                    onChange={handleChange}
                                    placeholder="60-100"
                                    min={VITAL_RANGES.heartRate.min}
                                    max={VITAL_RANGES.heartRate.max}
                                    className={errors.heartRate ? 'input-error' : ''}
                                />
                                {errors.heartRate && <span className="error-text">{errors.heartRate}</span>}
                            </div>

                            {/* SpO2 */}
                            <div className="form-group">
                                <label htmlFor="spo2">
                                    SpO2
                                    <span className="unit">%</span>
                                </label>
                                <input
                                    type="number"
                                    id="spo2"
                                    name="spo2"
                                    value={formData.spo2}
                                    onChange={handleChange}
                                    placeholder="95-100"
                                    min={VITAL_RANGES.spo2.min}
                                    max={VITAL_RANGES.spo2.max}
                                    className={errors.spo2 ? 'input-error' : ''}
                                />
                                {errors.spo2 && <span className="error-text">{errors.spo2}</span>}
                            </div>

                            {/* Systolic BP */}
                            <div className="form-group">
                                <label htmlFor="systolicBp">
                                    Systolic BP <span className="required">*</span>
                                    <span className="unit">mmHg</span>
                                </label>
                                <input
                                    type="number"
                                    id="systolicBp"
                                    name="systolicBp"
                                    value={formData.systolicBp}
                                    onChange={handleChange}
                                    placeholder="90-140"
                                    min={VITAL_RANGES.systolicBp.min}
                                    max={VITAL_RANGES.systolicBp.max}
                                    className={errors.systolicBp ? 'input-error' : ''}
                                />
                                {errors.systolicBp && <span className="error-text">{errors.systolicBp}</span>}
                            </div>

                            {/* Diastolic BP */}
                            <div className="form-group">
                                <label htmlFor="diastolicBp">
                                    Diastolic BP
                                    <span className="unit">mmHg</span>
                                </label>
                                <input
                                    type="number"
                                    id="diastolicBp"
                                    name="diastolicBp"
                                    value={formData.diastolicBp}
                                    onChange={handleChange}
                                    placeholder="60-90"
                                    min={VITAL_RANGES.diastolicBp.min}
                                    max={VITAL_RANGES.diastolicBp.max}
                                    className={errors.diastolicBp ? 'input-error' : ''}
                                />
                                {errors.diastolicBp && <span className="error-text">{errors.diastolicBp}</span>}
                            </div>

                            {/* Temperature */}
                            <div className="form-group">
                                <label htmlFor="temperature">
                                    Temperature
                                    <span className="unit">°C</span>
                                </label>
                                <input
                                    type="number"
                                    id="temperature"
                                    name="temperature"
                                    value={formData.temperature}
                                    onChange={handleChange}
                                    placeholder="36.5-37.5"
                                    min={VITAL_RANGES.temperature.min}
                                    max={VITAL_RANGES.temperature.max}
                                    step={VITAL_RANGES.temperature.step}
                                    className={errors.temperature ? 'input-error' : ''}
                                />
                                {errors.temperature && <span className="error-text">{errors.temperature}</span>}
                            </div>

                            {/* Respiratory Rate */}
                            <div className="form-group">
                                <label htmlFor="respiratoryRate">
                                    Respiratory Rate
                                    <span className="unit">/min</span>
                                </label>
                                <input
                                    type="number"
                                    id="respiratoryRate"
                                    name="respiratoryRate"
                                    value={formData.respiratoryRate}
                                    onChange={handleChange}
                                    placeholder="12-20"
                                    min={VITAL_RANGES.respiratoryRate.min}
                                    max={VITAL_RANGES.respiratoryRate.max}
                                    className={errors.respiratoryRate ? 'input-error' : ''}
                                />
                                {errors.respiratoryRate && <span className="error-text">{errors.respiratoryRate}</span>}
                            </div>

                            {/* ICULOS - Hours Since Admission */}
                            <div className="form-group form-group-wide">
                                <label htmlFor="iculos">
                                    Hours Since Admission
                                    <span className="unit">hrs</span>
                                </label>
                                <input
                                    type="number"
                                    id="iculos"
                                    name="iculos"
                                    value={formData.iculos}
                                    onChange={handleChange}
                                    placeholder="1"
                                    min={VITAL_RANGES.iculos.min}
                                    max={VITAL_RANGES.iculos.max}
                                    className={errors.iculos ? 'input-error' : ''}
                                />
                                {errors.iculos && <span className="error-text">{errors.iculos}</span>}
                            </div>
                        </div>

                        <div className="form-actions">
                            <button type="button" className="btn-cancel" onClick={handleClose}>
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit for Analysis'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default ManualVitalsForm;
