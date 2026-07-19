import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell } from "lucide-react";

interface PushData {
  title: string;
  body: string;
}

const PushNotificationViewer = () => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PushData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_NOTIFICATION_CLICKED") {
        setData({ title: event.data.title, body: event.data.body });
        setOpen(true);
        const url = event.data.url;
        if (url && typeof url === "string" && url.startsWith("/") && url !== "/" && url !== window.location.pathname + window.location.search) {
          navigate(url);
        }
      }
    };

    navigator.serviceWorker?.addEventListener("message", handler);

    const params = new URLSearchParams(window.location.search);
    const pushTitle = params.get("push_title");
    const pushBody = params.get("push_body");
    if (pushTitle && pushBody) {
      setData({ title: decodeURIComponent(pushTitle), body: decodeURIComponent(pushBody) });
      setOpen(true);
      // Strip only the push_* params, keep path and other query params intact
      params.delete("push_title");
      params.delete("push_body");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
    }

    return () => {
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, [navigate]);

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle className="text-base text-[hsl(var(--dark-text))]">{data.title}</DialogTitle>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap pt-2 text-[hsl(var(--dark-text))] opacity-90">
            {data.body}
          </p>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default PushNotificationViewer;
