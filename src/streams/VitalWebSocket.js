/**
 * VitalWebSocket
 * 
 * Abstraction layer for vital sign data streaming.
 * Now includes alert subscription support.
 */

import { demoSimulator } from './DemoVitalSimulator.js';

class VitalWebSocket {
    constructor(options = {}) {
        this.subscriptionId = null;
        this.alertSubscriptionId = null;
        this.vitalCallbacks = new Map();
        this.alertCallbacks = [];
    }

    subscribeToVital(vitalType, callback) {
        if (!this.vitalCallbacks.has(vitalType)) {
            this.vitalCallbacks.set(vitalType, []);
        }
        this.vitalCallbacks.get(vitalType).push(callback);

        if (!this.subscriptionId) {
            this.subscriptionId = demoSimulator.subscribe((dataPoint) => {
                this.handleIncomingData(dataPoint);
            });
        }

        return () => {
            const callbacks = this.vitalCallbacks.get(vitalType);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    subscribeToAlerts(callback) {
        this.alertCallbacks.push(callback);

        if (!this.alertSubscriptionId) {
            this.alertSubscriptionId = demoSimulator.subscribeToAlerts((alert) => {
                this.alertCallbacks.forEach(cb => cb(alert));
            });
        }

        return () => {
            const index = this.alertCallbacks.indexOf(callback);
            if (index > -1) {
                this.alertCallbacks.splice(index, 1);
            }
        };
    }

    handleIncomingData(dataPoint) {
        const callbacks = this.vitalCallbacks.get(dataPoint.type);
        if (callbacks) {
            callbacks.forEach(cb => cb({
                timestamp: dataPoint.timestamp,
                value: dataPoint.value,
                unit: dataPoint.unit,
                phase: dataPoint.phase
            }));
        }
    }

    restart() {
        demoSimulator.restart();
    }

    disconnect() {
        if (this.subscriptionId) {
            demoSimulator.unsubscribe(this.subscriptionId);
            this.subscriptionId = null;
        }
        if (this.alertSubscriptionId) {
            demoSimulator.unsubscribeFromAlerts(this.alertSubscriptionId);
            this.alertSubscriptionId = null;
        }
        this.vitalCallbacks.clear();
        this.alertCallbacks = [];
    }
}

export const vitalStream = new VitalWebSocket();
export default VitalWebSocket;
