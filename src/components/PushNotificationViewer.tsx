import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Bell } from "lucide-react";

interface PushData {
  title: string;
  body: string;
}

const PushNotificationViewer = () => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PushData | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_NOTIFICATION_CLICKED") {
        setData({ title: event.data.title, body: event.data.body });
        setOpen(true);
      }
    };

    navigator.serviceWorker?.addEventListener("message", handler);

    // Also check URL params (fallback for when app wasn't open)
    const params = new URLSearchParams(window.location.search);
    const pushTitle = params.get("push_title");
    const pushBody = params.get("push_body");
    if (pushTitle && pushBody) {
      setData({ title: decodeURIComponent(pushTitle), body: decodeURIComponent(pushBody) });
      setOpen(true);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    return () => {
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, []);

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base">{data.title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed whitespace-pre-wrap pt-2">
            {data.body}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default PushNotificationViewer;
