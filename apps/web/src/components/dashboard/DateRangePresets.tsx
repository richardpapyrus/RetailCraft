"use client";

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

export default function DateRangePresets({ dateRange, onSelect }: {
    dateRange: { from: string; to: string },
    onSelect: (range: { from: string; to: string }) => void
}) {
    const presets = makePresets();

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {presets.map(p => {
                const active = dateRange.from === p.from && dateRange.to === p.to;
                return (
                    <button
                        key={p.label}
                        onClick={() => onSelect({ from: p.from, to: p.to })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${active
                            ? 'bg-brand-500 text-white'
                            : 'bg-white text-charcoal border border-cool-grey hover:bg-surface-muted'
                            }`}
                    >
                        {p.label}
                    </button>
                );
            })}
        </div>
    );
}
