"use client";

import { useState } from "react";

function toISODate(d: Date) {
    return d.toISOString().split('T')[0];
}

function makePresets() {
    const today = new Date();
    const startOfToday = toISODate(today);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startOfWeek = new Date(today);
    // Monday as the start of the week
    const dow = (startOfWeek.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - dow);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const last30 = new Date(today);
    last30.setDate(last30.getDate() - 29);

    return [
        { label: 'Today', from: startOfToday, to: startOfToday },
        { label: 'Yesterday', from: toISODate(yesterday), to: toISODate(yesterday) },
        { label: 'This Week', from: toISODate(startOfWeek), to: startOfToday },
        { label: 'This Month', from: toISODate(startOfMonth), to: startOfToday },
        { label: 'Last 30 Days', from: toISODate(last30), to: startOfToday },
    ];
}

const TONES = {
    brand: {
        active: 'bg-brand-500 text-white',
        idle: 'bg-white text-charcoal border border-cool-grey hover:bg-surface-muted',
    },
    feed: {
        active: 'bg-feed-ink text-feed-paper',
        idle: 'text-feed-ink2 border border-feed-rule hover:bg-feed-mute',
    },
};

export default function DateRangePresets({ dateRange, onSelect, tone = 'brand' }: {
    dateRange: { from: string; to: string },
    onSelect: (range: { from: string; to: string }) => void,
    tone?: keyof typeof TONES
}) {
    const palette = TONES[tone] ?? TONES.brand;
    const presets = makePresets();
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

    const matchesRange = (p: { from: string; to: string }) =>
        dateRange.from === p.from && dateRange.to === p.to;

    // Presets can share an identical range (e.g. "Today" and "This Week" on a
    // Monday), so range equality alone can't identify the active button. Prefer
    // the preset the user actually clicked; if the range was set another way
    // (initial load, manual date inputs), fall back to the first matching preset.
    const selectedPreset = presets.find(p => p.label === selectedLabel);
    const activeLabel = selectedPreset && matchesRange(selectedPreset)
        ? selectedPreset.label
        : presets.find(matchesRange)?.label;

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {presets.map(p => {
                const active = p.label === activeLabel;
                return (
                    <button
                        key={p.label}
                        onClick={() => {
                            setSelectedLabel(p.label);
                            onSelect({ from: p.from, to: p.to });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${active ? palette.active : palette.idle}`}
                    >
                        {p.label}
                    </button>
                );
            })}
        </div>
    );
}
