"use client";

import { useEffect, useRef, useState } from "react";

interface FitTextProps {
    children: React.ReactNode;
    className?: string;
    maxScale?: number;
}

export const FitText: React.FC<FitTextProps> = ({ children, className, maxScale = 1 }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const resize = () => {
            if (containerRef.current && textRef.current) {
                const containerWidth = containerRef.current.offsetWidth;
                const textWidth = textRef.current.offsetWidth;

                // Reset scale to 1 to measure true width first
                // Actually, offsetWidth on textRef might be affected by current transform?
                // No, transform doesn't affect offsetWidth layout property usually, 
                // but checking bounding client rect is safer if scaled.
                // Better approach:
                // We assume the textRef is the full width content.
                // If we want to support dynamic updates, we should perhaps force scale 1 before measure?
                // A simpler way is to compare scrollWidth of container if text was natural.

                // Let's rely on scrollWidth of the span vs clientWidth of container
                // BUT, to measure "unscaled" width easily:

                const availableWidth = containerWidth;
                // We can't easily measure "unscaled" if it is already scaled.
                // So we assume the text content changed or window resized.

                // Approximation:
                // If we just render the span naturally, we can measure.
                // Let's use a helper logic:
                // 1. Calculate ratio.
                // 2. Clamp at maxScale.

                // To get true width, we can use a hidden clone or just reset scale temporarily if flickering is okay (it's not).
                // Alternatively, calculate width based on bounding rect / scale.

                const currentRect = textRef.current.getBoundingClientRect();
                const currentWidth = currentRect.width / scale; // Unscaled width

                if (currentWidth > availableWidth) {
                    setScale(availableWidth / currentWidth);
                } else {
                    setScale(Math.min(maxScale, 1));
                }
            }
        };

        // Initial measure
        // We might need to wait for font load etc, but effect runs after render.
        // To be safe, we can use a ResizeObserver on the container.

        const observer = new ResizeObserver(resize);
        if (containerRef.current) observer.observe(containerRef.current);

        // Also observe text content changes if possible, purely via effect dep [children]
        resize();

        return () => observer.disconnect();
    }, [children, maxScale]);

    return (
        <div
            ref={containerRef}
            className={`w-full ${className}`}
            style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
        >
            <span
                ref={textRef}
                style={{
                    display: 'inline-block',
                    transform: `scale(${scale})`,
                    transformOrigin: 'left center',
                    width: scale < 1 ? `${(1 / scale) * 100}%` : 'auto'
                    // Width adjustments to ensure it takes up space correctly or creates spacing?
                    // actually if we scale down, visual width decreases. 
                    // layout width remains "full" if we don't adjust width.
                    // For a simple 'Hard Stop', visual scaling is key.
                }}
            >
                {children}
            </span>
        </div>
    );
};
