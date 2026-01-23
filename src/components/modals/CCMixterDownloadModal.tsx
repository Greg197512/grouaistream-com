import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LicenseBadge } from "@/components/ui/LicenseBadge";
import { CCMixterTrack, getLicenseInfo, downloadCCMixterTrack } from "@/services/ccMixterService";
import { toast } from "sonner";
import { Download, ExternalLink, Music } from "lucide-react";

interface CCMixterDownloadModalProps {
  track: CCMixterTrack | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CCMixterDownloadModal = ({
  track,
  open,
  onOpenChange,
}: CCMixterDownloadModalProps) => {
  const [consentGiven, setConsentGiven] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!track) return null;

  const licenseInfo = getLicenseInfo(track.license_url);
  const artistName = track.user_real_name || track.user_name;

  const handleDownload = async () => {
    if (!consentGiven) {
      toast.error("Please confirm the attribution agreement");
      return;
    }

    setDownloading(true);
    
    try {
      const result = await downloadCCMixterTrack(track);
      
      if (result.success) {
        // Store consent in localStorage for GDPR
        const consents = JSON.parse(localStorage.getItem('cc_download_consents') || '[]');
        consents.push({
          trackId: track.upload_id,
          trackName: track.upload_name,
          artist: artistName,
          license: licenseInfo.type,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('cc_download_consents', JSON.stringify(consents));
        
        toast.success("Download started! Remember to credit the artist.");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Download failed");
      }
    } catch (error) {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const attributionText = `"${track.upload_name}" by ${artistName} is licensed under ${licenseInfo.type}. Source: ccmixter.org`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Download Legal CC Track
          </DialogTitle>
          <DialogDescription>
            This track is available under Creative Commons license.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Track Info */}
          <div className="p-4 rounded-lg bg-secondary/50">
            <h3 className="font-semibold text-lg truncate">{track.upload_name}</h3>
            <p className="text-sm text-muted-foreground">{artistName}</p>
            
            <div className="flex items-center gap-2 mt-2">
              <LicenseBadge 
                badges={licenseInfo.badges} 
                licenseType={licenseInfo.type}
                size="md"
              />
            </div>
          </div>

          {/* Attribution Text */}
          <div className="p-3 rounded border border-border bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Required Attribution:</p>
            <p className="text-sm font-mono bg-background p-2 rounded select-all">
              {attributionText}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(attributionText);
                toast.success("Attribution copied to clipboard");
              }}
            >
              Copy Attribution
            </Button>
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent"
              checked={consentGiven}
              onCheckedChange={(checked) => setConsentGiven(checked === true)}
            />
            <label htmlFor="consent" className="text-sm text-muted-foreground cursor-pointer">
              I understand and agree to provide proper attribution when using this track, 
              as required by the {licenseInfo.type} license. (GDPR compliant consent)
            </label>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(track.file_page_url, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View on CC Mixter
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!consentGiven || downloading}
          >
            <Download className="h-4 w-4 mr-1" />
            {downloading ? "Downloading..." : "Download MP3"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
