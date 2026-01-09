/**
 * DemoVitalSimulator - Patient Scenario Mode
 * 
 * Simulates realistic patient deterioration for presentation.
 * Shows how vitals escalate and trigger alerts.
 * 
 * Scenario: Patient with developing sepsis
 * - Phase 1 (0-30s): Stable vitals
 * - Phase 2 (30-60s): Early warning signs
 * - Phase 3 (60-90s): Deterioration
 * - Phase 4 (90s+): Critical state
 */

import { THRESHOLDS } from '../theme/vitalTheme.js';

// Scenario phases with target vital ranges
const SCENARIO_PHASES = {
    stable: {
        duration: 30000, // 30 seconds
        vitals: {
            heart_rate: { target: 75, variance: 3 },
            respiratory_rate: { target: 16, variance: 1 },
            temperature: { target: 37.0, variance: 0.1 },
            spo2: { target: 98, variance: 1 },
            systolic_bp: { target: 120, variance: 3 },
            diastolic_bp: { target: 80, variance: 2 }
        }
    },
    earlyWarning: {
        duration: 30000,
        vitals: {
            heart_rate: { target: 95, variance: 4 },
            respiratory_rate: { target: 20, variance: 2 },
            temperature: { target: 37.8, variance: 0.2 },
            spo2: { target: 95, variance: 1 },
            systolic_bp: { target: 105, variance: 5 },
            diastolic_bp: { target: 70, variance: 3 }
        }
    },
    deteriorating: {
        duration: 30000,
        vitals: {
            heart_rate: { target: 110, variance: 5 },
            respiratory_rate: { target: 24, variance: 2 },
            temperature: { target: 38.5, variance: 0.2 },
            spo2: { target: 92, variance: 2 },
            systolic_bp: { target: 95, variance: 5 },
            diastolic_bp: { target: 60, variance: 3 }
        }
    },
    critical: {
        duration: Infinity,
        vitals: {
            heart_rate: { target: 125, variance: 8 },
            respiratory_rate: { target: 28, variance: 3 },
            temperature: { target: 39.2, variance: 0.3 },
            spo2: { target: 88, variance: 3 },
            systolic_bp: { target: 85, variance: 8 },
            diastolic_bp: { target: 50, variance: 5 }
        }
    }
};

const PHASE_ORDER = ['stable', 'earlyWarning', 'deteriorating', 'critical'];

class DemoVitalSimulator {
    constructor() {
        this.subscribers = new Map();
        this.alertSubscribers = new Map();
        this.currentValues = {
            heart_rate: 75,
            respiratory_rate: 16,
            temperature: 37.0,
            spo2: 98,
            systolic_bp: 120,
            diastolic_bp: 80
        };
        this.intervalId = null;
        this.isRunning = false;
        this.startTime = null;
        this.currentPhaseIndex = 0;
        this.activeAlerts = new Set();
    }

    getCurrentPhase() {
        if (!this.startTime) return SCENARIO_PHASES.stable;

        const elapsed = Date.now() - this.startTime;
        let accumulatedTime = 0;

        for (let i = 0; i < PHASE_ORDER.length; i++) {
            const phase = SCENARIO_PHASES[PHASE_ORDER[i]];
            accumulatedTime += phase.duration;
            if (elapsed < accumulatedTime) {
                this.currentPhaseIndex = i;
                return phase;
            }
        }

        this.currentPhaseIndex = PHASE_ORDER.length - 1;
        return SCENARIO_PHASES.critical;
    }

    getPhaseName() {
        return PHASE_ORDER[this.currentPhaseIndex];
    }

    generateNextValue(vitalType) {
        const phase = this.getCurrentPhase();
        const config = phase.vitals[vitalType];
        const current = this.currentValues[vitalType];

        // Gradually move toward target
        const diff = config.target - current;
        const step = diff * 0.15; // Move 15% toward target each tick

        // Add random variance
        const randomVariance = (Math.random() - 0.5) * 2 * config.variance;

        let newValue = current + step + randomVariance;

        // Round appropriately
        if (vitalType === 'temperature') {
            newValue = Math.round(newValue * 10) / 10;
        } else {
            newValue = Math.round(newValue);
        }

        // Keep SpO2 max at 100
        if (vitalType === 'spo2') {
            newValue = Math.min(100, newValue);
        }

        this.currentValues[vitalType] = newValue;
        return newValue;
    }

