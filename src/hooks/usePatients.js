import { useState, useCallback } from 'react';

/**
 * usePatients Hook
 * 
 * Manages patient state for the application.
 * Provides methods to add, get, and list patients.
 */

// Generate unique patient ID
const generatePatientId = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `PT-${year}-${randomNum}`;
};

// Initial demo patients (Non-ICU only)
const initialPatients = [
    {
        id: 'PT-2026-001847',
        ward: 'Non-ICU / General',
        location: 'Bed 12A',
        riskStatus: 'Stable',
        admissionDate: '2026-01-08',
        name: 'John Doe',
        age: 45
    },
    {
        id: 'PT-2026-002134',
        ward: 'Post-Op Recovery',
        location: 'Bed 05B',
        riskStatus: 'Moderate',
        admissionDate: '2026-01-07',
        name: 'Jane Smith',
        age: 62
    },
    {
        id: 'PT-2026-001923',
        ward: 'Non-ICU / General',
        location: 'Bed 08C',
        riskStatus: 'Stable',
        admissionDate: '2026-01-09',
        name: 'Robert Johnson',
        age: 38
    }
];

export function usePatients() {
    const [patients, setPatients] = useState(initialPatients);

    const addPatient = useCallback((patientData) => {
        const newPatient = {
            id: patientData.id || generatePatientId(),
            ward: patientData.ward || 'Non-ICU / General',
            location: patientData.location || 'Unassigned',
            riskStatus: 'Stable',
            admissionDate: new Date().toISOString().split('T')[0],
            name: patientData.name || 'Unknown',
            age: patientData.age || null
        };

        setPatients(prev => [...prev, newPatient]);
        return newPatient;
    }, []);

    const getPatient = useCallback((patientId) => {
        return patients.find(p => p.id === patientId) || null;
    }, [patients]);

    const updatePatientStatus = useCallback((patientId, newStatus) => {
        setPatients(prev =>
            prev.map(p =>
                p.id === patientId
                    ? { ...p, riskStatus: newStatus }
                    : p
            )
        );
    }, []);

    return {
        patients,
        addPatient,
        getPatient,
        updatePatientStatus,
        generatePatientId
    };
}

export default usePatients;
