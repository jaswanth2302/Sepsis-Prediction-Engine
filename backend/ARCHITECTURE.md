# Backend Logic: Hybrid Forward-Chaining Architecture

## 1. Logic Flow (Text View)

In case the diagram below does not render, here is the text representation of the Hybrid Engine:

```text
[ INPUT: Vitals (Temp, Resp, BP, HR, WBC) ]
      |
      +---> [ Logic Engine: Forward Chaining ]
      |         |
      |         +--> Calc qSOFA Score (Resp >= 22, SBP <= 100)
      |         +--> Calc SIRS Score (Temp > 38, Resp > 20, HR > 90)
      |         |
      |         +--> [ STAGE GATE ] -> Stage 1/2/3
      |
      +---> [ ML Engine: XGBoost ]
                |
                +--> [ Raw Probability % ]

      |
      V
[ HYBRID SAFETY CHECK ]
      |
      +--> IF qSOFA >= 2 OR SIRS >= 2  -----> [ FORCE HIGH RISK ]
      |                                      (Override ML Model)
      |
      +--> ELSE ----------------------------> [ USE ML PROBABILITY ]
                                             (Standard Inference)
```

## 2. Mermaid Diagram

```mermaid
flowchart TD
    %% Input Layer
    Input[("Patient Vitals Input\n(Manual/Device)")] --> Impute{Data Imputation}
    Impute -->|Fill Normals| CleanData[Processing Data]

    %% Parallel Processing
    subgraph Logic_Engine ["Forward-Chaining Rule Engine"]
        direction TB
        CleanData --> Calc_qSOFA[Calculate qSOFA]
        CleanData --> Calc_SIRS[Calculate SIRS]
        
        Calc_qSOFA -- "Resp >= 22 (1)\nSBP <= 100 (1)" --> qSOFA_Score[qSOFA Score]
        Calc_SIRS -- "Temp > 38 (1)\nResp > 20 (1)\nHR > 90 (1)" --> SIRS_Score[SIRS Score]
        
        %% Stage Logic
        qSOFA_Score & SIRS_Score --> Stage_Eval{Stage Gating}
        Stage_Eval -->|Infection Signs| S1[Stage 1: Screening]
        Stage_Eval -->|BP/HR Abnormal| S2[Stage 2: Hemodynamic]
        Stage_Eval -->|Severe/WBC| S3[Stage 3: Inflammatory]
    end

    subgraph ML_Engine ["Machine Learning Inference"]
        direction TB
        CleanData --> Features[Feature Engineering\n(ShockIndex, MAP, ICULOS)]
        Features --> XGB[XGBoost Classifier]
        XGB --> Prob[Raw Probability %]
    end

    %% Hybrid Integration (Safety Layer)
    Logic_Engine --> Decision_Node
    ML_Engine --> Decision_Node

    subgraph Decision_Node ["Hybrid Safety Safety Layer"]
        direction TB
        Merge{Safety Check}
        
        Prob --> Merge
        qSOFA_Score -->|">= 2"| Override[CLINICAL OVERRIDE]
        SIRS_Score -->|">= 2"| Override
        
        Override -->|Force High Risk| Final_Risk[FINAL RISK: HIGH]
        Merge -->|"No Flags"| Raw_Eval{Assess ML Prob}
        Raw_Eval -->|"> 50%"| High[HIGH]
        Raw_Eval -->|"< 50%"| Low[LOW]
    end

    %% Output
    Final_Risk --> Database[(Supabase)]
    High --> Database
    Low --> Database

    %% Forecasting
    Final_Risk -.-> Forecast[Autoregressive Forecast\n(5-Step Burst)]
    Forecast -.-> Database

    %% Styling
    style Input fill:#2d3748,stroke:#fff
    style Override fill:#e53e3e,stroke:#fff,stroke-width:2px,color:#fff
    style Final_Risk fill:#e53e3e,stroke:#fff,color:#fff
    style XGB fill:#3182ce,stroke:#fff,color:#fff
    style Logic_Engine fill:#2d3748,stroke:#4a5568,color:#fff
```

## 3. Logic Breakdown Explanation
1.  **Forward Chaining Rules**: We calculate clinical scores first.
    *   **qSOFA**: Quick Sepsis Related Organ Failure Assessment.
    *   **SIRS**: Systemic Inflammatory Response Syndrome.
2.  **Machine Learning**: Independent assessment based on historical patterns (XGBoost).
3.  **Safety Override**:
    *   Even if the ML model is unsure (e.g., probability 20%), if **Clinical Criteria (SIRS/qSOFA)** are met, the system **forces** a HIGH RISK alert.
    *   This prevents "False Negatives" in obvious clinical cases (e.g., High Fever).
