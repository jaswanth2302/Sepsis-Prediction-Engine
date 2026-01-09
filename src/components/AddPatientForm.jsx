import React, { useState } from 'react';

/**
 * AddPatientForm
 * 
 * Form component for adding new patients to the monitoring system.
 */

const WARD_OPTIONS = [
    'Non-ICU / General',
    'Post-Op Recovery',
    'Emergency Observation',
    'Step-Down Unit',
    'Medical Ward',
    'Surgical Ward'
];

function AddPatientForm({ onAddPatient, generatePatientId }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        age: '',
        ward: 'Non-ICU / General',
        location: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.location.trim()) {
            return;
        }

        onAddPatient({
            name: formData.name.trim(),
            age: formData.age ? parseInt(formData.age, 10) : null,
            ward: formData.ward,
            location: formData.location.trim()
        });

        // Reset form
        setFormData({
            name: '',
            age: '',
            ward: 'Non-ICU / General',
            location: ''
        });
        setIsExpanded(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (!isExpanded) {
        return (
            <button
                className="add-patient-btn"
                onClick={() => setIsExpanded(true)}
            >
                <span className="add-icon">+</span>
                Add New Patient
            </button>
        );
    }

    return (
        <form className="add-patient-form" onSubmit={handleSubmit}>
            <div className="form-header">
                <h3>Register New Patient</h3>
                <button
                    type="button"
                    className="close-btn"
                    onClick={() => setIsExpanded(false)}
                >
                    ×
                </button>
            </div>

            <div className="form-grid">
                <div className="form-group">
                    <label htmlFor="name">Patient Name</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Enter patient name"
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="age">Age</label>
                    <input
                        type="number"
                        id="age"
                        name="age"
                        value={formData.age}
                        onChange={handleChange}
                        placeholder="Age"
                        min="0"
                        max="150"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="ward">Ward</label>
                    <select
                        id="ward"
                        name="ward"
                        value={formData.ward}
                        onChange={handleChange}
                    >
                        {WARD_OPTIONS.map(ward => (
                            <option key={ward} value={ward}>{ward}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="location">Bed / Location</label>
                    <input
                        type="text"
                        id="location"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="e.g., Bed 12A"
                        required
                    />
                </div>
            </div>

            <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsExpanded(false)}>
                    Cancel
                </button>
                <button type="submit" className="btn-submit">
                    Add Patient
                </button>
            </div>
        </form>
    );
}

export default AddPatientForm;
