// Amparo service worker — push notifications only.
// No app-shell cache (Lovable preview-safe).

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: "Lembrete", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Amparo";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    requireInteraction: false,
    data: payload.data || {},
    actions: payload.actions || [
      { action: "taken", title: "Tomei" },
      { action: "skipped", title: "Não tomei" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;

  if (action === "taken" || action === "skipped") {
    const token = data.actionToken;
    if (token) {
      event.waitUntil(
        fetch("/api/public/hooks/dose-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, status: action }),
        }).catch(() => {})
      );
      return;
    }
  }

  // Default click: open or focus the dashboard.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        const url = data.url || "/dashboard";
        for (const c of clientsArr) {
          if ("focus" in c) {
            c.navigate(url).catch(() => {});
            return c.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
