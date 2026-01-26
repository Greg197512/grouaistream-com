import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MoodSession {
  id: string;
  mood: string;
  confidence: number;
  source: string;
  detected_at: string;
}

const moodScores: Record<string, number> = {
  Happy: 90,
  Excited: 85,
  Energetic: 80,
  Focused: 70,
  Relaxed: 65,
  Romantic: 60,
  Rebellious: 45,
  Intense: 40,
  Melancholic: 30,
  Anxious: 20,
};

const moodColors: Record<string, string> = {
  Happy: "#FBBF24",
  Excited: "#F472B6",
  Energetic: "#FB923C",
  Focused: "#8B5CF6",
  Relaxed: "#22D3EE",
  Romantic: "#FDA4AF",
  Rebellious: "#22C55E",
  Intense: "#EF4444",
  Melancholic: "#6366F1",
  Anxious: "#A855F7",
};

interface MoodTrendChartProps {
  sessions: MoodSession[];
  height?: number;
}

export const MoodTrendChart = ({ sessions, height = 300 }: MoodTrendChartProps) => {
  const chartData = useMemo(() => {
    // Sort by date ascending
    const sorted = [...sessions].sort(
      (a, b) => new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime()
    );

    const labels = sorted.map((s) => {
      const date = new Date(s.detected_at);
      return `${date.getDate()}/${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
    });

    const data = sorted.map((s) => moodScores[s.mood] || 50);
    const colors = sorted.map((s) => moodColors[s.mood] || "#FF5722");

    return {
      labels,
      datasets: [
        {
          label: "Poziom nastroju",
          data,
          fill: true,
          borderColor: "#FF5722",
          backgroundColor: "rgba(255, 87, 34, 0.1)",
          pointBackgroundColor: colors,
          pointBorderColor: colors,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.4,
          borderWidth: 3,
        },
      ],
    };
  }, [sessions]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#fff",
        bodyColor: "#fff",
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          title: (context: any) => {
            const index = context[0].dataIndex;
            const session = [...sessions].sort(
              (a, b) => new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime()
            )[index];
            return session?.mood || "";
          },
          label: (context: any) => {
            const index = context.dataIndex;
            const session = [...sessions].sort(
              (a, b) => new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime()
            )[index];
            return [
              `Pewność: ${session?.confidence}%`,
              `Źródło: ${session?.source || "webcam"}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.6)",
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.6)",
          callback: (value: number) => {
            if (value === 100) return "😊 Happy";
            if (value === 75) return "😌 Relaxed";
            if (value === 50) return "😐 Neutral";
            if (value === 25) return "😰 Anxious";
            return "";
          },
        },
      },
    },
  };

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Brak danych do wyświetlenia wykresu
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <Line data={chartData} options={options as any} />
    </div>
  );
};
