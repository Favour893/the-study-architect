"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { ensureNotificationPermission } from "@/lib/alarms/notifications";

const DISMISS_KEY = "tsa-pwa-install-dismissed";
const IOS_DISMISS_KEY = "tsa-pwa-ios-install-dismissed";

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInstalledPwa() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosVisible, setIosVisible] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    if (localStorage.getItem(IOS_DISMISS_KEY) === "true") {
      return false;
    }
    return isIosDevice() && !isInstalledPwa();
  });

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "true") {
      return;
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
    setDeferredPrompt(null);
  }

  async function install() {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    await ensureNotificationPermission();
    dismiss();
  }

  function dismissIos() {
    localStorage.setItem(IOS_DISMISS_KEY, "true");
    setIosVisible(false);
  }

  if (iosVisible && !isInstalledPwa()) {
    return (
      <div className="fixed inset-x-0 bottom-16 z-30 px-3 md:bottom-4 md:left-auto md:right-4 md:max-w-sm md:px-0">
        <div className="rounded-xl border border-app-border bg-panel p-4 shadow-lg shadow-blue-900/10 ring-1 ring-app-border/80">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" width={40} height={40} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-app-fg">Add TSA to your Home Screen</p>
              <p className="mt-0.5 text-xs text-app-subtle">
                On iPhone, alarms only ring when the app is installed. Tap Share, then &quot;Add to Home Screen&quot;.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={dismissIos}
                  className="rounded-lg bg-app-accent px-3 py-1.5 text-xs font-medium text-white"
                >
                  Got it
                </button>
                <button
                  type="button"
                  onClick={dismissIos}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-app-subtle hover:text-app-fg"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissIos}
              className="rounded-md p-1 text-app-subtle hover:bg-app-muted hover:text-app-fg"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!visible || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 px-3 md:bottom-4 md:left-auto md:right-4 md:max-w-sm md:px-0">
      <div className="rounded-xl border border-app-border bg-panel p-4 shadow-lg shadow-blue-900/10 ring-1 ring-app-border/80">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" width={40} height={40} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-app-fg">Install The Study Architect</p>
            <p className="mt-0.5 text-xs text-app-subtle">
              Add TSA to your home screen for class and exam alarms that ring on your phone.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-1.5 rounded-lg bg-app-accent px-3 py-1.5 text-xs font-medium text-white"
              >
                <Download className="h-3.5 w-3.5" />
                Install
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-app-subtle hover:text-app-fg"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-app-subtle hover:bg-app-muted hover:text-app-fg"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
