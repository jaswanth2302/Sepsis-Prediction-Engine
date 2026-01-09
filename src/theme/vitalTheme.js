/**
 * Vital Theme - Classic ICU Monitor Style
 * 
 * Complete vital sign color system including:
 * - Heart Rate (HR) - Green
 * - Respiratory Rate (RR) - Yellow  
 * - Temperature - Cyan
 * - Blood Pressure (BP) - Red
 * - SpO2 - Magenta/Pink
 */

export const VITAL_THEME = {
    // Global dark theme
    background: "#0a0a0a",
    cardBackground: "#111111",
    gridColor: "#1a2a1a",
    textPrimary: "#ffffff",
    textSecondary: "#888888",
    alertBackground: "#1a0a0a",

    // Heart Rate - Classic green (ECG style)
    heartRate: {
        accent: "#00ff00",
        waveColor: "#00ff00",
        bg: "#0a1a0a",
        threshold: "#ff4444",
        label: "HR",
        unit: "bpm"
    },

    // Respiratory Rate - Yellow
    respiratoryRate: {
        accent: "#ffff00",
        waveColor: "#ffff00",
        bg: "#1a1a0a",
        threshold: "#ff4444",
        label: "RESP",
        unit: "/min"
    },

    // Temperature - Cyan
    temperature: {
        accent: "#00ffff",
        waveColor: "#00ffff",
        bg: "#0a1a1a",
        threshold: "#ff4444",
        label: "TEMP",
        unit: "°C"
    },

    // SpO2 - Magenta/Pink
    spo2: {
        accent: "#ff66ff",
        waveColor: "#ff66ff",
        bg: "#1a0a1a",
        threshold: "#ff4444",
        label: "SpO2",
        unit: "%"
    },

    // Blood Pressure - Red
    bloodPressure: {
        accent: "#ff4444",
        waveColor: "#ff4444",
        bg: "#1a0a0a",
        threshold: "#ff4444",
        label: "NIBP",
        unit: "mmHg"
    }
};

// Mapping from vital type keys to theme keys
export const VITAL_TYPE_MAP = {
    heart_rate: 'heartRate',
    respiratory_rate: 'respiratoryRate',
    temperature: 'temperature',
    spo2: 'spo2',
    systolic_bp: 'bloodPressure',
    diastolic_bp: 'bloodPressure'
};

// Clinical thresholds for sepsis screening
export const THRESHOLDS = {
    heart_rate: { min: 60, max: 100, critical: 120 },
    respiratory_rate: { min: 12, max: 20, critical: 25 },
    temperature: { min: 36.5, max: 38.0, critical: 39.0 },
    spo2: { min: 95, max: 100, critical: 90 },
    systolic_bp: { min: 90, max: 140, critical: 85 },
    diastolic_bp: { min: 60, max: 90, critical: 55 }
};

export default VITAL_THEME;
