import { useEffect, useState } from "react";
import { Download, Check, Trash2, Loader2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { BIBLE_VERSIONS, type BibleVersion } from "@/services/bibleApi";
import { isVersionCached, downloadVersion, removeVersion } from "@/lib/bibleOffline";

const BibleDownloadManager = () => {
  const [cachedVersions, setCachedVersions] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const check = async () => {
      const cached = new Set<string>();
      for (const v of BIBLE_VERSIONS) {
        if (await isVersionCached(v)) cached.add(v.id);
      }
      setCachedVersions(cached);
    };
    check();

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleDownload = async (version: BibleVersion) => {
    setDownloading(version.id);
    setProgress(0);
    try {
      await downloadVersion(version, setProgress);
      setCachedVersions((prev) => new Set([...prev, version.id]));
      toast.success(`${version.shortName} baixada com sucesso!`);
    } catch {
      toast.error(`Erro ao baixar ${version.shortName}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleRemove = async (version: BibleVersion) => {
    await removeVersion(version);
    setCachedVersions((prev) => {
      const next = new Set(prev);
      next.delete(version.id);
      return next;
    });
    toast.success(`${version.shortName} removida do offline`);
  };

  const downloadAll = async () => {
    for (const v of BIBLE_VERSIONS) {
      if (!cachedVersions.has(v.id)) {
        await handleDownload(v);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-destructive" />
          )}
          <span className="text-xs text-muted-foreground">
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {cachedVersions.size}/{BIBLE_VERSIONS.length} baixadas
        </span>
      </div>

      {cachedVersions.size < BIBLE_VERSIONS.length && isOnline && (
        <button
          onClick={downloadAll}
          disabled={!!downloading}
          className="w-full bg-primary text-primary-foreground rounded-xl p-3 text-sm font-semibold active:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Download className="w-4 h-4 inline mr-2" />
          Baixar todas as versões
        </button>
      )}

      <div className="space-y-2">
        {BIBLE_VERSIONS.map((v) => {
          const isCached = cachedVersions.has(v.id);
          const isDownloading = downloading === v.id;

          return (
            <div key={v.id} className="flex items-center gap-3 bg-card rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{v.shortName}</p>
                <p className="text-xs text-muted-foreground truncate">{v.name}</p>
              </div>

              {isDownloading ? (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                </div>
              ) : isCached ? (
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <button
                    onClick={() => handleRemove(v)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : isOnline ? (
                <button
                  onClick={() => handleDownload(v)}
                  disabled={!!downloading}
                  className="text-primary p-1 disabled:opacity-50"
                >
                  <Download className="w-5 h-5" />
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">Indisponível</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BibleDownloadManager;
