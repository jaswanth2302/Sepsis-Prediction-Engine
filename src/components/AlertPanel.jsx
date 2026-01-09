import React, { useState, useEffect, useRef } from 'react';
import VITAL_THEME from '../theme/vitalTheme.js';

/**
 * AlertPanel
 * 
 * Displays real-time alerts when vitals exceed thresholds.
 * Shows severity (WARNING/CRITICAL) with visual indicators.
 */

const MAX_ALERTS = 10;

function AlertPanel({ vitalStream }) {
    const [alerts, setAlerts] = useState([]);
    const unsubscribeRef = useRef(null);
    const audioRef = useRef(null);

    useEffect(() => {
        unsubscribeRef.current = vitalStream.subscribeToAlerts((alert) => {
            setAlerts(prev => {
                const newAlerts = [alert, ...prev].slice(0, MAX_ALERTS);
                return newAlerts;
            });

            // Play alert sound for critical
            if (alert.severity === 'CRITICAL' && audioRef.current) {
                audioRef.current.play().catch(() => { });
            }
        });

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [vitalStream]);

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getSeverityStyle = (severity) => {
        if (severity === 'CRITICAL') {
            return {
                background: 'rgba(255, 68, 68, 0.2)',
                borderColor: '#ff4444',
                color: '#ff4444'
            };
        }
        return {
            background: 'rgba(255, 255, 0, 0.15)',
            borderColor: '#ffff00',
            color: '#ffff00'
        };
    };

    const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
    const warningCount = alerts.filter(a => a.severity === 'WARNING').length;

    return (
        <div className="alert-panel" style={{
            background: VITAL_THEME.cardBackground,
            borderRadius: '4px',
            padding: '12px',
            border: criticalCount > 0 ? '2px solid #ff4444' : '1px solid #333'
        }}>
            {/* Hidden audio element for alerts */}
            <audio ref={audioRef} preload="auto">
                <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onr2wlYVzbGVpfY6dr6mejoF4c3R+ipahoJmQiIN/f4SGi4+SkI6MiomJiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8AAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1+f4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/" type="audio/wav" />
            </audio>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #333'
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    ALERTS
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {criticalCount > 0 && (
                        <span style={{
                            background: 'rgba(255, 68, 68, 0.3)',
                            color: '#ff4444',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            animation: 'pulse 1s ease-in-out infinite'
                        }}>
                            {criticalCount} CRITICAL
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span style={{
                            background: 'rgba(255, 255, 0, 0.2)',
                            color: '#ffff00',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.6875rem',
                            fontWeight: 600
                        }}>
                            {warningCount} WARNING
                        </span>
                    )}
                </div>
            </div>

            <div style={{
                maxHeight: '200px',
                overflowY: 'auto'
            }}>
                {alerts.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '20px',
                        color: '#00ff00',
                        fontSize: '0.75rem'
                    }}>
                        ✓ No active alerts
                    </div>
                ) : (
                    alerts.map((alert, index) => {
                        const style = getSeverityStyle(alert.severity);
                        return (
                            <div
                                key={alert.id || index}
                                style={{
                                    background: style.background,
                                    border: `1px solid ${style.borderColor}`,
                                    borderRadius: '4px',
                                    padding: '8px 12px',
                                    marginBottom: '6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <span style={{
                                        color: style.color,
                                        fontWeight: 600,
                                        fontSize: '0.6875rem',
                                        marginRight: '8px'
                                    }}>
                                        {alert.severity}
                                    </span>
                                    <span style={{
                                        color: '#fff',
                                        fontSize: '0.75rem'
                                    }}>
                                        {alert.message}
                                    </span>
                                </div>
                                <span style={{
                                    color: '#888',
                                    fontSize: '0.625rem',
                                    fontFamily: 'monospace'
                                }}>
                                    {formatTime(alert.timestamp)}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default AlertPanel;
