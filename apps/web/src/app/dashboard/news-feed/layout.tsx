import { Newsreader } from 'next/font/google';

// Scoped to this route rather than the root layout so the serif is only
// downloaded by people who open the news feed.
const newsreader = Newsreader({
    subsets: ['latin'],
    weight: ['300', '400', '500'],
    style: ['normal', 'italic'],
    variable: '--font-newsreader',
    display: 'swap',
    // Next 13.4 has no metric overrides for Newsreader and logs a build error
    // while trying to synthesise one. The page names its own serif fallbacks.
    adjustFontFallback: false,
    fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export default function NewsFeedLayout({ children }: { children: React.ReactNode }) {
    return <div className={`${newsreader.variable} min-h-full bg-feed-paper text-feed-ink`}>{children}</div>;
}
