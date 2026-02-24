import { Store, Globe, AtSign, LineChart } from 'lucide-react';

export function Footer() {
    return (
        <footer className="bg-white border-t border-slate-100 pt-20 pb-10">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
                    <div className="col-span-2">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="bg-primary text-white p-1 rounded-md">
                                <Store className="w-5 h-5" />
                            </div>
                            <span className="text-lg font-extrabold tracking-tight text-slate-900">RetailCraft</span>
                        </div>
                        <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
                            The world's most reliable POS for modern multi-store enterprise retailers. Performance first, offline always.
                        </p>
                    </div>

                    <div>
                        <h5 className="font-bold text-slate-900 mb-6">Product</h5>
                        <ul className="space-y-4 text-sm text-slate-500">
                            <li><a className="hover:text-primary transition-colors" href="#">POS Terminal</a></li>
                            <li><a className="hover:text-primary transition-colors" href="#">Inventory Management</a></li>
                            <li><a className="hover:text-primary transition-colors" href="#">Analytics Cloud</a></li>
                            <li><a className="hover:text-primary transition-colors" href="#">Marketplace</a></li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-slate-900 mb-6">Resources</h5>
                        <ul className="space-y-4 text-sm text-slate-500">
                            <li><a className="hover:text-primary transition-colors" href="#">Documentation</a></li>
                            <li><a className="hover:text-primary transition-colors" href="#">API Reference</a></li>
                            <li><a className="hover:text-primary transition-colors" href="#">Community</a></li>
                            <li><a className="hover:text-primary transition-colors" href="#">Support</a></li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-slate-900 mb-6">Legal</h5>
                        <ul className="space-y-4 text-sm text-slate-500">
                            <li><a className="hover:text-primary transition-colors" href="#">Privacy Policy</a></li>
                            <li><a className="hover:text-primary transition-colors" href="#">Terms of Service</a></li>
                            <li><a className="hover:text-primary transition-colors" href="#">Security</a></li>
                            <li><a className="hover:text-primary transition-colors" href="#">GDPR</a></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-10 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} RetailCraft Systems Inc. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a className="text-slate-400 hover:text-primary" href="#"><Globe className="w-5 h-5" /></a>
                        <a className="text-slate-400 hover:text-primary" href="#"><AtSign className="w-5 h-5" /></a>
                        <a className="text-slate-400 hover:text-primary" href="#"><LineChart className="w-5 h-5" /></a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
