"""
Sepsis Watcher v2.0 - Progressive Real-time Inference Service

Features:
- Forward-chaining qSOFA stage logic
- Dual model support (classifier + forecaster) 
- 5-second autoregressive simulation bursts
- Partial data imputation for staged input

Usage:
    python sepsis_watcher.py
"""

import os
import pickle
import time
import uuid
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
MODEL_PATH = Path(__file__).parent / "sepsis_model.pkl"
FORECASTER_PATH = Path(__file__).parent / "vital_forecaster.pkl"
POLL_INTERVAL = 2  # seconds
SIMULATION_STEPS = 5  # 5-second burst

# ============================================================
# CLINICAL THRESHOLDS (Sepsis-3 / qSOFA Guidelines)
# ============================================================

THRESHOLDS = {
    # qSOFA criteria
    'resp_qsofa': 22,      # Resp >= 22 /min
    'sbp_qsofa': 100,      # SBP <= 100 mmHg
    
    # SIRS criteria
    'temp_high': 38.0,     # Temp > 38°C
    'temp_low': 36.0,      # Temp < 36°C
    'hr_sirs': 90,         # HR > 90 bpm
    'resp_sirs': 20,       # Resp > 20 /min
    'wbc_high': 12000,     # WBC > 12,000
    'wbc_low': 4000,       # WBC < 4,000
    
    # Critical thresholds
    'hr_critical': 120,
    'sbp_critical': 90,
    'map_critical': 65,     # Septic shock threshold
    'o2sat_critical': 90,
    'temp_critical': 39.0
}

# Clinical defaults for imputation
CLINICAL_DEFAULTS = {
    'heart_rate': 80,
    'spo2': 97,
    'systolic_bp': 120,
    'diastolic_bp': 80,
    'respiratory_rate': 18,
    'temperature': 37.0,
    'iculos': 1,
    'wbc': 8000  # Normal WBC
}


# ============================================================
# MODEL LOADING
# ============================================================

def load_models():
    """Load both ML models."""
    models = {}
    
    # Load classifier
    if MODEL_PATH.exists():
        print(f"[INFO] Loading classifier from {MODEL_PATH}")
        with open(MODEL_PATH, 'rb') as f:
            pkg = pickle.load(f)
            # Handle both wrapped and unwrapped models
            if isinstance(pkg, dict) and 'model' in pkg:
                models['classifier'] = pkg['model']
                models['classifier_features'] = pkg.get('feature_columns', [])
            else:
                models['classifier'] = pkg
                models['classifier_features'] = []
        print("[INFO] Classifier loaded")
    else:
        print(f"[WARNING] Classifier not found at {MODEL_PATH}")
    
    # Load forecaster
    if FORECASTER_PATH.exists():
        print(f"[INFO] Loading forecaster from {FORECASTER_PATH}")
        with open(FORECASTER_PATH, 'rb') as f:
            pkg = pickle.load(f)
            models['forecaster'] = pkg['model']
            models['forecaster_scaler'] = pkg['scaler']
            models['forecaster_features'] = pkg.get('feature_columns', [])
        print("[INFO] Forecaster loaded")
    else:
        print(f"[WARNING] Forecaster not found at {FORECASTER_PATH}")
    
    return models


