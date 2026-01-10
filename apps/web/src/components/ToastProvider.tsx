"use client";

import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
    return (
        <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={8}
            containerClassName="no-print"
            toastOptions={{
                duration: 8000,
                style: {
                    background: '#363636',
                    color: '#fff',
                    padding: '16px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    maxWidth: '400px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    fontWeight: 500,
                },
                success: {
                    duration: 8000,
                    style: {
                        background: '#F0FDF4', // green-50
                        color: '#166534', // green-800
                        border: '1px solid #BBF7D0', // green-200
                    },
                    iconTheme: {
                        primary: '#16A34A',
                        secondary: '#F0FDF4',
                    },
                },
                error: {
                    duration: 10000,
                    style: {
                        background: '#FEF2F2', // red-50
                        color: '#991B1B', // red-800
                        border: '1px solid #FECACA', // red-200
                    },
                    iconTheme: {
                        primary: '#DC2626',
                        secondary: '#FEF2F2',
                    },
                },
                loading: {
                    style: {
                        background: '#F9FAFB', // gray-50
                        color: '#1F2937', // gray-800
                        border: '1px solid #E5E7EB', // gray-200
                    },
                }
            }}
        />
    );
}
