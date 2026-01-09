import React, { useState, useEffect } from 'react';
import VitalPanel from '../components/VitalPanel.jsx';
import RiskStatusBadge from '../components/RiskStatusBadge.jsx';
import AlertPanel from '../components/AlertPanel.jsx';
import ManualVitalsForm from '../components/ManualVitalsForm.jsx';
import { vitalStream } from '../streams/VitalWebSocket.js';

/**
 * PatientDashboard
 * 
 * Main dashboard page for non-ICU vital sign monitoring.
 * Includes real-time vitals, alerts, and demo controls.
 */

function PatientDashboard({ patient, onBack, onStatusChange }) {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [patientStatus, setPatientStatus] = useState(patient?.riskStatus || 'Stable');
    const [showVitalsForm, setShowVitalsForm] = useState(false);

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Reset stream when patient changes
    useEffect(() => {
        vitalStream.restart();
        setPatientStatus(patient?.riskStatus || 'Stable');
    }, [patient?.id]);

    const handlePhaseChange = (phase) => {
        let newStatus;
        switch (phase) {
            case 'stable':
                newStatus = 'Stable';
                break;
            case 'earlyWarning':
                newStatus = 'Moderate';
                break;
            case 'deteriorating':
            case 'critical':
                newStatus = 'Critical';
                break;
            default:
                newStatus = 'Stable';
        }
        setPatientStatus(newStatus);
        if (onStatusChange) {
            onStatusChange(newStatus);
        }
    };

    const handleRestart = () => {
        vitalStream.restart();
    };

    // Use patient prop or fallback to demo data
    const patientInfo = patient || {
        id: 'PT-2026-001847',
        ward: 'Non-ICU / General',
        location: 'Bed 12A',
        admissionDate: '2026-01-08'
    };

    const formatTime = () => {
        return currentTime.toLocaleTimeString('en-US', { hour12: false });
    };

    return (
        <div className="patient-dashboard">
            {/* Header Section */}
            <header className="dashboard-header">
                <div className="header-left">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="back-button"
                        >
                            ← Back to Patients
                        </button>
                    )}
                    <div>
                        <h1>Vital Signs Monitor</h1>
                        <p className="header-subtitle">Continuous Non-ICU Monitoring • Sepsis Screening</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={handleRestart}
                        style={{
                            background: 'rgba(0, 255, 0, 0.15)',
                            border: '1px solid rgba(0, 255, 0, 0.3)',
                            color: '#00ff00',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'uppercase'
                        }}
                    >
                        ↻ Restart Demo
                    </button>
                    <button
                        onClick={() => setShowVitalsForm(true)}
                        className="ml-analysis-btn"
                    >
                        <span className="btn-icon">🧬</span>
                        ML Analysis
                    </button>
                    <div className="current-time">
                        {formatTime()}
                    </div>
                </div>
            </header>

            {/* Patient Info Bar */}
            <section className="patient-info-bar">
                <div className="patient-id">
                    <span className="label">Patient ID</span>
                    <span className="value">{patientInfo.id}</span>
                </div>
                <div className="patient-ward">
                    <span className="label">Ward</span>
                    <span className="value">{patientInfo.ward}</span>
                </div>
                <div className="patient-bed">
                    <span className="label">Location</span>
                    <span className="value">{patientInfo.location}</span>
                </div>
                <div className="patient-status">
                    <span className="label">Risk Status</span>
                    <RiskStatusBadge status={patientStatus} />
                </div>
            </section>

            {/* Main Content - Vitals + Alerts Grid */}
            <main style={{
                display: 'grid',
                gridTemplateColumns: '1fr 300px',
                gap: '16px'
            }}>
                <div className="dashboard-main">
                    <VitalPanel onPhaseChange={handlePhaseChange} />
                </div>

                <aside style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <AlertPanel vitalStream={vitalStream} />

                    {/* Demo Info Card */}
                    <div style={{
                        background: '#111',
                        borderRadius: '4px',
                        padding: '12px',
                        border: '1px solid #333'
                    }}>
                        <h4 style={{
                            margin: '0 0 8px 0',
                            fontSize: '0.6875rem',
                            color: '#888',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            Demo Scenario
                        </h4>
                        <div style={{ fontSize: '0.75rem', color: '#ccc', lineHeight: 1.6 }}>
                            <p style={{ margin: '0 0 6px 0' }}>
                                <strong style={{ color: '#00ff00' }}>0-30s:</strong> Stable vitals
                            </p>
                            <p style={{ margin: '0 0 6px 0' }}>
                                <strong style={{ color: '#ffff00' }}>30-60s:</strong> Early warning signs
                            </p>
                            <p style={{ margin: '0 0 6px 0' }}>
                                <strong style={{ color: '#ff8800' }}>60-90s:</strong> Deterioration
                            </p>
                            <p style={{ margin: 0 }}>
                                <strong style={{ color: '#ff4444' }}>90s+:</strong> Critical state
                            </p>
                        </div>
                    </div>
                </aside>
            </main>

            {/* Footer */}
            <footer className="dashboard-footer">
                <p>FOR CLINICAL MONITORING ONLY • NOT FOR DIAGNOSIS OR TREATMENT DECISIONS</p>
            </footer>

            {/* Manual Vitals Form Modal */}
            <ManualVitalsForm
                isOpen={showVitalsForm}
                onClose={() => setShowVitalsForm(false)}
                patientId={patientInfo.id}
            />
        </div>
    );
}

export default PatientDashboard;
