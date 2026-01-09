import React from 'react';
import VITAL_THEME from '../theme/vitalTheme.js';

/**
 * VitalCard
 * 
 * Classic ICU monitor style card with dark background
 * and large numeric display on the right side.
 */

function VitalCard({ title, value, unit, theme, children }) {
    return (
        <div
            className="vital-card"
            style={{
                backgroundColor: theme.bg,
                borderRadius: '4px',
                padding: '12px',
                border: `1px solid ${theme.accent}33`,
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}
        >
            {/* Header with label */}
            <div className="vital-card-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
            }}>
                <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: theme.accent,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    {theme.label || title}
                </div>
            </div>

            {/* Chart area */}
            <div className="vital-card-chart" style={{
                flex: 1,
                position: 'relative'
            }}>
                {children}
            </div>

            {/* Large value display - ICU style */}
            <div className="vital-card-value-display" style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'baseline',
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: `1px solid ${VITAL_THEME.gridColor}`
            }}>
                <span style={{
                    fontFamily: "'Segment7', 'DS-Digital', 'Consolas', monospace",
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: theme.accent,
                    lineHeight: 1,
                    textShadow: `0 0 10px ${theme.accent}66`
                }}>
                    {value}
                </span>
                <span style={{
                    fontSize: '0.875rem',
                    fontWeight: 400,
                    color: theme.accent,
                    marginLeft: '4px',
                    opacity: 0.8
                }}>
                    {unit}
                </span>
            </div>
        </div>
    );
}

export default VitalCard;
