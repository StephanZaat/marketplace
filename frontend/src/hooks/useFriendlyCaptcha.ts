import { useRef, useEffect, useCallback } from "react";
import { FriendlyCaptchaSDK, WidgetHandle } from "@friendlycaptcha/sdk";

const SITEKEY = import.meta.env.VITE_FRIENDLY_CAPTCHA_SITEKEY ?? "";

export function useFriendlyCaptcha() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<WidgetHandle | null>(null);
  const responseRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITEKEY || !containerRef.current) return;

    const sdk = new FriendlyCaptchaSDK();
    const widget = sdk.createWidget({
      element: containerRef.current,
      sitekey: SITEKEY,
      apiEndpoint: "global",
    });

    widget.addEventListener("frc:widget.complete", (event: any) => {
      responseRef.current = event.detail.response;
    });

    widget.addEventListener("frc:widget.expire", () => {
      responseRef.current = null;
    });

    widget.addEventListener("frc:widget.error", () => {
      responseRef.current = null;
    });

    widgetRef.current = widget;

    return () => {
      widget.destroy();
      widgetRef.current = null;
      responseRef.current = null;
    };
  }, []);

  const getResponse = useCallback(() => responseRef.current, []);

  const reset = useCallback(() => {
    responseRef.current = null;
    widgetRef.current?.reset();
  }, []);

  return { containerRef, getResponse, reset };
}
