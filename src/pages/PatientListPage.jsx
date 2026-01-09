import React, { useState } from 'react';
import PatientRow from '../components/PatientRow.jsx';
import AddPatientForm from '../components/AddPatientForm.jsx';
import PatientRegistrationFlow from '../components/PatientRegistrationFlow.jsx';

/**
 * PatientListPage
 * 
 * Landing page displaying all monitored patients.
 * Now includes Progressive Sepsis Screening flow.
 */

function PatientListPage({ patients, onPatientSelect, onAddPatient, generatePatientId }) {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showScreeningFlow, setShowScreeningFlow] = useState(false);
    const [pendingPatient, setPendingPatient] = useState(null);

    // Update clock every second
    React.useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = () => {
        return currentTime.toLocaleTimeString('en-US', { hour12: false });
    };

    const formatDate = () => {
        return currentTime.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Count patients by status
    const statusCounts = patients.reduce((acc, patient) => {
        const status = patient.riskStatus.toLowerCase();
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    // Handle adding patient and starting screening
    const handleAddPatientWithScreening = (patientData) => {
        // Store patient data, then show screening flow
        setPendingPatient(patientData);
        setShowScreeningFlow(true);
    };

    // Handle screening complete
    const handleScreeningComplete = (screeningResult) => {
        // Create patient with screening results
        if (pendingPatient) {
            const riskLevel = screeningResult.riskResult?.risk_level || 'Stable';
            onAddPatient({
                ...pendingPatient,
                riskStatus: riskLevel === 'HIGH' ? 'Critical' : 'Stable',
                screeningResult: screeningResult
            });
        }
        setShowScreeningFlow(false);
        setPendingPatient(null);
    };

    // If showing screening flow, render that instead
    if (showScreeningFlow) {
        return (
            <div className="patient-list-page">
                <PatientRegistrationFlow
                    patientInfo={pendingPatient}
                    onComplete={handleScreeningComplete}
                    onCancel={() => {
                        setShowScreeningFlow(false);
                        setPendingPatient(null);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="patient-list-page">
            {/* Header */}
            <header className="list-page-header">
                <div className="header-brand">
                    <h1>Sepsis Monitoring System</h1>
                    <p className="header-tagline">Real-time Patient Monitoring • Non-ICU Sepsis Screening</p>
                </div>
                <div className="header-time">
                    <div className="time-display">{formatTime()}</div>
                    <div className="date-display">{formatDate()}</div>
                </div>
            </header>

            {/* Stats Overview */}
            <section className="stats-bar">
                <div className="stat-item">
                    <span className="stat-value">{patients.length}</span>
                    <span className="stat-label">Total Patients</span>
                </div>
                <div className="stat-item stat-stable">
                    <span className="stat-value">{statusCounts.stable || 0}</span>
                    <span className="stat-label">Stable</span>
                </div>
                <div className="stat-item stat-moderate">
                    <span className="stat-value">{statusCounts.moderate || 0}</span>
                    <span className="stat-label">Moderate</span>
                </div>
                <div className="stat-item stat-critical">
                    <span className="stat-value">{statusCounts.critical || 0}</span>
                    <span className="stat-label">Critical</span>
                </div>
            </section>

            {/* Add Patient Form */}
            <section className="add-patient-section">
                <AddPatientForm
                    onAddPatient={handleAddPatientWithScreening}
                    generatePatientId={generatePatientId}
                />
            </section>

            {/* Patient List */}
            <section className="patient-list-section">
                <div className="section-header">
                    <h2>Active Patients</h2>
                    <span className="patient-count">{patients.length} patients</span>
                </div>

                <div className="patient-list">
                    {patients.length === 0 ? (
                        <div className="empty-state">
                            <p>No patients registered yet.</p>
                            <p className="empty-hint">Click "Add New Patient" to register and begin sepsis screening.</p>
                        </div>
                    ) : (
                        patients.map(patient => (
                            <PatientRow
                                key={patient.id}
                                patient={patient}
                                onClick={onPatientSelect}
                            />
                        ))
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="list-page-footer">
                <p>FOR CLINICAL MONITORING ONLY • NOT FOR DIAGNOSIS OR TREATMENT DECISIONS</p>
            </footer>
        </div>
    );
}

export default PatientListPage;

