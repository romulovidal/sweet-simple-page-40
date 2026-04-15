import { useEffect, useState } from "react";
import { Download, Check, Trash2, Loader2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { BIBLE_VERSIONS, type BibleVersion } from "@/services/bibleApi";
import { downloadVersion, getCachedVersions, removeVersion } from "@/lib/bibleOffline";

const BibleDownloadManager = () => {
  const [cachedVersions, setCachedVersions] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [supportsOffline, setSupportsOffline] = useState("caches" in globalThis);

  const refreshCachedVersions = async () => {
    const cached = await getCachedVersions();
    setCachedVersions(new Set(cached));
  };

  useEffect(() => {
    setSupportsOffline("caches" in globalThis);
    refreshCachedVersions();

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
      await refreshCachedVersions();
      toast.success(`${version.shortName} baixada com sucesso!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Erro ao baixar ${version.shortName}`;
      toast.error(message);
    } finally {
      setDownloading(null);
    }
  };

  const handleRemove = async (version: BibleVersion) => {
    await removeVersion(version);
    await refreshCachedVersions();
    toast.success(`${version.shortName} removida do offline`);
  };

  const downloadAll = async () => {
    for (const version of BIBLE_VERSIONS) {
      if (!cachedVersions.has(version.id)) {
        await handleDownload(version);
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

      {!supportsOffline && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          Seu navegador nao suporta o armazenamento offline da Biblia.
        </div>
      )}

      {supportsOffline && cachedVersions.size < BIBLE_VERSIONS.length && isOnline && (
        <button
          onClick={downloadAll}
          disabled={!!downloading}
          className="w-full bg-primary text-primary-foreground rounded-xl p-3 text-sm font-semibold active:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Download className="w-4 h-4 inline mr-2" />
          Baixar todas as versoes
        </button>
      )}

      <div className="space-y-2">
        {BIBLE_VERSIONS.map((version) => {
          const isCached = cachedVersions.has(version.id);
          const isDownloading = downloading === version.id;

          return (
            <div key={version.id} className="flex items-center gap-3 bg-card rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{version.shortName}</p>
                <p className="text-xs text-muted-foreground truncate">{version.name}</p>
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
                    onClick={() => handleRemove(version)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : isOnline && supportsOffline ? (
                <button
                  onClick={() => handleDownload(version)}
                  disabled={!!downloading}
                  className="text-primary p-1 disabled:opacity-50"
                >
                  <Download className="w-5 h-5" />
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">Indisponivel</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BibleDownloadManager;
