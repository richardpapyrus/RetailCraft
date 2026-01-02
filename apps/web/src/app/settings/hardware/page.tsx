'use client';

import { useState, useEffect } from 'react';
import { printerService } from '@/lib/printer-service';

export default function HardwareSettings() {
    const [status, setStatus] = useState<string>('Disconnected');
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setConnected(printerService.isConnected());
        setStatus(printerService.isConnected() ? 'Connected' : 'Disconnected');
    }, []);

    const handleConnect = async () => {
        try {
            setError(null);
            await printerService.connect();
            setConnected(true);
            setStatus('Connected');
        } catch (e: any) {
            setError(e.message || 'Failed to connect');
        }
    };

    const handleDisconnect = async () => {
        await printerService.disconnect();
        setConnected(false);
        setStatus('Disconnected');
    };

    const handleTestPrint = async () => {
        try {
            const receipt = PrinterServiceOriginal.createReceipt(
                'TEST RECEIPT',
                [{ name: 'Test Item', quantity: 1, price: 10.00 }],
                '$10.00'
            );
            await printerService.print(receipt);
        } catch (e: any) {
            setError('Print failed: ' + e.message);
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6">Hardware Settings</h1>
            <div className="bg-white rounded-2xl shadow-sm p-6 max-w-2xl">
                <h2 className="text-xl font-bold mb-6">Receipt Printer</h2>

                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                            <div className="font-medium text-gray-900">USB Thermal Printer</div>
                            <div className={`text-sm ${connected ? 'text-green-600' : 'text-gray-500'}`}>
                                Status: {status}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {connected ? (
                                <>
                                    <button
                                        onClick={handleTestPrint}
                                        className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                                    >
                                        Test Print
                                    </button>
                                    <button
                                        onClick={handleDisconnect}
                                        className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                                    >
                                        Disconnect
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={handleConnect}
                                    className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800"
                                >
                                    Connect Printer
                                </button>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="text-sm text-gray-500">
                        <p className="mb-2"><strong>Supported Devices:</strong> Standard ESC/POS USB Thermal Printers.</p>
                        <p>Note: WebUSB requires a secure context (HTTPS) or localhost. Ensure your printer driver does not claim the USB interface exclusively.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper to access static method if import fails or class name conflict
import { PrinterService as PrinterServiceOriginal } from '@/lib/printer-service';
