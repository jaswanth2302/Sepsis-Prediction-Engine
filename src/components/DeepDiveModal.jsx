import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DeepDiveModal = ({ isOpen, onClose, data, patientName }) => {
    if (!isOpen || !data) return null;

    const { risk_level, risk_score, reasoning } = data;
    const {
        qsofa_score,
        sirs_score,
        active_stage,
        alerts = [],
        features = {},
        model
    } = reasoning || {};

    return (
        <AnimatePresence>
            <motion.div
                className="modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="modal-content deep-dive"
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-header">
                        <div>
                            <h2>Clinical Analysis</h2>
                            <p className="patient-ref">{patientName}</p>
                        </div>
                        <button className="close-btn" onClick={onClose}>×</button>
                    </div>

                    <div className="modal-body">
                        {/* Risk Overview */}
                        <div className={`risk-banner ${risk_level.toLowerCase()}`}>
                            <div className="risk-score">
                                <span className="label">Sepsis Probability</span>
                                <span className="value">{(risk_score * 100).toFixed(1)}%</span>
                            </div>
                            <div className="risk-level">
                                <span className="badge">{risk_level} INFECTION RISK</span>
                            </div>
                        </div>

                        {/* Clinical Scores Grid */}
                        <div className="scores-grid">
                            <div className="score-card">
                                <h4>qSOFA Score</h4>
                                <div className={`score-value ${qsofa_score >= 2 ? 'critical' : 'stable'}`}>
                                    {qsofa_score} <span className="max">/ 3</span>
                                </div>
                                <p className="desc">Quick Sepsis Related Organ Failure Assessment</p>
                            </div>
                            <div className="score-card">
                                <h4>SIRS Score</h4>
                                <div className={`score-value ${sirs_score >= 2 ? 'critical' : 'stable'}`}>
                                    {sirs_score} <span className="max">/ 4</span>
                                </div>
                                <p className="desc">Systemic Inflammatory Response Syndrome</p>
                            </div>
                            <div className="score-card">
                                <h4>Active Stage</h4>
                                <div className="score-value neutral">
                                    {active_stage}
                                </div>
                                <p className="desc">Progressive Screening Stage</p>
                            </div>
                        </div>

                        {/* Active Clinical Alerts */}
                        {alerts.length > 0 && (
                            <div className="alerts-section">
                                <h3>Detected Clinical Drivers</h3>
                                <ul className="alerts-list">
                                    {alerts.map((alert, idx) => (
                                        <li key={idx} className="alert-item">
                                            <span className="icon">⚠️</span>
                                            {alert}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* ML Features */}
                        <div className="features-section">
                            <h3>Model Features</h3>
                            <div className="features-grid">
                                <div className="feature">
                                    <label>Shock Index</label>
                                    <span>{features.shock_index}</span>
                                </div>
                                <div className="feature">
                                    <label>MAP</label>
                                    <span>{features.map} mmHg</span>
                                </div>
                                <div className="feature">
                                    <label>Model Type</label>
                                    <span>{model}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default DeepDiveModal;
