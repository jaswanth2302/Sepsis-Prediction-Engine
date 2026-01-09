import React from 'react';
import RiskStatusBadge from './RiskStatusBadge.jsx';

/**
 * PatientRow
 * 
 * Displays a single patient in the patient list.
 * Clickable to navigate to patient monitoring dashboard.
 */

function PatientRow({ patient, onClick }) {
    return (
        <div
            className="patient-row"
            onClick={() => onClick(patient.id)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && onClick(patient.id)}
        >
            <div className="patient-row-cell patient-row-id">
                <span className="cell-label">PATIENT ID</span>
                <span className="cell-value">{patient.id}</span>
            </div>
            <div className="patient-row-cell patient-row-ward">
                <span className="cell-label">WARD</span>
                <span className="cell-value">{patient.ward}</span>
            </div>
            <div className="patient-row-cell patient-row-location">
                <span className="cell-label">LOCATION</span>
                <span className="cell-value">{patient.location}</span>
            </div>
            <div className="patient-row-cell patient-row-status">
                <span className="cell-label">RISK STATUS</span>
                <RiskStatusBadge status={patient.riskStatus} />
            </div>
        </div>
    );
}

export default PatientRow;