def connect_supabase() -> Client:
    """Create Supabase client."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    
    print(f"[INFO] Connecting to Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("[INFO] Connected")
    return client


# ============================================================
# qSOFA FORWARD-CHAINING LOGIC
# ============================================================

def evaluate_qsofa(data: dict) -> dict:
    """
    Evaluate qSOFA score using forward-chaining rules.
    
    qSOFA criteria:
    - Respiratory rate >= 22/min (+1)
    - Altered mental status (not available, skip)
    - Systolic BP <= 100 mmHg (+1)
    
    Returns dict with score and stage recommendations.
    """
    resp = data.get('respiratory_rate') or data.get('Resp') or CLINICAL_DEFAULTS['respiratory_rate']
    sbp = data.get('systolic_bp') or data.get('SBP') or CLINICAL_DEFAULTS['systolic_bp']
    temp = data.get('temperature') or data.get('Temp') or CLINICAL_DEFAULTS['temperature']
    hr = data.get('heart_rate') or data.get('HR') or CLINICAL_DEFAULTS['heart_rate']
    wbc = data.get('wbc') or data.get('WBC') or CLINICAL_DEFAULTS['wbc']
    
    # Calculate qSOFA components
    qsofa_resp = 1 if resp >= THRESHOLDS['resp_qsofa'] else 0
    qsofa_sbp = 1 if sbp <= THRESHOLDS['sbp_qsofa'] else 0
    qsofa_score = qsofa_resp + qsofa_sbp
    
    # Calculate SIRS components
    sirs_temp = 1 if (temp > THRESHOLDS['temp_high'] or temp < THRESHOLDS['temp_low']) else 0
    sirs_hr = 1 if hr > THRESHOLDS['hr_sirs'] else 0
    sirs_resp = 1 if resp > THRESHOLDS['resp_sirs'] else 0
    sirs_wbc = 1 if (wbc > THRESHOLDS['wbc_high'] or wbc < THRESHOLDS['wbc_low']) else 0
    sirs_score = sirs_temp + sirs_hr + sirs_resp + sirs_wbc
    
    # Determine stage using forward-chaining
    stage = 1
    alerts = []
    
    # Stage 1: Infection check (Temp or Resp abnormal)
    if temp > THRESHOLDS['temp_high'] or resp > THRESHOLDS['resp_sirs']:
        stage = max(stage, 1)
        if temp > THRESHOLDS['temp_high']:
            alerts.append(f"Fever detected: {temp}°C")
    
    # Stage 2: Hemodynamic check (SBP or HR abnormal)
    if sbp <= THRESHOLDS['sbp_qsofa'] or hr > THRESHOLDS['hr_sirs']:
        stage = max(stage, 2)
        if sbp <= THRESHOLDS['sbp_qsofa']:
            alerts.append(f"Hypotension: SBP {sbp} mmHg")
        if hr > THRESHOLDS['hr_critical']:
            alerts.append(f"Tachycardia: HR {hr} bpm")
    
    # Stage 3: Inflammatory (WBC abnormal or qSOFA >= 2)
    if qsofa_score >= 2 or (wbc > THRESHOLDS['wbc_high'] or wbc < THRESHOLDS['wbc_low']):
        stage = max(stage, 3)
        if qsofa_score >= 2:
            alerts.append("qSOFA >= 2: High sepsis risk")
        if wbc > THRESHOLDS['wbc_high']:
            alerts.append(f"Leukocytosis: WBC {wbc}")
    
    return {
        'qsofa_score': qsofa_score,
        'sirs_score': sirs_score,
        'active_stage': stage,
        'alerts': alerts,
        'components': {
            'qsofa_resp': qsofa_resp,
            'qsofa_sbp': qsofa_sbp,
            'sirs_temp': sirs_temp,
            'sirs_hr': sirs_hr,
            'sirs_resp': sirs_resp,
            'sirs_wbc': sirs_wbc
        }
    }


# ============================================================
# PREDICTION FUNCTIONS
# ============================================================

def safe_get(data: dict, key: str, default=None):
    """Safely get value with fallback to clinical default."""
    value = data.get(key)
    if value is None:
        return default if default is not None else CLINICAL_DEFAULTS.get(key)
    return value


def calculate_features(data: dict) -> pd.DataFrame:
    """Calculate features for classifier."""
    hr = safe_get(data, 'heart_rate', CLINICAL_DEFAULTS['heart_rate'])
    spo2 = safe_get(data, 'spo2', CLINICAL_DEFAULTS['spo2'])
    sbp = safe_get(data, 'systolic_bp', CLINICAL_DEFAULTS['systolic_bp'])
    dbp = safe_get(data, 'diastolic_bp', CLINICAL_DEFAULTS['diastolic_bp'])
    resp = safe_get(data, 'respiratory_rate', CLINICAL_DEFAULTS['respiratory_rate'])
    temp = safe_get(data, 'temperature', CLINICAL_DEFAULTS['temperature'])
    iculos = safe_get(data, 'iculos', CLINICAL_DEFAULTS['iculos'])
    
    # Derived features
    shock_index = hr / sbp if sbp > 0 else 0.67
    map_val = (sbp + 2 * dbp) / 3
    hr_diff = 0
    
    df = pd.DataFrame([[
        iculos, hr, spo2, temp, sbp, map_val, dbp, resp, shock_index, hr_diff
    ]], columns=['ICULOS', 'HR', 'O2Sat', 'Temp', 'SBP', 'MAP', 'DBP', 'Resp', 'ShockIndex', 'HR_diff'])
    
    return df


def predict_risk(models: dict, data: dict) -> tuple:
    """Run sepsis risk classification."""
    if 'classifier' not in models:
        return "ERROR", 0.0, {"error": "Classifier not loaded"}
    
    try:
        df = calculate_features(data)
        model = models['classifier']
        
        prob = model.predict_proba(df)[0][1]
        # Convert to native Python float (fixes JSON serialization)
        prob = float(prob)
        
        # Get qSOFA evaluation for clinical override and reasoning
        qsofa_result = evaluate_qsofa(data)
        qsofa_score = qsofa_result['qsofa_score']

        # Clinical Override: If qSOFA >= 2 OR SIRS >= 2 (Strict Screening Criteria)
        # This acts as a safety layer for the AI to catch early infection signs like Fever + Tachypnea
        sirs_score = qsofa_result['sirs_score']
        
        if qsofa_score >= 2 or sirs_score >= 2:
            prob = max(prob, 0.85) # Force at least 85% risk
            print(f"⚠️ Clinical Override: Risk Indicators detected (qSOFA={qsofa_score}, SIRS={sirs_score}). Adjusting risk to High.")
        
        # Determine risk level
        risk_level = "HIGH" if prob > 0.5 else "LOW"
        
        # Build reasoning object (convert numpy types to native Python types)
        reasoning = {
            "probability": round(prob, 4),
            "threshold": 0.5,
            "features": {
                "shock_index": round(float(df['ShockIndex'].values[0]), 3),
                "map": round(float(df['MAP'].values[0]), 1),
                "iculos": int(df['ICULOS'].values[0])
            },
            "model": "Hybrid (XGBoost + qSOFA)",
            "timestamp": datetime.now().isoformat(),
            "qsofa_score": qsofa_result['qsofa_score'],
            "sirs_score": qsofa_result['sirs_score'],
            "active_stage": qsofa_result['active_stage'],
            "alerts": qsofa_result['alerts'],
        }
        
        return risk_level, prob, reasoning
        
    except Exception as e:
        print(f"[ERROR] Classification failed: {e}")
        return "ERROR", 0.0, {"error": str(e)}


def forecast_vitals(models: dict, initial_data: dict, n_steps: int = 5) -> list:
    """
    Run autoregressive forecast for n_steps.
    
    This creates the smooth deterioration curve for frontend animation.
    """
    if 'forecaster' not in models:
        return []
    
    try:
        model = models['forecaster']
        scaler = models['forecaster_scaler']
        
        predictions = []
        current = {
            'HR': safe_get(initial_data, 'heart_rate', 80),
            'Resp': safe_get(initial_data, 'respiratory_rate', 18),
            'Temp': safe_get(initial_data, 'temperature', 37.0),
            'SBP': safe_get(initial_data, 'systolic_bp', 120),
            'DBP': safe_get(initial_data, 'diastolic_bp', 80),
            'O2Sat': safe_get(initial_data, 'spo2', 97),
            'ICULOS': safe_get(initial_data, 'iculos', 1)
        }
        
        for step in range(n_steps):
            # Calculate derived features
            MAP = (current['SBP'] + 2 * current['DBP']) / 3
            ShockIndex = current['HR'] / current['SBP'] if current['SBP'] > 0 else 0.67
            
            # Build feature vector (must match training order!)
            features = [
                current['ICULOS'],
                current['HR'],
                current['Resp'],
                current['Temp'],
                current['SBP'],
                current['DBP'],
                current['O2Sat'],
                MAP,
                ShockIndex
            ]
            
            # Scale and predict
            X_scaled = scaler.transform([features])
            pred = model.predict(X_scaled)[0]
            
            next_vitals = {
                'sequence_index': step + 1,
                'hr_predicted': round(float(pred[0]), 1),
                'resp_predicted': round(float(pred[1]), 1),
                'temp_predicted': round(float(pred[2]), 2),
                'sbp_predicted': round(float(pred[3]), 0),
                'o2sat_predicted': round(float(pred[4]), 1)
            }
            
            predictions.append(next_vitals)
            
            # AUTOREGRESSIVE: Feed output back as input
            current = {
                'HR': next_vitals['hr_predicted'],
                'Resp': next_vitals['resp_predicted'],
                'Temp': next_vitals['temp_predicted'],
                'SBP': next_vitals['sbp_predicted'],
                'DBP': current['DBP'],  # Keep DBP constant
                'O2Sat': next_vitals['o2sat_predicted'],
                'ICULOS': current['ICULOS'] + 0.1
            }
        
        return predictions
        
    except Exception as e:
        print(f"[ERROR] Forecasting failed: {e}")
        return []


# ============================================================
# MAIN PROCESSING
# ============================================================

def process_vitals(supabase: Client, models: dict, vitals_row: dict):
    """Process a single vitals row with full pipeline."""
    vitals_id = vitals_row['id']
    simulation_id = str(uuid.uuid4())
    
    print(f"[INFO] Processing vitals ID: {vitals_id}")
    
    # Run risk classification
    risk_level, probability, reasoning = predict_risk(models, vitals_row)
    qsofa_score = reasoning.get('qsofa_score', 0)
    active_stage = reasoning.get('active_stage', 1)
    
    print(f"[INFO] Risk: {risk_level} ({probability:.1%}), Stage: {active_stage}, qSOFA: {qsofa_score}")
    
    # Save risk assessment
    try:
        supabase.table('risk_assessments').insert({
            'vitals_id': vitals_id,
            'risk_level': risk_level,
            'risk_score': round(probability, 4),
            'reasoning': reasoning,
            'active_stage': active_stage,
            'qsofa_score': qsofa_score,
            'simulation_id': simulation_id
        }).execute()
        print(f"[INFO] Risk assessment saved")
    except Exception as e:
        print(f"[ERROR] Failed to save risk assessment: {e}")
        return
    
    # Run 5-step forecast
    if 'forecaster' in models:
        predictions = forecast_vitals(models, vitals_row, SIMULATION_STEPS)
        
        if predictions:
            # Calculate risk for each predicted step
            for pred in predictions:
                pred_data = {
                    'heart_rate': pred['hr_predicted'],
                    'respiratory_rate': pred['resp_predicted'],
                    'temperature': pred['temp_predicted'],
                    'systolic_bp': pred['sbp_predicted'],
                    'spo2': pred['o2sat_predicted'],
                    'diastolic_bp': vitals_row.get('diastolic_bp', 80),
                    'iculos': vitals_row.get('iculos', 1)
                }
                _, step_risk, _ = predict_risk(models, pred_data)
                pred['risk_score'] = round(step_risk, 4)
                pred['risk_level'] = "HIGH" if step_risk > 0.5 else "LOW"
                pred['vitals_id'] = vitals_id
                pred['simulation_id'] = simulation_id
            
            # Insert all predictions
            try:
                supabase.table('vital_predictions').insert(predictions).execute()
                print(f"[INFO] Saved {len(predictions)} forecast predictions")
            except Exception as e:
                print(f"[ERROR] Failed to save predictions: {e}")
    
    # Mark vitals as processed
    try:
        supabase.table('vitals').update({
            'processed': True,
            'stage': active_stage
        }).eq('id', vitals_id).execute()
    except Exception as e:
        print(f"[ERROR] Failed to mark as processed: {e}")


def poll_for_vitals(supabase: Client, models: dict):
    """Main polling loop."""
    print("\n" + "="*60)
    print("  SEPSIS EARLY DETECTION SYSTEM v2.0")
    print("="*60)
    print(f"  Polling interval: {POLL_INTERVAL}s")
    print(f"  Simulation steps: {SIMULATION_STEPS}")
    print(f"  Classifier: {'✓' if 'classifier' in models else '✗'}")
    print(f"  Forecaster: {'✓' if 'forecaster' in models else '✗'}")
    print("="*60 + "\n")
    
    while True:
        try:
            result = supabase.table('vitals') \
                .select('*') \
                .eq('source', 'manual') \
                .eq('processed', False) \
                .order('created_at', desc=False) \
                .execute()
            
            if result.data:
                print(f"[INFO] Found {len(result.data)} unprocessed entries")
                for row in result.data:
                    process_vitals(supabase, models, row)
            
            time.sleep(POLL_INTERVAL)
            
        except KeyboardInterrupt:
            print("\n[INFO] Shutting down...")
            break
        except Exception as e:
            print(f"[ERROR] Poll failed: {e}")
            time.sleep(POLL_INTERVAL * 2)


def main():
    """Entry point."""
    print("\n[INFO] Starting Sepsis Watcher v2.0...")
    
    models = load_models()
    supabase = connect_supabase()
    poll_for_vitals(supabase, models)


if __name__ == "__main__":
    main()
