import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { bibleUrlFromReference } from "@/lib/bibleNav";

interface Props {
  reference: string;
  note?: string;
  color?: string; // hsl triplet
}

const RefLink = ({ reference, note }: Props) => {
  const navigate = useNavigate();
  const url = bibleUrlFromReference(reference);
  return (
    <button
      type="button"
      onClick={() => url && navigate(url)}
      disabled={!url}
      className="group w-full flex items-center gap-2 rounded-xl px-3 py-2 bg-dark-card active:bg-dark-card-hover disabled:opacity-50 transition-colors text-left border border-dark-card-hover hover:border-primary/50"
      aria-label={`Abrir ${reference} na Bíblia`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary">{reference}</span>
          <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
        </div>
        {note && <p className="text-[11px] text-dark-muted leading-tight mt-0.5">{note}</p>}
      </div>
    </button>
  );
};

export default RefLink;
