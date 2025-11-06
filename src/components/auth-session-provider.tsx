"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import type { Session } from "next-auth";

type AuthSessionProviderProps = {
  session: Session | null;
  children: ReactNode;
};

export function AuthSessionProvider({
  session,
  children,
}: AuthSessionProviderProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
