import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from '@/components/SessionProvider'
import { SyncProvider } from '@/components/SyncProvider'

import { AppLayout } from '@/components/AppLayout'
import { ToastProvider } from '@/components/ToastProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'RetailCraft',
    description: 'Local-first enterprise retail POS system',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <ToastProvider />
                <SessionProvider>
                    <SyncProvider>
                        <AppLayout>
                            {children}
                        </AppLayout>
                    </SyncProvider>
                </SessionProvider>
            </body>
        </html>
    )
}
