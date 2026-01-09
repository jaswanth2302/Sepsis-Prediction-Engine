# Sepsis Prediction Engine & Immersive Dashboard

A Progressive Sepsis Protection System that combines **Machine Learning (XGBoost)** with **Clinical Rule-Sets (SIRS/qSOFA)** to provide real-time risk assessment and vital sign forecasting for non-ICU patients.

## 🚀 Features
- **Hybrid AI Engine**: Combines clinical safety overrides (Forward-Chaining Rules) with ML probability scores to prevent false negatives.
- **Immersive Monitoring**: 5-second active monitoring sessions with "Auto-Sustain" graph visualization.
- **Forecasting**: Autoregressive models predict vital signs 5 steps into the future.
- **Progressive Screening**: 3-Stage input flow (Screening -> Hemodynamic -> Inflammatory) to guide nurses.
- **Deep Dive Analysis**: Interactive modal explaining *why* a risk score was assigned.

## 📂 Project Structure

```text
Sepsis-Prediction-Engine/
├── backend/                   # Python ML Logic & Inference Service
│   ├── sepsis_watcher.py      # Main Service: Polling + Hybrid Logic + Prediction
│   ├── sepsis_model.pkl       # Trained XGBoost Classifier
│   ├── vital_forecaster.pkl   # Trained Autoregressive Forecaster
│   ├── ModelA_Classifier.ipynb# Training Notebook for Risk Model
│   ├── ModelB_Forecaster.ipynb# Training Notebook for Forecasting
│   └── ARCHITECTURE.md        # Logic Documentation (Diagrams)
│
├── src/                       # React Frontend
│   ├── components/            # UI Components
│   │   ├── MonitoringSession.jsx  # Immersive Monitor Logic
│   │   ├── DeepDiveModal.jsx      # Clinical Analysis Detail View
│   │   ├── PatientRegistrationFlow.jsx # Staged Input Flow
│   │   └── VitalPanel.jsx         # Real-time Graph Grid
│   ├── streams/               # Data Layer
│   │   └── MLPredictionStream.js  # WebSocket Logic + Auto-Sustain Effects
│   └── index.css              # Global Medical Theme Styles
│
├── supabase_schema.sql        # Database Definitions (Tables: vitals, risk_assessments)
├── package.json               # Frontend Dependencies (React, Recharts)
└── requirements.txt           # Backend Dependencies (Pandas, XGBoost, Supabase)
```

## 🛠️ Setup

### Backend
1.  Navigate to `backend/`.
2.  Install dependencies: `pip install -r values.txt` (or manually: pandas, xgboost, supabase, python-dotenv).
3.  Run the watcher: `python sepsis_watcher.py`.

### Frontend
1.  Navigate to root.
2.  Install: `npm install`.
3.  Run: `npm run dev`.

## 🔗 Architecture
See `backend/ARCHITECTURE.md` for a detailed breakdown of the Hybrid Logic engine.