    checkThresholds(vitalType, value) {
        const threshold = THRESHOLDS[vitalType];
        if (!threshold) return null;

        let severity = null;
        let message = '';

        // Check critical first
        if (vitalType === 'spo2' || vitalType === 'systolic_bp' || vitalType === 'diastolic_bp') {
            // These are critical when LOW
            if (value <= threshold.critical) {
                severity = 'CRITICAL';
                message = `${vitalType.replace('_', ' ').toUpperCase()} critically low: ${value}`;
            } else if (value < threshold.min) {
                severity = 'WARNING';
                message = `${vitalType.replace('_', ' ').toUpperCase()} below normal: ${value}`;
            }
        } else {
            // These are critical when HIGH
            if (value >= threshold.critical) {
                severity = 'CRITICAL';
                message = `${vitalType.replace('_', ' ').toUpperCase()} critically high: ${value}`;
            } else if (value > threshold.max) {
                severity = 'WARNING';
                message = `${vitalType.replace('_', ' ').toUpperCase()} above normal: ${value}`;
            }
        }

        return severity ? { severity, message, vitalType, value } : null;
    }

    emitData() {
        const timestamp = new Date().toISOString();
        const alerts = [];

        Object.keys(this.currentValues).forEach(vitalType => {
            const value = this.generateNextValue(vitalType);
            const dataPoint = {
                type: vitalType,
                timestamp,
                value,
                unit: this.getUnit(vitalType),
                phase: this.getPhaseName()
            };

            // Check for alerts
            const alert = this.checkThresholds(vitalType, value);
            if (alert) {
                alert.timestamp = timestamp;
                alert.id = `${vitalType}-${Date.now()}`;
                alerts.push(alert);
            }

            // Notify vital subscribers
            this.subscribers.forEach((callback) => {
                callback(dataPoint);
            });
        });

        // Notify alert subscribers
        if (alerts.length > 0) {
            this.alertSubscribers.forEach((callback) => {
                alerts.forEach(alert => callback(alert));
            });
        }
    }

    getUnit(vitalType) {
        switch (vitalType) {
            case 'heart_rate': return 'bpm';
            case 'respiratory_rate': return '/min';
            case 'temperature': return '°C';
            case 'spo2': return '%';
            case 'systolic_bp':
            case 'diastolic_bp': return 'mmHg';
            default: return '';
        }
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startTime = Date.now();
        this.currentPhaseIndex = 0;

        // Reset to stable values
        this.currentValues = {
            heart_rate: 75,
            respiratory_rate: 16,
            temperature: 37.0,
            spo2: 98,
            systolic_bp: 120,
            diastolic_bp: 80
        };

        // Emit immediately on start
        this.emitData();
        // Then emit every 3 seconds for faster demo
        this.intervalId = setInterval(() => this.emitData(), 3000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        this.startTime = null;
    }

    restart() {
        this.stop();
        setTimeout(() => this.start(), 100);
    }

    subscribe(callback) {
        const id = Math.random().toString(36).substr(2, 9);
        this.subscribers.set(id, callback);

        if (this.subscribers.size === 1) {
            this.start();
        }

        return id;
    }

    subscribeToAlerts(callback) {
        const id = Math.random().toString(36).substr(2, 9);
        this.alertSubscribers.set(id, callback);
        return id;
    }

    unsubscribe(id) {
        this.subscribers.delete(id);

        if (this.subscribers.size === 0) {
            this.stop();
        }
    }

    unsubscribeFromAlerts(id) {
        this.alertSubscribers.delete(id);
    }
}

export const demoSimulator = new DemoVitalSimulator();
export default DemoVitalSimulator;
