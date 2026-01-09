import React, { useState } from 'react';
import PatientDashboard from './pages/PatientDashboard.jsx';
import PatientListPage from './pages/PatientListPage.jsx';
import { usePatients } from './hooks/usePatients.js';

/**
 * App
 * 
 * Root application component with simple state-based routing.
 * - Landing page: PatientListPage (patient list + add patient)
 * - Monitoring page: PatientDashboard (vital signs for selected patient)
 */

function App() {
    const [currentPage, setCurrentPage] = useState('list'); // 'list' or 'dashboard'
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    const {
        patients,
        addPatient,
        getPatient,
        updatePatientStatus,
        generatePatientId
    } = usePatients();

    const handlePatientSelect = (patientId) => {
        setSelectedPatientId(patientId);
        setCurrentPage('dashboard');
    };

    const handleBackToList = () => {
        setCurrentPage('list');
        setSelectedPatientId(null);
    };

    const handleStatusChange = (newStatus) => {
        if (selectedPatientId) {
            updatePatientStatus(selectedPatientId, newStatus);
        }
    };

    const selectedPatient = selectedPatientId ? getPatient(selectedPatientId) : null;

    return (
        <div className="app">
            {currentPage === 'list' ? (
                <PatientListPage
                    patients={patients}
                    onPatientSelect={handlePatientSelect}
                    onAddPatient={addPatient}
                    generatePatientId={generatePatientId}
                />
            ) : (
                <PatientDashboard
                    patient={selectedPatient}
                    onBack={handleBackToList}
                    onStatusChange={handleStatusChange}
                />
            )}
        </div>
    );
}

export default App;
