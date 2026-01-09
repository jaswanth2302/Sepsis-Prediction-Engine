/**
 * MLPredictionStream.js
 * 
 * Real-time stream that connects to Supabase for ML predictions.
 * Replaces DemoVitalSimulator with actual backend data.
 */

import { supabase } from '../lib/supabase';

class MLPredictionStream {
    constructor() {
        this.subscribers = new Map(); // visualType -> [callbacks]
        this.alertSubscribers = [];
        this.realtimeChannel = null; // Renamed to 'channel' in the new disconnect, but keeping 'realtimeChannel' for now as it's used in handlePrediction
        this.currentSimulationId = null;
        this.latestValues = {};
        this.isConnected = false;

        // Track last values for auto-sustain
        this.lastValues = new Map();
        this.lastEmissionTimes = new Map();
        this.sustainInterval = null;

        this.connect();
    }

    /**
     * Connect to Supabase realtime for vital_predictions updates
     */
    connect() {
        if (this.isConnected) return;

        console.log('[MLStream] Connecting to Supabase realtime...');
        this.isConnected = true;
        this.startSustainLoop();

        this.realtimeChannel = supabase
            .channel('vital_predictions_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'vital_predictions'
                },
                (payload) => {
                    this.handlePrediction(payload.new);
                }
            )
            .subscribe((status) => {
                console.log('[MLStream] Subscription status:', status);
            });
    }

    startSustainLoop() {
        if (this.sustainInterval) clearInterval(this.sustainInterval);

        this.sustainInterval = setInterval(() => {
            const now = Date.now();

            this.lastValues.forEach((val, vitalType) => {
                const lastTime = this.lastEmissionTimes.get(vitalType) || 0;

                // If silence for > 1s, emit a sustain value
                if (now - lastTime > 1000) {
                    // Add slight jitter to keep graph "alive"
                    const jitter = (Math.random() - 0.5) * 0.5; // +/- 0.25 jitter
                    const sustainedValue = val + jitter;

                    // Don't update lastEmissionTime to allow continuous sustaining
                    // But we MUST emit via internal helper to avoid infinite recursion if we updated logic there
                    // Actually, emitVital updates tracking, so we should call a raw emit or be careful.
                    // Let's call emitVital but pass a flag or just let it update time is fine.
                    // If we update time, it won't emit again for 1s. That's too slow.
                    // We want 500ms updates.

                    // Let's just emit directly to subscribers
                    this.emitVital({
                        type: vitalType,
                        value: sustainedValue,
                        unit: this.getUnit(vitalType),
                        timestamp: now,
                        phase: 'sustained'
                    }, true); // isSustain flag
                }
            });
        }, 500); // Check/Emit every 500ms
    }

    /**
     * Handle incoming prediction from backend
     */
    handlePrediction(prediction) {
        const timestamp = new Date().getTime();

        // Map prediction columns to vital types
        const vitals = [
            { type: 'heart_rate', value: prediction.hr_predicted, unit: 'bpm' },
            { type: 'respiratory_rate', value: prediction.resp_predicted, unit: '/min' },
            { type: 'temperature', value: prediction.temp_predicted, unit: '°C' },
            { type: 'spo2', value: prediction.o2sat_predicted, unit: '%' },
            { type: 'systolic_bp', value: prediction.sbp_predicted, unit: 'mmHg' }
        ];

        // Determine phase based on risk score
        const riskScore = prediction.risk_score || 0;
        let phase = 'stable';
        if (riskScore > 0.7) phase = 'critical';
        else if (riskScore > 0.5) phase = 'deteriorating';
        else if (riskScore > 0.3) phase = 'earlyWarning';

        // Emit each vital to subscribers
        vitals.forEach(vital => {
            if (vital.value !== null && vital.value !== undefined) {
                this.emitVital({
                    type: vital.type,
                    value: vital.value,
                    unit: vital.unit,
                    timestamp: timestamp + (prediction.sequence_index * 1000),
                    phase: phase,
                    riskScore: riskScore,
                    sequenceIndex: prediction.sequence_index
                });

                this.latestValues[vital.type] = vital.value;
            }
        });

        // Check for alerts
        if (riskScore > 0.5) {
            this.emitAlert({
                type: 'SEPSIS_RISK',
                level: riskScore > 0.7 ? 'CRITICAL' : 'WARNING',
                message: `Sepsis risk: ${(riskScore * 100).toFixed(0)}%`,
                timestamp: timestamp
            });
        }
    }

    /**
     * Subscribe to a specific vital type
     */
    subscribeToVital(vitalType, callback) {
        if (!this.subscribers.has(vitalType)) {
            this.subscribers.set(vitalType, []);
        }
        this.subscribers.get(vitalType).push(callback);

        // Connect if not already connected
        if (!this.isConnected) {
            this.connect();
        }

        // Unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(vitalType);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * Subscribe to alerts
     */
    subscribeToAlerts(callback) {
        this.alertCallbacks.push(callback);

        return () => {
            const index = this.alertCallbacks.indexOf(callback);
            if (index > -1) {
                this.alertCallbacks.splice(index, 1);
                this.alertSubscribers.splice(index, 1);
            }
        };
    }

    /**
     * Emit vital data to subscribers
     */
    emitVital(dataPoint, isSustain = false) {
        // Track for auto-sustain, unless this IS a sustain emission
        if (!isSustain) {
            this.lastValues.set(dataPoint.type, dataPoint.value);
            this.lastEmissionTimes.set(dataPoint.type, Date.now());
        }

        const callbacks = this.subscribers.get(dataPoint.type);
        if (callbacks) {
            callbacks.forEach(cb => cb(dataPoint));
        }
    }

    /**
     * Emit alert to subscribers
     */
    emitAlert(alert) {
        this.alertSubscribers.forEach(cb => cb(alert));
    }

    /**
     * Manually push a vital reading (for immediate updates)
     */
    pushVital(vitalType, value, phase = 'stable') {
        this.emitVital({
            type: vitalType,
            value: value,
            unit: this.getUnit(vitalType),
            timestamp: Date.now(),
            phase: phase
        });
    }

    /**
     * Get unit for vital type
     */
    getUnit(vitalType) {
        const units = {
            heart_rate: 'bpm',
            respiratory_rate: '/min',
            temperature: '°C',
            spo2: '%',
            systolic_bp: 'mmHg',
            diastolic_bp: 'mmHg'
        };
        return units[vitalType] || '';
    }

    /**
     * Disconnect from Supabase
     */
    disconnect() {
        if (this.sustainInterval) clearInterval(this.sustainInterval);

        if (this.realtimeChannel) {
            supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
        this.subscribers.clear();
        this.alertSubscribers = [];
        this.isConnected = false;
    }

    /**
     * Get latest values for all vitals
     */
    getLatestValues() {
        return { ...this.latestValues };
    }
}

export const mlPredictionStream = new MLPredictionStream();
export default MLPredictionStream;
