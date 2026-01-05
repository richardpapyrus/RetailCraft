import { fetchClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Store } from 'lucide-react';

export function BusinessDashboard({ dateRange }: { dateRange: { from: Date, to: Date } }) {
    // We would fetch business stats here
    // For now, placeholder UI
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Building2 className="w-6 h-6 text-indigo-600" />
                Business Overview (HQ)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">$0.00</div>
                        <p className="text-xs text-muted-foreground">Aggregate across all locations</p>
                    </CardContent>
                </Card>
                {/* More cards... */}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Store className="w-5 h-5" />
                        Location Performance
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500">Store breakdown table would go here...</p>
                </CardContent>
            </Card>
        </div>
    )
}
