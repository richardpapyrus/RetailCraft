import { ShieldCheck, Package, Key, FileText } from 'lucide-react';

export function Features() {
    return (
        <section className="py-32" id="features">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-20">
                    <h2 className="text-primary font-bold tracking-widest uppercase text-sm mb-4">The Engine</h2>
                    <h3 className="text-4xl font-extrabold text-slate-900">Core Platform Features</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="group p-8 rounded-2xl border border-slate-100 bg-white hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 transition-all">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-3">Strict Store Isolation</h4>
                        <p className="text-slate-600 text-sm leading-relaxed">Secure data siloing for multi-tenant environments ensuring zero data leakage.</p>
                    </div>

                    <div className="group p-8 rounded-2xl border border-slate-100 bg-white hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 transition-all">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                            <Package className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-3">Advanced Inventory</h4>
                        <p className="text-slate-600 text-sm leading-relaxed">Real-time multi-store stock tracking and predictive management for complex retail.</p>
                    </div>

                    <div className="group p-8 rounded-2xl border border-slate-100 bg-white hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 transition-all">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                            <Key className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-3">Enterprise RBAC</h4>
                        <p className="text-slate-600 text-sm leading-relaxed">Granular permission controls for enterprise security and regional manager auditing.</p>
                    </div>

                    <div className="group p-8 rounded-2xl border border-slate-100 bg-white hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 transition-all">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-3">Accurate EOD Reports</h4>
                        <p className="text-slate-600 text-sm leading-relaxed">Precision financial reconciliation and multi-currency reporting for global compliance.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
