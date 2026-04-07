import { cookies } from "next/headers";

import type { Locale, SessionCookiePayload } from "@/lib/types";

export const SESSION_COOKIE_NAME = "study_session";

export function encodeSessionCookie(payload: SessionCookiePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeSessionCookie(value?: string | null): SessionCookiePayload | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SessionCookiePayload;
  } catch {
    return null;
  }
}

export function readSessionCookie(): SessionCookiePayload | null {
  const raw = cookies().get(SESSION_COOKIE_NAME)?.value;
  return decodeSessionCookie(raw);
}

export function getLocaleFromCookie(): Locale {
  return readSessionCookie()?.locale ?? "en";
}
