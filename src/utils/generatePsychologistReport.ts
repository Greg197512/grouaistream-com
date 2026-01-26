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

// Parse AI opinion into sections
const parseAIOpinion = (opinion: string): Record<string, string> => {
  const sections: Record<string, string> = {};
  const sectionHeaders = [
    "OCENA OGÓLNA",
    "DIAGNOZA KLINICZNA",
    "ANALIZA RYZYKA",
    "WYKRYTE SYMPTOMY",
    "DIAGNOZA RÓŻNICOWA",
    "ZALECENIA TERAPEUTYCZNE",
    "PROGNOZA",
    "UWAGI KOŃCOWE",
  ];

  let currentSection = "";
  const lines = opinion.split("\n");

  for (const line of lines) {
    const cleanLine = line.replace(/^#+\s*/, "").trim();
    const matchedHeader = sectionHeaders.find((h) => cleanLine.toUpperCase().includes(h));

    if (matchedHeader) {
      currentSection = matchedHeader;
      sections[currentSection] = "";
    } else if (currentSection && line.trim()) {
      sections[currentSection] = (sections[currentSection] || "") + line + "\n";
    }
  }

  return sections;
};

export const generatePsychologistReport = (
  analysis: MoodAnalysis,
  sessions: MoodSession[],
  selectedDays: number,
  userName?: string,
  aiOpinion?: string
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
    return y + lines.length * fontSize * 0.4;
  };

  // Check page and add new if needed
  const checkNewPage = (neededSpace: number = 40) => {
    if (yPos > doc.internal.pageSize.getHeight() - neededSpace) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Add section header
  const addSectionHeader = (title: string) => {
    checkNewPage(50);
    doc.setFillColor(255, 87, 34);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 5, yPos + 6);
    yPos += 15;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  // Header
  doc.setFillColor(255, 87, 34);
  doc.rect(0, 0, pageWidth, 45, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("OPINIA PSYCHOLOGICZNA", pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Pełna analiza stanu emocjonalnego - GrouAI Stream", pageWidth / 2, 28, { align: "center" });

  doc.setFontSize(9);
  doc.text(`Wygenerowano: ${new Date().toLocaleString("pl-PL")}`, pageWidth / 2, 38, { align: "center" });

  yPos = 60;
  doc.setTextColor(0, 0, 0);

  // Patient Info Section
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 28, "F");

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DANE BADANIA", margin + 5, yPos + 5);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Pacjent: ${userName || "Użytkownik GrouAI"}`, margin + 5, yPos + 14);
  doc.text(`Okres analizy: ${selectedDays} dni`, margin + 90, yPos + 14);
  doc.text(`Liczba skanów: ${analysis.sessionsCount}`, margin + 5, yPos + 21);
  doc.text(`Data raportu: ${new Date().toLocaleDateString("pl-PL")}`, margin + 90, yPos + 21);

  yPos += 40;

  // If AI opinion exists, parse and display it
  if (aiOpinion) {
    const sections = parseAIOpinion(aiOpinion);

    // AI Badge
    doc.setFillColor(76, 175, 80);
    doc.roundedRect(margin, yPos - 5, pageWidth - 2 * margin, 12, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("ANALIZA PRZEPROWADZONA PRZEZ SZTUCZNĄ INTELIGENCJĘ", pageWidth / 2, yPos + 3, { align: "center" });
    yPos += 20;
    doc.setTextColor(0, 0, 0);

    // Render each AI section
    if (sections["OCENA OGÓLNA"]) {
      addSectionHeader("1. OCENA OGÓLNA");
      yPos = addWrappedText(sections["OCENA OGÓLNA"].trim(), margin, yPos, pageWidth - 2 * margin, 10);
      yPos += 10;
    }

    if (sections["DIAGNOZA KLINICZNA"]) {
      addSectionHeader("2. DIAGNOZA KLINICZNA");
      yPos = addWrappedText(sections["DIAGNOZA KLINICZNA"].trim(), margin, yPos, pageWidth - 2 * margin, 10);
      yPos += 10;
    }

    if (sections["ANALIZA RYZYKA"]) {
      addSectionHeader("3. ANALIZA RYZYKA");
      yPos = addWrappedText(sections["ANALIZA RYZYKA"].trim(), margin, yPos, pageWidth - 2 * margin, 10);
      yPos += 10;
    }

    if (sections["WYKRYTE SYMPTOMY"]) {
      addSectionHeader("4. WYKRYTE SYMPTOMY");
      yPos = addWrappedText(sections["WYKRYTE SYMPTOMY"].trim(), margin, yPos, pageWidth - 2 * margin, 10);
      yPos += 10;
    }

    if (sections["DIAGNOZA RÓŻNICOWA"]) {
      addSectionHeader("5. DIAGNOZA RÓŻNICOWA");
      yPos = addWrappedText(sections["DIAGNOZA RÓŻNICOWA"].trim(), margin, yPos, pageWidth - 2 * margin, 10);
      yPos += 10;
    }

    if (sections["ZALECENIA TERAPEUTYCZNE"]) {
      addSectionHeader("6. ZALECENIA TERAPEUTYCZNE");
      yPos = addWrappedText(sections["ZALECENIA TERAPEUTYCZNE"].trim(), margin, yPos, pageWidth - 2 * margin, 10);
      yPos += 10;
    }

    if (sections["PROGNOZA"]) {
      addSectionHeader("7. PROGNOZA");
      yPos = addWrappedText(sections["PROGNOZA"].trim(), margin, yPos, pageWidth - 2 * margin, 10);
      yPos += 10;
    }

    if (sections["UWAGI KOŃCOWE"]) {
      addSectionHeader("8. UWAGI KOŃCOWE");
      yPos = addWrappedText(sections["UWAGI KOŃCOWE"].trim(), margin, yPos, pageWidth - 2 * margin, 10);
      yPos += 10;
    }
  } else {
    // Fallback to basic analysis without AI
    addSectionHeader("1. DIAGNOZA GŁÓWNA");

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
    yPos += 15;

    // Patterns
    if (analysis.patterns.length > 0) {
      addSectionHeader("2. WYKRYTE WZORCE");
      analysis.patterns.forEach((pattern) => {
        const cleanPattern = pattern.replace(/^[🔴🔵🟢🟠ℹ️]\s*/, "• ");
        yPos = addWrappedText(cleanPattern, margin, yPos, pageWidth - 2 * margin, 10);
        yPos += 3;
      });
      yPos += 10;
    }

    // Recommendations
    addSectionHeader("3. ZALECENIA");
    analysis.recommendations.advice.forEach((advice) => {
      yPos = addWrappedText(`• ${advice}`, margin, yPos, pageWidth - 2 * margin, 10);
      yPos += 3;
    });
  }

  // Mood Distribution Table
  checkNewPage(60);
  addSectionHeader("STATYSTYKI - ROZKŁAD NASTROJÓW");

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

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Session History
  checkNewPage(60);
  addSectionHeader("HISTORIA SKANÓW");

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

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Strona ${i} z ${pageCount} | Raport AI wygenerowany przez GrouAI Stream | ${new Date().toLocaleDateString("pl-PL")}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    doc.text(
      "POUFNE - Dokument przeznaczony wyłącznie dla pacjenta. Analiza AI nie zastępuje konsultacji specjalisty.",
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: "center" }
    );
  }

  // Save the PDF
  const fileName = `opinia_psychologiczna_AI_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
};
