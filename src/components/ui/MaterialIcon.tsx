import { cn } from "@/lib/utils";

interface MaterialIconProps {
  name: string;
  className?: string;
  filled?: boolean;
}

export const MaterialIcon = ({ name, className, filled = false }: MaterialIconProps) => {
  return (
    <span 
      className={cn(
        filled ? "material-icons" : "material-icons-outlined",
        className
      )}
      style={{ fontFamily: filled ? "'Material Icons'" : "'Material Icons Outlined'" }}
    >
      {name}
    </span>
  );
};

// Icon name mappings for common use cases
export const IconNames = {
  home: "home",
  search: "search",
  library: "library_music",
  add: "add_circle",
  favorite: "favorite",
  favoriteBorder: "favorite_border",
  radio: "radio",
  face: "face",
  autorenew: "autorenew",
  playlistAdd: "playlist_add",
  settings: "settings",
  play: "play_arrow",
  pause: "pause",
  skipNext: "skip_next",
  skipPrevious: "skip_previous",
  shuffle: "shuffle",
  repeat: "repeat",
  repeatOne: "repeat_one",
  volumeUp: "volume_up",
  volumeOff: "volume_off",
  queue: "queue_music",
  mic: "mic",
  fullscreen: "fullscreen",
  logout: "logout",
  person: "person",
  upload: "upload",
  videoLibrary: "video_library",
  music: "music_note",
  album: "album",
  mood: "mood",
  smartToy: "smart_toy",
  insights: "insights",
  history: "history",
  arrowBack: "arrow_back",
  close: "close",
  check: "check",
  error: "error",
  info: "info",
  warning: "warning",
} as const;