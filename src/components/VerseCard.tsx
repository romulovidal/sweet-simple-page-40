import { Heart, Share2, BookmarkPlus } from "lucide-react";
import { useState } from "react";

interface VerseCardProps {
  text: string;
  reference: string;
}

const VerseCard = ({ text, reference }: VerseCardProps) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: reference,
        text: `"${text}" — ${reference}`,
      }).catch(() => {});
    }
  };

  return (
    <div className="bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)] rounded-2xl p-6 text-white">
      <p className="text-base leading-relaxed mb-4 font-light">"{text}"</p>
      <p className="text-sm font-semibold opacity-90 mb-5">{reference}</p>
      <div className="flex items-center gap-4">
        <button onClick={() => setLiked(!liked)} className="transition-transform active:scale-90">
          <Heart className={`w-5 h-5 ${liked ? "fill-white" : ""}`} />
        </button>
        <button onClick={() => setSaved(!saved)} className="transition-transform active:scale-90">
          <BookmarkPlus className={`w-5 h-5 ${saved ? "fill-white" : ""}`} />
        </button>
        <button onClick={handleShare} className="transition-transform active:scale-90">
          <Share2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default VerseCard;
