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
                    background: '#FFFFFF',
                    color: '#2E3232',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid #ECEFEF',
                    fontSize: '14px',
                    maxWidth: '400px',
                    boxShadow: '0 8px 30px rgba(16, 42, 39, 0.08)',
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
