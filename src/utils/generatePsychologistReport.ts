import jsPDF from "jspdf";
import "jspdf-autotable";

interface MoodSession {
  id: string;
  mood: string;
  confidence: number;
  source: string;
  detected_at: string;
}

interface MoodAnalysis {
  dominantMood: string;
  moodDistribution: Record<string, number>;
  averageConfidence: number;
  sessionsCount: number;
  patterns: string[];
  recommendations: {
    music: string[];
    frequencies: string[];
    symptoms: string[];
    advice: string[];
  };
  suggestedGenres: string[];
  healingFrequencies: { hz: number; purpose: string }[];
}

const moodDescriptions: Record<string, string> = {
  Happy: "Stan podwyższonego nastroju z dominującymi pozytywnymi emocjami. Charakteryzuje się zwiększoną energią, optymizmem i otwartością na nowe doświadczenia.",
  Melancholic: "Stan obniżonego nastroju z tendencją do refleksji i introspekcji. Może wskazywać na potrzebę odpoczynku lub przepracowania emocji.",
  Intense: "Stan wysokiej intensywności emocjonalnej. Charakteryzuje się silnymi reakcjami na bodźce zewnętrzne i wewnętrzne.",
  Anxious: "Stan podwyższonego napięcia i niepokoju. Może manifestować się poprzez zwiększoną czujność i trudności z relaksem.",
  Rebellious: "Stan oporu wobec norm i oczekiwań. Charakteryzuje się potrzebą wyrażenia indywidualności i niezależności.",
  Excited: "Stan pozytywnego pobudzenia i entuzjazmu. Wskazuje na wysoką motywację i zaangażowanie.",
  Relaxed: "Stan spokoju i równowagi emocjonalnej. Charakteryzuje się niskim poziomem stresu i dobrym samopoczuciem.",
  Energetic: "Stan wysokiej energii i witalności. Wskazuje na dobrą kondycję psychofizyczną.",
  Romantic: "Stan emocjonalnej wrażliwości i otwartości na relacje. Charakteryzuje się zwiększoną empatią.",
  Focused: "Stan koncentracji i ukierunkowania na cel. Wskazuje na zdolność do efektywnej pracy.",
};

const moodRiskLevels: Record<string, { level: string; color: string }> = {
  Happy: { level: "Niski", color: "green" },
  Relaxed: { level: "Niski", color: "green" },
  Focused: { level: "Niski", color: "green" },
  Energetic: { level: "Niski", color: "green" },
  Excited: { level: "Niski", color: "green" },
  Romantic: { level: "Niski", color: "green" },
  Intense: { level: "Średni", color: "orange" },
  Rebellious: { level: "Średni", color: "orange" },
  Melancholic: { level: "Podwyższony", color: "orange" },
  Anxious: { level: "Podwyższony", color: "red" },
};

