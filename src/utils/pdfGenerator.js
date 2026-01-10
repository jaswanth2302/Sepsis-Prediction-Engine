import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate a formal medical PDF report for the Sepsis Screening session.
 * 
 * @param {Object} patientInfo - Patient demographics
 * @param {Array} stageHistory - Array of stage results { stage: 1, vitals: {...}, result: {...} }
 * @param {Object} finalAssessment - Final risk assessment object
 */
export const generateMedicalReport = (patientInfo, stageHistory, finalAssessment) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // -- Header --
    doc.setFillColor(0, 51, 102); // Dark Blue Header
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('SEPSIS SCREENING REPORT', 14, 25);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 25, { align: 'right' });

    // -- Patient Demographics --
    let yPos = 55;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('Patient Information', 14, yPos);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, yPos + 2, pageWidth - 14, yPos + 2);

    yPos += 10;
    doc.setFontSize(10);
    const leftCol = 14;
    const rightCol = pageWidth / 2 + 10;

    doc.text(`Patient ID: ${patientInfo?.id || 'N/A'}`, leftCol, yPos);
    doc.text(`Name: ${patientInfo?.name || 'N/A'}`, leftCol, yPos + 6);
    doc.text(`Age/Gender: ${patientInfo?.age || '--'} / ${patientInfo?.gender || '--'}`, leftCol, yPos + 12);

    doc.text(`Ward: ${patientInfo?.ward || 'General'}`, rightCol, yPos);
    doc.text(`Bed: ${patientInfo?.location || 'N/A'}`, rightCol, yPos + 6);
    doc.text(`Admission: ${patientInfo?.admissionDate || 'N/A'}`, rightCol, yPos + 12);

    // -- Clinical Summary / Final Result --
    yPos += 25;
    doc.setFontSize(14);
    doc.text('Final Clinical Assessment', 14, yPos);
    doc.line(14, yPos + 2, pageWidth - 14, yPos + 2);

    yPos += 12;
    const riskLevel = finalAssessment?.risk_level || 'UNKNOWN';
    const riskScore = (finalAssessment?.risk_score * 100).toFixed(1) + '%';

    // Status Box
    const boxColor = riskLevel === 'HIGH' ? [255, 235, 238] : [232, 245, 233]; // Red tint vs Green tint
    const textColor = riskLevel === 'HIGH' ? [211, 47, 47] : [56, 142, 60];

    doc.setFillColor(...boxColor);
    doc.setDrawColor(...textColor);
    doc.roundedRect(14, yPos, pageWidth - 28, 25, 3, 3, 'FD');

    doc.setTextColor(...textColor);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`RISK STATUS: ${riskLevel}`, 20, yPos + 10);

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Sepsis Probability Score: ${riskScore}`, 20, yPos + 18);

    // -- Detailed Timeline (Table) --
    yPos += 35;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Progression Timeline', 14, yPos);
    doc.line(14, yPos + 2, pageWidth - 14, yPos + 2);

    // Prepare table data from stage history
    // stageHistory structure expected: [{ stage: 1, vitals: {...}, result: {...} }, ...]
    const tableRows = stageHistory.map((entry, index) => {
        const stageName =
            entry.stage === 1 ? 'Infection (Stage 1)' :
                entry.stage === 2 ? 'Hemodynamic (Stage 2)' :
                    'Inflammatory (Stage 3)';

        const vitalSummary = Object.entries(entry.vitals || {})
            .filter(([_, v]) => v != null)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');

        const alerts = entry.result?.alerts || [];
        const alertText = alerts.length > 0 ? alerts.join('\n') : 'No clinical alerts';

        return [
            `Stage ${entry.stage}`,
            stageName,
            vitalSummary,
            alertText
        ];
    });

    doc.autoTable({
        startY: yPos + 8,
        head: [['Stage', 'Phase', 'Vitals Recorded', 'Clinical Alerts']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 51, 102] },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
            2: { cellWidth: 60 },
            3: { cellWidth: 70, textColor: [200, 0, 0] }
        }
    });

    // -- Footer --
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            'CONFIDENTIAL MEDICAL RECORD - Sepsis Prediction Engine Output',
            pageWidth / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }

    // Save
    const fileName = `Sepsis_Report_${patientInfo?.id || 'Unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
};
