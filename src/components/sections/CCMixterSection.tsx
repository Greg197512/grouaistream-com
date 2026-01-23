import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Music, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LicenseBadge, CCMixterBadge } from "@/components/ui/LicenseBadge";
import { CCMixterDownloadModal } from "@/components/modals/CCMixterDownloadModal";
import { searchCCMixter, CCMixterTrack, getLicenseInfo } from "@/services/ccMixterService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CCMixterSectionProps {
  genre: string;
  title: string;
  limit?: number;
}

export const CCMixterSection = ({ genre, title, limit = 8 }: CCMixterSectionProps) => {
  const [tracks, setTracks] = useState<CCMixterTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<CCMixterTrack | null>(null);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  const loadTracks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await searchCCMixter(genre, limit);
      setTracks(result.tracks);
      
      if (result.cached) {
        console.log(`CC Mixter: Loaded ${result.tracks.length} cached ${genre} tracks`);
      }
    } catch (err) {
      console.error('Failed to load CC Mixter tracks:', err);
      setError('Failed to load tracks from CC Mixter');
      toast.error('Could not load CC Mixter tracks. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
  }, [genre, limit]);

  const handleDownload = (track: CCMixterTrack) => {
    setSelectedTrack(track);
    setDownloadModalOpen(true);
  };

  if (loading) {
    return (
      <section className="px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <CCMixterBadge />
          <h2 className="font-display text-xl font-bold">{title}</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <CCMixterBadge />
          <h2 className="font-display text-xl font-bold">{title}</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={loadTracks}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </section>
    );
  }

  if (tracks.length === 0) {
    return null;
  }

  return (
    <section className="px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CCMixterBadge />
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
            {tracks.length} free tracks
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={loadTracks}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tracks.map((track, index) => {
          const licenseInfo = getLicenseInfo(track.license_url);
          const artistName = track.user_real_name || track.user_name;
          
          return (
            <motion.div
              key={track.upload_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group relative rounded-lg overflow-hidden bg-secondary/30 hover:bg-secondary/50 transition-all border border-transparent hover:border-primary/30"
            >
              {/* Cover placeholder */}
              <div className="relative aspect-square bg-gradient-to-br from-primary/20 to-accent/20">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Music className="h-12 w-12 text-primary/50" />
                </div>
                
                {/* CC Mixter badge */}
                <div className="absolute top-2 left-2">
                  <CCMixterBadge />
                </div>

                {/* Download overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => handleDownload(track)}
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Download
                  </Button>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-medium text-sm truncate" title={track.upload_name}>
                  {track.upload_name}
                </p>
                <p className="text-xs text-muted-foreground truncate" title={artistName}>
                  {artistName}
                </p>
                
                <div className="flex items-center justify-between mt-2">
                  <LicenseBadge 
                    badges={licenseInfo.badges} 
                    licenseType={licenseInfo.type}
                    size="sm"
                  />
                  <button
                    onClick={() => window.open(track.file_page_url, '_blank')}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="View on CC Mixter"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <CCMixterDownloadModal
        track={selectedTrack}
        open={downloadModalOpen}
        onOpenChange={setDownloadModalOpen}
      />
    </section>
  );
};
