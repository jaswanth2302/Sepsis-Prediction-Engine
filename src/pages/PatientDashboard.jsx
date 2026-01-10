import React, { useState, useEffect } from 'react';
import VitalPanel from '../components/VitalPanel.jsx';
import RiskStatusBadge from '../components/RiskStatusBadge.jsx';
import AlertPanel from '../components/AlertPanel.jsx';
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
                </aside>
            </main>

            {/* Footer */}
            <footer className="dashboard-footer">
                <p>FOR CLINICAL MONITORING ONLY • NOT FOR DIAGNOSIS OR TREATMENT DECISIONS</p>
            </footer>
        </div>
    );
}

export default PatientDashboard;
