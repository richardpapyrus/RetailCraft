import Link from 'next/link';
import { Hero } from '../../components/marketing/Hero';
import { Features } from '../../components/marketing/Features';
import { Benefits } from '../../components/marketing/Benefits';
import { Footer } from '../../components/marketing/Footer';
import { Store } from 'lucide-react';

export default function Home() {
    return (
        <div className="bg-background-light text-slate-900 font-display min-h-screen font-sans">
            {/* Header / Nav */}
            <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/70 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary text-white p-1.5 rounded-lg">
                            <Store className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-extrabold tracking-tight text-slate-900">RetailCraft</span>
                    </div>
                    <div className="hidden md:flex items-center gap-10">
                        <a className="text-sm font-semibold text-slate-600 hover:text-primary transition-colors" href="#features">Features</a>
                        <a className="text-sm font-semibold text-slate-600 hover:text-primary transition-colors" href="#benefits">Benefits</a>
                        <a className="text-sm font-semibold text-slate-600 hover:text-primary transition-colors" href="#docs">Developers</a>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/login" className="text-sm font-semibold text-slate-700 hover:text-primary px-4 py-2">Log in</Link>
                        <Link href="/login" className="bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                            System Login
                        </Link>
                    </div>
                </div>
            </nav>

            <main>
                <Hero />
                <Features />
                <Benefits />
            </main>

            <Footer />
        </div>
    );
}
