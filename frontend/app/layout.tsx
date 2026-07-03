/**
 * app/layout.tsx  — UPDATED
 *
 * Changes from original:
 *   1. Import AuthProvider from @/lib/auth-context
 *   2. Import AppShell from @/components/auth/AppShell
 *   3. Wrap <Providers> in <AuthProvider>
 *   4. Replace the inline shell div + <Sidebar>/<TopBarContainer>/<main>
 *      with a single <AppShell> — which conditionally shows the shell
 *      (protected routes) or renders bare (login / invite pages).
 *
 * Everything else — fonts, ThemeProvider, Toaster, metadata — is unchanged.
 */

import type { Metadata } from "next"
import { Inter, Space_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import "./globals.css"

import { cn } from "@/lib/utils"
import { Providers } from "@/app/providers"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/lib/auth-context"      // ← NEW
import { AppShell } from "@/components/auth/AppShell"  // ← NEW

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "GoTeeOff CRM",
  description: "AI Lead Generation Dashboard",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-bg text-text antialiased",
          inter.variable,
          spaceMono.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>          {/* ← NEW: wraps everything */}
            <Providers>
              <AppShell>          {/* ← NEW: replaces old shell div */}
                {children}
              </AppShell>
              <Toaster position="bottom-right" richColors />
            </Providers>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