export const generatePsychologistReport = (
  analysis: MoodAnalysis,
  sessions: MoodSession[],
  selectedDays: number,
  userName?: string
): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Helper function to add text with wrapping
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10): number => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + (lines.length * fontSize * 0.4);
  };

  // Header
  doc.setFillColor(255, 87, 34);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("RAPORT PSYCHOLOGICZNY", pageWidth / 2, 18, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Analiza stanu emocjonalnego - GrooveAI Stream", pageWidth / 2, 28, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`Data wygenerowania: ${new Date().toLocaleDateString("pl-PL")}`, pageWidth / 2, 36, { align: "center" });

  yPos = 55;
  doc.setTextColor(0, 0, 0);

  // Patient Info Section
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 25, "F");
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Informacje o badaniu", margin + 5, yPos + 5);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Pacjent: ${userName || "Użytkownik GrooveAI"}`, margin + 5, yPos + 14);
  doc.text(`Okres analizy: ${selectedDays} dni`, margin + 80, yPos + 14);
  doc.text(`Liczba skanów: ${analysis.sessionsCount}`, margin + 130, yPos + 14);

  yPos += 35;

  // Main Diagnosis Section
  doc.setFillColor(255, 87, 34);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("1. DIAGNOZA GŁÓWNA", margin + 5, yPos + 6);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);
  
  const riskInfo = moodRiskLevels[analysis.dominantMood] || { level: "Nieznany", color: "gray" };
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Dominujący stan emocjonalny: ${analysis.dominantMood}`, margin, yPos);
  
  yPos += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Poziom ryzyka: ${riskInfo.level}`, margin, yPos);
  doc.text(`Pewność diagnozy: ${analysis.averageConfidence}%`, margin + 60, yPos);
  
  yPos += 10;
  const description = moodDescriptions[analysis.dominantMood] || "Brak opisu dla tego stanu emocjonalnego.";
  yPos = addWrappedText(description, margin, yPos, pageWidth - 2 * margin, 10);
  
  yPos += 10;

  // Mood Distribution Section
  doc.setFillColor(255, 87, 34);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("2. ROZKŁAD NASTROJÓW", margin + 5, yPos + 6);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);

  // Create mood distribution table
  const moodData = Object.entries(analysis.moodDistribution).map(([mood, count]) => {
    const percentage = Math.round((count / analysis.sessionsCount) * 100);
    const risk = moodRiskLevels[mood] || { level: "Nieznany", color: "gray" };
    return [mood, `${count}`, `${percentage}%`, risk.level];
  });

  (doc as any).autoTable({
    startY: yPos,
    head: [["Nastrój", "Liczba skanów", "Udział %", "Poziom ryzyka"]],
    body: moodData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [255, 87, 34], textColor: 255 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Patterns & Symptoms Section
  doc.setFillColor(255, 87, 34);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("3. WYKRYTE WZORCE I SYMPTOMY", margin + 5, yPos + 6);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (analysis.patterns.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Wykryte wzorce emocjonalne:", margin, yPos);
    yPos += 7;
    doc.setFont("helvetica", "normal");
    
    analysis.patterns.forEach((pattern) => {
      const cleanPattern = pattern.replace(/^[🔴🔵🟢🟠ℹ️]\s*/, "• ");
      yPos = addWrappedText(cleanPattern, margin + 5, yPos, pageWidth - 2 * margin - 10, 9);
      yPos += 3;
    });
  }

  if (analysis.recommendations.symptoms.length > 0) {
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 0, 0);
    doc.text("⚠ Zidentyfikowane symptomy wymagające uwagi:", margin, yPos);
    yPos += 7;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    
    analysis.recommendations.symptoms.forEach((symptom) => {
      yPos = addWrappedText(`• ${symptom}`, margin + 5, yPos, pageWidth - 2 * margin - 10, 9);
      yPos += 3;
    });
  }

  yPos += 10;

  // Check if we need a new page
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  // Therapeutic Recommendations Section
  doc.setFillColor(255, 87, 34);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("4. ZALECENIA TERAPEUTYCZNE", margin + 5, yPos + 6);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);

  // Music Therapy
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Muzykoterapia:", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  analysis.recommendations.music.forEach((rec) => {
    yPos = addWrappedText(`✓ ${rec}`, margin + 5, yPos, pageWidth - 2 * margin - 10, 9);
    yPos += 2;
  });
  
  yPos += 5;
  doc.text(`Rekomendowane gatunki: ${analysis.suggestedGenres.join(", ")}`, margin + 5, yPos);
  
  yPos += 10;

  // Healing Frequencies
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Terapia częstotliwościowa:", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  analysis.healingFrequencies.forEach((freq) => {
    doc.text(`• ${freq.hz} Hz - ${freq.purpose}`, margin + 5, yPos);
    yPos += 5;
  });

  yPos += 8;

  // General Advice
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Ogólne zalecenia:", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  analysis.recommendations.advice.forEach((advice) => {
    yPos = addWrappedText(`💡 ${advice}`, margin + 5, yPos, pageWidth - 2 * margin - 10, 9);
    yPos += 3;
  });

  // Check if we need a new page for session history
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 10;

  // Session History Section
  doc.setFillColor(255, 87, 34);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("5. HISTORIA SKANÓW", margin + 5, yPos + 6);
  
  yPos += 15;

  const sessionData = sessions.slice(0, 15).map((session) => {
    const date = new Date(session.detected_at);
    return [
      date.toLocaleDateString("pl-PL"),
      date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }),
      session.mood,
      `${session.confidence}%`,
      session.source || "webcam",
    ];
  });

  (doc as any).autoTable({
    startY: yPos,
    head: [["Data", "Godzina", "Nastrój", "Pewność", "Źródło"]],
    body: sessionData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [255, 87, 34], textColor: 255 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Strona ${i} z ${pageCount} | Raport wygenerowany przez GrooveAI Stream | ${new Date().toLocaleDateString("pl-PL")}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    doc.text(
      "POUFNE - Dokument przeznaczony wyłącznie dla pacjenta",
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: "center" }
    );
  }

  // Save the PDF
  const fileName = `raport_psychologiczny_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
};
