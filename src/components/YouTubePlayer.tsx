import { useState } from "react";
import { Play } from "lucide-react";

interface YouTubePlayerProps {
  videoId: string;
  title: string;
}

const YouTubePlayer = ({ videoId, title }: YouTubePlayerProps) => {
  const [playing, setPlaying] = useState(false);

  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const embed = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&controls=1&iv_load_policy=3&fs=1`;

  return (
    <div className="relative aspect-video bg-black overflow-hidden">
      {!playing ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 w-full h-full"
          aria-label={`Reproduzir ${title}`}
        >
          <img
            src={thumb}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          <span className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
              <Play className="w-7 h-7 text-primary-foreground fill-current ml-1" />
            </span>
          </span>
        </button>
      ) : (
        <iframe
          src={embed}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title={title}
        />
      )}
    </div>
  );
};

export default YouTubePlayer;