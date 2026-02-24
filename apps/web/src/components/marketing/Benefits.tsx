import { Database, Zap, FileSignature } from 'lucide-react';

export function Benefits() {
    return (
        <section id="benefits" className="py-32 bg-slate-950 text-white overflow-hidden relative">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div>
                        <h2 className="text-primary font-bold tracking-widest uppercase text-sm mb-4">Architecture</h2>
                        <h3 className="text-4xl font-extrabold mb-10">Built for Performance and Security</h3>

                        <div className="space-y-8">
                            <div className="flex gap-6">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-primary">
                                    <Database className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-bold mb-2">Hardened Backend</h4>
                                    <p className="text-slate-400">Isolated database instances with automated failover and regional replication.</p>
                                </div>
                            </div>

                            <div className="flex gap-6">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-primary">
                                    <Zap className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-bold mb-2">Local-First Speed</h4>
                                    <p className="text-slate-400">Optimistic UI updates with zero-latency local storage and background conflict resolution.</p>
                                </div>
                            </div>

                            <div className="flex gap-6">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-primary">
                                    <FileSignature className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-bold mb-2">Data Integrity</h4>
                                    <p className="text-slate-400">Cryptographically signed transactions and immutable audit logs for every operation.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="bg-[#1e1e2e] shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-xl overflow-hidden border border-white/10 relative z-10">
                            <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex gap-2 items-center">
                                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                                <span className="ml-4 text-xs font-mono text-slate-400">ProductsController.ts</span>
                            </div>

                            <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto">
                                <div className="flex gap-4">
                                    <span className="text-slate-600 select-none">1</span>
                                    <span><span className="text-pink-400">async</span> <span className="text-blue-400">getInventory</span>(storeId: <span className="text-yellow-400">string</span>) {'{'}</span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-slate-600 select-none">2</span>
                                    <span className="pl-4"><span className="text-pink-400">const</span> user = <span className="text-pink-400">await</span> <span className="text-blue-400">this</span>.auth.<span className="text-blue-400">getCurrentUser</span>();</span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-slate-600 select-none">3</span>
                                    <span className="pl-4 text-slate-500">// Ensure strict tenant isolation</span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-slate-600 select-none">4</span>
                                    <span className="pl-4"><span className="text-pink-400">if</span> (user.storeId !== storeId) {'{'}</span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-slate-600 select-none">5</span>
                                    <span className="pl-8"><span className="text-pink-400">throw new</span> <span className="text-yellow-400">ForbiddenException</span>(<span className="text-green-300">'Access Denied'</span>);</span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-slate-600 select-none">6</span>
                                    <span className="pl-4">{'}'}</span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-slate-600 select-none">7</span>
                                    <span className="pl-4"><span className="text-pink-400">return this</span>.db.<span className="text-blue-400">products</span>.findMany({'{'}</span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-slate-600 select-none">8</span>
                                    <span className="pl-8">where: {'{'} storeId: storeId {'}'}</span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-slate-600 select-none">9</span>
                                    <span className="pl-4">{'}'});</span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-slate-600 select-none">10</span>
                                    <span>{'}'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Glow effect */}
                        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-primary/20 blur-3xl rounded-full z-0"></div>
                    </div>
                </div>
            </div>
        </section>
    );
}
