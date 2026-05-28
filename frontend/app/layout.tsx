import type { Metadata } from "next"
import { Inter, Space_Mono } from "next/font/google"
import { Suspense } from "react"
import { ThemeProvider } from "next-themes"
import "./globals.css"

import { cn } from "@/lib/utils"
import { Providers } from "@/app/providers"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBarContainer } from "@/components/layout/TopBarContainer"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "GoTeeOff CRM",
  description: "AI Lead Generation Dashboard",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-bg text-text antialiased", inter.variable, spaceMono.variable)}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <Providers>
            <div className="flex min-h-screen w-full">
              <Sidebar />
              <div className="flex min-h-screen flex-1 flex-col">
                <Suspense fallback={null}>
                  <TopBarContainer />
                </Suspense>
                <main className="flex-1">{children}</main>
              </div>
            </div>
            <Toaster position="bottom-right" richColors />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
