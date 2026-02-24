import { WifiOff, Zap, ShieldCheck, RefreshCw } from 'lucide-react';

export function Hero() {
    return (
        <>
            <section className="relative min-h-[80vh] lg:min-h-[85vh] flex items-center justify-center overflow-hidden">
                {/* Background Image Container */}
                <div className="absolute inset-0 z-0">
                    <img
                        alt="Retail associate using RetailCraft POS system"
                        className="w-full h-full object-cover"
                        src="/hero-image.png"
                    />
                    {/* Overlay to ensure text readability */}
                    <div className="absolute inset-0 bg-black/20"></div>
                </div>

                {/* Content Overlay */}
                <div className="relative z-10 max-w-7xl mx-auto px-6 text-center py-20 mt-10 text-shadow-lg">
                    <h1 className="text-4xl lg:text-6xl font-black leading-[1.2] tracking-tight text-white mb-8 drop-shadow-xl">
                        Enterprise Retail Point Of Sale Software
                    </h1>
                    <p className="text-lg md:text-xl text-white font-medium mb-12 max-w-3xl mx-auto drop-shadow-lg leading-relaxed">
                        Built for high-volume multi-store environments with real-time syncing and local-first architecture for 100% offline reliability. Never lose a sale again.
                    </p>
                    <div className="flex flex-wrap justify-center gap-6">
                        <button className="bg-primary text-white px-10 py-5 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-xl shadow-primary/25">
                            Start Free Trial
                        </button>
                        <button className="bg-white/10 backdrop-blur-md border border-white/30 text-white px-10 py-5 rounded-xl font-bold text-lg hover:bg-white/20 transition-all shadow-lg">
                            View Documentation
                        </button>
                    </div>
                </div>
            </section>

            {/* Social Proof Bar */}
            <section className="border-y border-slate-100 bg-slate-50/50 py-10">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-wrap justify-between items-center gap-8">
                        <div className="flex items-center gap-3">
                            <WifiOff className="text-primary w-8 h-8" strokeWidth={1.5} />
                            <div>
                                <p className="text-slate-900 font-bold text-lg">100%</p>
                                <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Offline Ready</p>
                            </div>
                        </div>
                        <div className="w-px h-10 bg-slate-200 hidden md:block"></div>
                        <div className="flex items-center gap-3">
                            <Zap className="text-primary w-8 h-8" strokeWidth={1.5} />
                            <div>
                                <p className="text-slate-900 font-bold text-lg">0ms</p>
                                <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Local Latency</p>
                            </div>
                        </div>
                        <div className="w-px h-10 bg-slate-200 hidden md:block"></div>
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="text-primary w-8 h-8" strokeWidth={1.5} />
                            <div>
                                <p className="text-slate-900 font-bold text-lg">Enterprise Grade</p>
                                <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">RBAC Controls</p>
                            </div>
                        </div>
                        <div className="w-px h-10 bg-slate-200 hidden md:block"></div>
                        <div className="flex items-center gap-3">
                            <RefreshCw className="text-primary w-8 h-8" strokeWidth={1.5} />
                            <div>
                                <p className="text-slate-900 font-bold text-lg">Real-time</p>
                                <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Cloud Syncing</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
