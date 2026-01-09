import React from 'react';

/**
 * RiskStatusBadge
 * 
 * Displays patient risk status with visual severity.
 */

function RiskStatusBadge({ status = 'Stable' }) {
    const getStatusStyle = () => {
        switch (status.toLowerCase()) {
            case 'stable':
            case 'low':
                return {
                    bg: 'rgba(0, 255, 0, 0.15)',
                    color: '#00ff00',
                    border: 'rgba(0, 255, 0, 0.3)'
                };
            case 'moderate':
                return {
                    bg: 'rgba(255, 255, 0, 0.15)',
                    color: '#ffff00',
                    border: 'rgba(255, 255, 0, 0.3)'
                };
            case 'high':
            case 'critical':
                return {
                    bg: 'rgba(255, 68, 68, 0.15)',
                    color: '#ff4444',
                    border: 'rgba(255, 68, 68, 0.3)'
                };
            default:
                return {
                    bg: 'rgba(0, 255, 0, 0.15)',
                    color: '#00ff00',
                    border: 'rgba(0, 255, 0, 0.3)'
                };
        }
    };

    const style = getStatusStyle();
    const isCritical = status.toLowerCase() === 'critical' || status.toLowerCase() === 'high';

    return (
        <div
            className="risk-status-badge"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                background: style.bg,
                color: style.color,
                border: `1px solid ${style.border}`,
                animation: isCritical ? 'pulse 0.5s ease-in-out infinite' : 'none'
            }}
        >
            <span
                style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: style.color,
                    boxShadow: `0 0 6px ${style.color}`,
                    animation: 'pulse 2s ease-in-out infinite'
                }}
            />
            <span>{status}</span>
        </div>
    );
}

export default RiskStatusBadge;
