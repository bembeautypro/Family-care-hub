import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getVapidPublicKey,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push.functions";
import {
  isPushSupported,
  getCurrentSubscription,
  subscribePush,
  unsubscribePush,
} from "@/lib/push-client";

export function PushReminderToggle() {
  const fetchVapid = useServerFn(getVapidPublicKey);
  const doSubscribe = useServerFn(subscribeToPush);
  const doUnsubscribe = useServerFn(unsubscribeFromPush);

  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "default">(
    "default",
  );

  useEffect(() => {
    const ok = isPushSupported();
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    getCurrentSubscription().then((sub) => setActive(!!sub));
  }, []);

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        Este navegador não suporta notificações push. Em iPhone, adicione o app à tela de início primeiro.
      </p>
    );
  }

  async function enable() {
    setBusy(true);
    try {
      const { publicKey } = await fetchVapid();
      if (!publicKey) throw new Error("VAPID não configurado.");
      const sub = await subscribePush(publicKey);
      await doSubscribe({ data: sub });
      setActive(true);
      setPermission("granted");
      toast.success("Lembretes ativados neste dispositivo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ativar lembretes");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const endpoint = await unsubscribePush();
      if (endpoint) await doUnsubscribe({ data: { endpoint } });
      setActive(false);
      toast.success("Lembretes desativados neste dispositivo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desativar");
    } finally {
      setBusy(false);
    }
  }

  if (permission === "denied") {
    return (
      <p className="text-xs text-muted-foreground">
        Notificações bloqueadas. Libere nas configurações do navegador para usar lembretes.
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant={active ? "outline" : "default"}
      className="h-[52px] w-full justify-start gap-3"
      disabled={busy}
      onClick={active ? disable : enable}
    >
      {busy ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : active ? (
        <BellOff className="h-5 w-5" />
      ) : (
        <Bell className="h-5 w-5" />
      )}
      {active ? "Desativar lembretes neste dispositivo" : "Ativar lembretes neste dispositivo"}
    </Button>
  );
}
