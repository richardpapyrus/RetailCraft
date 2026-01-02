import { useEffect, useRef } from 'react';

/**
 * useBarcodeScanner Hook
 * Listens for global keydown events to detect barcode scanner input.
 * Scanners typically emulate rapid keyboard strokes followed by Enter.
 * 
 * @param onScan Callback function triggered when a valid barcode is scanned.
 * @param options Configuration options
 */
export function useBarcodeScanner(
    onScan: (barcode: string) => void,
    options: {
        minChars?: number;
        maxDelay?: number; // Max time between keystrokes to be considered a scan
        preventDefault?: boolean;
    } = {}
) {
    const { minChars = 3, maxDelay = 50, preventDefault = true } = options;
    const buffer = useRef<string>('');
    const lastKeyTime = useRef<number>(0);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();
            const timeDiff = now - lastKeyTime.current;

            // If timing is too slow, reset buffer (unless it's the first char)
            if (buffer.current.length > 0 && timeDiff > maxDelay) {
                buffer.current = '';
            }

            lastKeyTime.current = now;

            if (e.key === 'Enter') {
                if (buffer.current.length >= minChars) {
                    if (preventDefault) e.preventDefault();
                    onScan(buffer.current);
                    buffer.current = '';
                }
            } else if (e.key.length === 1) { // Printable chars only
                // If focused on an input irrelevant to scanning, maybe don't capture?
                // But scanners usually just type.
                // We'll capture everything.
                buffer.current += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onScan, minChars, maxDelay, preventDefault]);
}
