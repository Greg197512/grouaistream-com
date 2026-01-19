import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Radio as RadioIcon, Play, Pause, Volume2, VolumeX, Sparkles, Users, Wifi, ExternalLink } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

// Public radio streams (free to use)
const radioStations = [
  {
    id: "1",
    name: "GrouaRadio Main",
    description: "24/7 AI-curated electronic music",
    url: "https://stream.zeno.fm/fyn8yhshp8uuv",
    genre: "Electronic",
    listeners: 1247,
    isLive: true,
  },
  {
    id: "2",
    name: "Chill Vibes",
    description: "Relaxing lo-fi and ambient beats",
    url: "https://stream.zeno.fm/0r0xa792kwzuv",
    genre: "Lo-Fi",
    listeners: 892,
    isLive: true,
  },
  {
    id: "3",
    name: "Synthwave City",
    description: "Retro futuristic sounds",
    url: "https://stream.zeno.fm/f3wvbbqmdg8uv",
    genre: "Synthwave",
    listeners: 654,
    isLive: true,
  },
  {
    id: "4",
    name: "Deep Focus",
    description: "Music for concentration",
    url: "https://stream.zeno.fm/4pknzhnndnruv",
    genre: "Ambient",
    listeners: 423,
    isLive: true,
  },
];

const Radio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentStation, setCurrentStation] = useState(radioStations[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume / 100;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  const playStation = async (station: typeof radioStations[0]) => {
    if (!audioRef.current) return;

    setLoading(true);
    try {
      if (currentStation.id !== station.id) {
        audioRef.current.pause();
        audioRef.current.src = station.url;
        setCurrentStation(station);
      }

      await audioRef.current.play();
      setIsPlaying(true);
      toast.success(`Now playing: ${station.name}`);
    } catch (error) {
      console.error("Radio error:", error);
      toast.error("Failed to play radio. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      playStation(currentStation);
    }
  };

  return (
    <MainLayout>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="groove-gradient-bg h-16 w-16 rounded-2xl flex items-center justify-center"
          >
            <RadioIcon className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl font-bold">GrouaRadio Live</h1>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium animate-pulse">
                <Wifi className="h-3 w-3" />
                LIVE
              </span>
            </div>
            <p className="text-muted-foreground">
              AI-enhanced radio streaming • Powered by grouaradio.com
            </p>
          </div>
          <Button
            onClick={() => window.open("https://grouaradio.com/", "_blank")}
            variant="outline"
            className="gap-2 hover:bg-primary/10"
          >
            <ExternalLink className="h-4 w-4" />
            Otwórz GrouaRadio.com
          </Button>
        </div>

        {/* Current Playing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="groove-card p-6 mb-8"
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              <motion.div
                animate={isPlaying ? { rotate: 360 } : {}}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-32 h-32 rounded-full groove-gradient-bg flex items-center justify-center"
              >
                <div className="w-24 h-24 rounded-full bg-background flex items-center justify-center">
                  <RadioIcon className="h-10 w-10 text-primary" />
                </div>
              </motion.div>
              {isPlaying && (
                <motion.div
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-primary rounded-full"
                      animate={{ height: [8, 24, 8] }}
                      transition={{
                        duration: 0.5,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </div>

            <div className="flex-1 text-center md:text-left">
              <h2 className="font-display text-2xl font-bold mb-1">
                {currentStation.name}
              </h2>
              <p className="text-muted-foreground mb-2">
                {currentStation.description}
              </p>
              <div className="flex items-center justify-center md:justify-start gap-4 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {currentStation.listeners.toLocaleString()} listeners
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                  <Sparkles className="h-3 w-3" />
                  AI Enhanced
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <Button
                onClick={togglePlay}
                disabled={loading}
                size="lg"
                className="groove-gradient-bg text-primary-foreground hover:opacity-90 w-16 h-16 rounded-full"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                ) : isPlaying ? (
                  <Pause className="h-6 w-6 fill-current" />
                ) : (
                  <Play className="h-6 w-6 fill-current ml-1" />
                )}
              </Button>

              <div className="flex items-center gap-2 w-32">
                <button onClick={() => setIsMuted(!isMuted)}>
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  onValueChange={([v]) => {
                    setVolume(v);
                    if (v > 0) setIsMuted(false);
                  }}
                  max={100}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Station List */}
        <h2 className="font-display text-xl font-bold mb-4">All Stations</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {radioStations.map((station) => (
            <motion.button
              key={station.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => playStation(station)}
              className={`p-4 rounded-xl text-left transition-colors ${
                currentStation.id === station.id
                  ? "groove-card border-primary/50"
                  : "bg-secondary/50 hover:bg-secondary"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    currentStation.id === station.id
                      ? "groove-gradient-bg"
                      : "bg-muted"
                  }`}
                >
                  <RadioIcon
                    className={`h-6 w-6 ${
                      currentStation.id === station.id
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{station.name}</h3>
                    {station.isLive && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {station.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{station.genre}</span>
                    <span>•</span>
                    <span>{station.listeners.toLocaleString()} listening</span>
                  </div>
                </div>
                {currentStation.id === station.id && isPlaying && (
                  <motion.div className="flex gap-0.5">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-primary rounded-full"
                        animate={{ height: [4, 16, 4] }}
                        transition={{
                          duration: 0.4,
                          repeat: Infinity,
                          delay: i * 0.1,
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </MainLayout>
  );
};

export default Radio;
