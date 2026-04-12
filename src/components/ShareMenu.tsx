import { X } from "lucide-react";

interface ShareMenuProps {
  text: string;
  open: boolean;
  onClose: () => void;
}

const SHARE_OPTIONS = [
  { name: "WhatsApp", icon: "💬", getUrl: (t: string) => `https://api.whatsapp.com/send?text=${encodeURIComponent(t)}` },
  { name: "Telegram", icon: "✈️", getUrl: (t: string) => `https://t.me/share/url?url=&text=${encodeURIComponent(t)}` },
  { name: "X (Twitter)", icon: "𝕏", getUrl: (t: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}` },
  { name: "Facebook", icon: "📘", getUrl: (t: string) => `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(t)}` },
  { name: "E-mail", icon: "📧", getUrl: (t: string) => `mailto:?subject=${encodeURIComponent("Versículo Bíblico")}&body=${encodeURIComponent(t)}` },
];

const ShareMenu = ({ text, open, onClose }: ShareMenuProps) => {
  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[hsl(var(--dark-card))] rounded-t-2xl p-5 pb-8 animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[hsl(var(--dark-text))]">Compartilhar</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
            <X className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {SHARE_OPTIONS.map((opt) => (
            <a
              key={opt.name}
              href={opt.getUrl(text)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5"
              onClick={onClose}
            >
              <span className="text-2xl w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                {opt.icon}
              </span>
              <span className="text-[10px] text-[hsl(var(--dark-muted))] text-center leading-tight">{opt.name}</span>
            </a>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="w-full mt-4 py-3 rounded-xl bg-white/10 text-sm font-medium text-[hsl(var(--dark-text))] active:bg-white/20 transition-colors"
        >
          📋 Copiar texto
        </button>
      </div>
    </div>
  );
};

export default ShareMenu;
