"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
    api,
    Expense,
    ExpenseCategory,
    ExpenseListFilters,
    ExpenseMonthToDate,
    ExpenseSummary,
    ExpenseAlert,
} from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { confirmDialog } from '@/lib/dialog';
import { FitText } from '@/components/FitText';
import {
    Plus,
    Wallet,
    TrendingDown,
    TrendingUp,
    Percent,
    CalendarDays,
    ArrowUpDown,
    Search,
    Download,
    Upload,
    Pencil,
    Trash2,
    Paperclip,
    X,
    RefreshCw,
    AlertTriangle,
    Info,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

import { ExpenseFormModal } from '@/components/expenses/ExpenseFormModal';
import { ExpenseDetailModal } from '@/components/expenses/ExpenseDetailModal';
import { CategoryManager } from '@/components/expenses/CategoryManager';
import { ExpenseTrendChart, CategoryDonut } from '@/components/expenses/ExpenseCharts';
import DateRangePresets from '@/components/dashboard/DateRangePresets';

type Tab = 'overview' | 'list' | 'categories' | 'reports';

const PAGE_SIZE = 25;

const startOfThisMonth = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        .toISOString()
        .split('T')[0];
};

export default function ExpensesPage() {
    const { user, token, isHydrated, hasPermission, selectedStoreId } = useAuth();
    const router = useRouter();

    const [tab, setTab] = useState<Tab>('overview');
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);

    const [mtd, setMtd] = useState<ExpenseMonthToDate | null>(null);
    const [summary, setSummary] = useState<ExpenseSummary | null>(null);
    const [alerts, setAlerts] = useState<ExpenseAlert[]>([]);
    const [list, setList] = useState<Expense[]>([]);
    const [listTotal, setListTotal] = useState(0);
    const [filteredTotal, setFilteredTotal] = useState(0);

    const [loading, setLoading] = useState(true);
    const [listLoading, setListLoading] = useState(false);
    const [refreshNonce, setRefreshNonce] = useState(0);

    const [editing, setEditing] = useState<Expense | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [viewing, setViewing] = useState<Expense | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const importInputRef = useRef<HTMLInputElement>(null);

    // Reporting period for the list, charts and reports tab. Month-to-date KPIs
    // deliberately ignore this — they always cover the current calendar month.
    const [dateRange, setDateRange] = useState({
        from: startOfThisMonth(),
        to: new Date().toISOString().split('T')[0],
    });

    const [filters, setFilters] = useState({
        search: '',
        categoryId: '',
        createdById: '',
        minAmount: '',
        maxAmount: '',
    });
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sort, setSort] = useState<{ by: string; dir: 'asc' | 'desc' }>({
        by: 'expenseDate',
        dir: 'desc',
    });
    const [page, setPage] = useState(0);

    const canView = hasPermission('VIEW_EXPENSES');
    const canCreate = hasPermission('CREATE_EXPENSES');
    const canManageCategories = hasPermission('MANAGE_EXPENSE_CATEGORIES');
    const canManageAll = hasPermission('MANAGE_ALL_EXPENSES');
    const canEditOwn = hasPermission('EDIT_EXPENSES');
    const canViewFinancials = hasPermission('VIEW_FINANCIAL_REPORTS');
    const canViewAllStores = hasPermission('VIEW_ALL_STORE_EXPENSES');

    const money = useCallback(
        (value: number | string | null | undefined) =>
            formatCurrency(Number(value) || 0, user?.currency, user?.locale),
        [user?.currency, user?.locale]
    );
    const compact = (formatted: string) => formatted.replace(/([.,]00)(?=\s|$)/, '');

    const canMutate = useCallback(
        (expense: Expense) =>
            canManageAll || (canEditOwn && expense.createdById === user?.id),
        [canManageAll, canEditOwn, user?.id]
    );

    // ------------------------------------------------------------ access gate

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }
        if (!canView) {
            toast.error('You do not have access to Expenses.');
            router.replace('/dashboard');
        }
    }, [isHydrated, token, canView, router]);

    // ------------------------------------------------------------ data loads

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(filters.search), 350);
        return () => clearTimeout(timer);
    }, [filters.search]);

    // Reset to the first page whenever the result set changes shape.
    useEffect(() => {
        setPage(0);
        setSelectedIds(new Set());
    }, [debouncedSearch, filters.categoryId, filters.createdById, filters.minAmount, filters.maxAmount, dateRange.from, dateRange.to, selectedStoreId]);

    const loadCategories = useCallback(async () => {
        try {
            setCategories(await api.expenseCategories.list(true));
        } catch (e) {
            console.error('Failed to load expense categories', e);
        }
    }, []);

    useEffect(() => {
        if (!isHydrated || !token || !canView) return;

        loadCategories();

        if (canViewAllStores) {
            api.stores.list().then(setStores).catch(console.error);
        } else if (user?.store) {
            setStores([{ id: user.store.id, name: user.store.name }]);
        }
    }, [isHydrated, token, canView, canViewAllStores, user?.store, loadCategories]);

    // Analytics: month-to-date, period summary and alerts.
    useEffect(() => {
        if (!isHydrated || !token || !canView) return;

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const storeId = selectedStoreId || undefined;

            const [mtdResult, summaryResult, alertsResult] = await Promise.allSettled([
                api.expenses.monthToDate(storeId),
                api.expenses.summary(dateRange.from, dateRange.to, storeId),
                api.expenses.alerts(storeId),
            ]);

            if (cancelled) return;

            if (mtdResult.status === 'fulfilled') setMtd(mtdResult.value);
            else console.error('Failed to load month-to-date expenses', mtdResult.reason);

            if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
            else console.error('Failed to load expense summary', summaryResult.reason);

            setAlerts(alertsResult.status === 'fulfilled' ? alertsResult.value : []);
            setLoading(false);
        };

        load();
        return () => { cancelled = true; };
    }, [isHydrated, token, canView, selectedStoreId, dateRange.from, dateRange.to, refreshNonce]);

    const listQuery: ExpenseListFilters = useMemo(() => ({
        from: dateRange.from,
        to: dateRange.to,
        storeId: selectedStoreId || undefined,
        search: debouncedSearch || undefined,
        categoryId: filters.categoryId || undefined,
        createdById: filters.createdById || undefined,
        minAmount: filters.minAmount || undefined,
        maxAmount: filters.maxAmount || undefined,
        sortBy: sort.by,
        sortDir: sort.dir,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
    }), [dateRange, selectedStoreId, debouncedSearch, filters, sort, page]);

    useEffect(() => {
        if (!isHydrated || !token || !canView) return;

        let cancelled = false;
        setListLoading(true);
        api.expenses.list(listQuery)
            .then(result => {
                if (cancelled) return;
                setList(result.data);
                setListTotal(result.total);
                setFilteredTotal(result.filteredTotal);
            })
            .catch(e => {
                if (!cancelled) console.error('Failed to load expenses', e);
            })
            .finally(() => { if (!cancelled) setListLoading(false); });

        return () => { cancelled = true; };
    }, [isHydrated, token, canView, listQuery, refreshNonce]);

    const refreshAll = () => setRefreshNonce(n => n + 1);

    // --------------------------------------------------------------- actions

    const handleDelete = async (expense: Expense) => {
        const confirmed = await confirmDialog({
            title: 'Delete this expense?',
            message: `${money(expense.amount)} — ${expense.description}. It will be removed from your totals and reports. The change is kept in the expense’s history.`,
            confirmLabel: 'Delete expense',
            destructive: true,
        });
        if (!confirmed) return;

        try {
            await api.expenses.delete(expense.id);
            toast.success('Expense deleted');
            refreshAll();
        } catch (e: any) {
            toast.error(e?.message || 'Could not delete the expense');
        }
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        const confirmed = await confirmDialog({
            title: `Delete ${ids.length} expense${ids.length === 1 ? '' : 's'}?`,
            message: 'They will be removed from your totals and reports. Each change is kept in that expense’s history.',
            confirmLabel: `Delete ${ids.length}`,
            destructive: true,
        });
        if (!confirmed) return;

        try {
            const result = await api.expenses.bulkDelete(ids);
            if (result.skipped.length > 0) {
                toast.success(
                    `Deleted ${result.deleted}. ${result.skipped.length} could not be deleted — you can only remove expenses you recorded.`,
                    { duration: 6000 }
                );
            } else {
                toast.success(`Deleted ${result.deleted} expense${result.deleted === 1 ? '' : 's'}`);
            }
            setSelectedIds(new Set());
            refreshAll();
        } catch (e: any) {
            toast.error(e?.message || 'Could not delete the selected expenses');
        }
    };

    const handleExport = async () => {
        try {
            const blob = await api.expenses.exportCsv({ ...listQuery, skip: undefined, take: undefined });
            const url = URL.createObjectURL(
                blob instanceof Blob ? blob : new Blob([String(blob)], { type: 'text/csv' })
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = `expenses-${dateRange.from}-to-${dateRange.to}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('Export downloaded');
        } catch (e: any) {
            toast.error(e?.message || 'Could not export the expenses');
        }
    };

    const handleImport = async (file: File | null) => {
        if (!file) return;

        if (!selectedStoreId && canViewAllStores) {
            toast.error('Choose a store in the sidebar before importing — expenses belong to one location.');
            if (importInputRef.current) importInputRef.current.value = '';
            return;
        }

        try {
            const result = await api.expenses.importCsv(file, selectedStoreId || undefined);
            toast.success(
                result.categoriesCreated.length > 0
                    ? `Imported ${result.imported} expenses and created ${result.categoriesCreated.length} new categor${result.categoriesCreated.length === 1 ? 'y' : 'ies'}.`
                    : `Imported ${result.imported} expenses.`,
                { duration: 6000 }
            );
            loadCategories();
            refreshAll();
        } catch (e: any) {
            toast.error(e?.message || 'Could not import the file', { duration: 8000 });
        } finally {
            if (importInputRef.current) importInputRef.current.value = '';
        }
    };

    const toggleSort = (field: string) => {
        setSort(prev =>
            prev.by === field
                ? { by: field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { by: field, dir: 'desc' }
        );
        setPage(0);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectableOnPage = list.filter(canMutate);
    const allOnPageSelected =
        selectableOnPage.length > 0 && selectableOnPage.every(e => selectedIds.has(e.id));

    const toggleSelectAll = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allOnPageSelected) selectableOnPage.forEach(e => next.delete(e.id));
            else selectableOnPage.forEach(e => next.add(e.id));
            return next;
        });
    };

    const activeFilterCount = [
        filters.search,
        filters.categoryId,
        filters.createdById,
        filters.minAmount,
        filters.maxAmount,
    ].filter(Boolean).length;

    const clearFilters = () =>
        setFilters({ search: '', categoryId: '', createdById: '', minAmount: '', maxAmount: '' });

    if (!isHydrated || !canView) return null;

    const storeLabel = selectedStoreId
        ? stores.find(s => s.id === selectedStoreId)?.name
        : canViewAllStores
            ? 'All locations'
            : user?.store?.name;

    const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));

    const TABS: { id: Tab; label: string; visible: boolean }[] = [
        { id: 'overview', label: 'Overview', visible: true },
        { id: 'list', label: 'All expenses', visible: true },
        { id: 'categories', label: 'Categories', visible: true },
        { id: 'reports', label: 'Financial report', visible: canViewFinancials },
    ];

    return (
        <div className="h-full bg-canvas overflow-y-auto font-sans">
            <div className="max-w-[1600px] mx-auto p-8 lg:p-12 animate-fade-in-up">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl lg:text-4xl font-semibold text-gray-900 tracking-tight leading-tight">
                            Expenses
                        </h1>
                        <span className="text-sm font-medium text-mid-grey tracking-wide">
                            {storeLabel
                                ? `Operating costs for ${storeLabel}`
                                : 'Operating costs across your organization'}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={refreshAll}
                            className="p-2.5 rounded-xl bg-white border border-gray-100 shadow-soft text-gray-400 hover:text-brand-600 transition-colors"
                            title="Refresh"
                            aria-label="Refresh"
                        >
                            <RefreshCw size={16} className={loading || listLoading ? 'animate-spin' : ''} />
                        </button>

                        <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
                            <Download size={15} />
                            Export
                        </button>

                        {canCreate && (
                            <>
                                <button
                                    onClick={() => importInputRef.current?.click()}
                                    className="btn-secondary flex items-center gap-2"
                                    title="Import expenses from a CSV file"
                                >
                                    <Upload size={15} />
                                    Import
                                </button>
                                <input
                                    ref={importInputRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    onChange={e => handleImport(e.target.files?.[0] || null)}
                                />

                                <button
                                    onClick={() => { setEditing(null); setShowForm(true); }}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    Record expense
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Month-to-date KPIs — never affected by the period picker below. */}
                <MonthToDateCards mtd={mtd} loading={loading && !mtd} money={money} compact={compact} canViewFinancials={canViewFinancials} />

                {/* Tabs */}
                <div className="border-b border-gray-100 mb-8">
                    <nav className="flex gap-1 -mb-px overflow-x-auto">
                        {TABS.filter(t => t.visible).map(item => (
                            <button
                                key={item.id}
                                onClick={() => setTab(item.id)}
                                className={`
                                    px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors
                                    ${tab === item.id
                                        ? 'border-brand-500 text-brand-700'
                                        : 'border-transparent text-mid-grey hover:text-charcoal'}
                                `}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Period picker — applies to everything except the MTD cards above. */}
                {tab !== 'categories' && (
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                        <DateRangePresets dateRange={dateRange} onSelect={setDateRange} />

                        <div className="flex items-center bg-white px-1 py-1 rounded-xl shadow-soft border border-gray-100 shrink-0">
                            <div className="flex items-center px-4 py-2 border-r border-gray-100">
                                <span className="text-xs font-semibold text-mid-grey mr-2 uppercase tracking-wide">From</span>
                                <input
                                    type="date"
                                    value={dateRange.from}
                                    onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                    className="text-sm font-semibold text-gray-700 bg-transparent border-none focus:ring-0 p-0"
                                    aria-label="Period start"
                                />
                            </div>
                            <div className="flex items-center px-4 py-2">
                                <span className="text-xs font-semibold text-gray-400 mr-2 uppercase tracking-wide">To</span>
                                <input
                                    type="date"
                                    value={dateRange.to}
                                    onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                    className="text-sm font-semibold text-gray-700 bg-transparent border-none focus:ring-0 p-0"
                                    aria-label="Period end"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ------------------------------------------------------ Overview */}
                {tab === 'overview' && (
                    <div className="space-y-8">
                        {alerts.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {alerts.map((alert, index) => (
                                    <div
                                        key={index}
                                        className={`
                                            flex items-start gap-3 p-4 rounded-xl border
                                            ${alert.severity === 'warning'
                                                ? 'bg-amber-50/60 border-amber-100'
                                                : 'bg-brand-50/50 border-brand-100'}
                                        `}
                                    >
                                        {alert.severity === 'warning'
                                            ? <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                                            : <Info size={17} className="text-brand-600 shrink-0 mt-0.5" />}
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                                            <p className="text-xs text-charcoal mt-0.5 leading-relaxed">{alert.detail}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            <div className="xl:col-span-2 bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
                                <div className="mb-8">
                                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-1">
                                        Spending over the period
                                    </h2>
                                    <p className="text-sm text-mid-grey font-medium">
                                        Running total across the selected dates
                                    </p>
                                </div>
                                <ExpenseTrendChart series={summary?.dailySeries || []} height={340} />
                            </div>

                            <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
                                <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-6">
                                    Where it went
                                </h2>
                                <CategoryDonut categories={summary?.categories || []} height={220} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
                                <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-6">
                                    Top categories
                                </h2>
                                {(summary?.topCategories?.length || 0) === 0 ? (
                                    <p className="text-sm text-mid-grey py-6">Nothing recorded for this period.</p>
                                ) : (
                                    <ol className="space-y-4">
                                        {summary!.topCategories.map((category, index) => (
                                            <li key={category.categoryId}>
                                                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                                                    <span className="text-sm text-charcoal truncate">
                                                        <span className="text-mid-grey mr-2 tabular-nums">{index + 1}</span>
                                                        {category.name}
                                                    </span>
                                                    <span className="text-sm font-semibold text-gray-900 shrink-0">
                                                        {money(category.amount)}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{
                                                            width: `${Math.max(2, category.percentage)}%`,
                                                            backgroundColor: category.color || '#235347',
                                                        }}
                                                    />
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>

                            <div className="xl:col-span-2 bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
                                <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-6">
                                    Recent expenses
                                </h2>
                                {list.length === 0 ? (
                                    <p className="text-sm text-mid-grey py-6">Nothing recorded for this period.</p>
                                ) : (
                                    <ul className="divide-y divide-gray-100">
                                        {list.slice(0, 6).map(expense => (
                                            <li key={expense.id}>
                                                <button
                                                    onClick={() => setViewing(expense)}
                                                    className="w-full flex items-center gap-4 py-3.5 text-left hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                                                >
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: expense.category?.color || '#A9B0B0' }}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold text-gray-900 truncate">
                                                            {expense.description}
                                                        </p>
                                                        <p className="text-xs text-mid-grey truncate mt-0.5">
                                                            {expense.category?.name} ·{' '}
                                                            {new Date(expense.expenseDate).toLocaleDateString(undefined, {
                                                                day: 'numeric', month: 'short',
                                                            })}
                                                        </p>
                                                    </div>
                                                    <span className="text-sm font-semibold text-gray-900 shrink-0">
                                                        {money(expense.amount)}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------------------------------------------------- All expenses */}
                {tab === 'list' && (
                    <div className="space-y-5">
                        {/* Filter bar */}
                        <div className="bg-white p-5 rounded-2xl shadow-card border border-gray-100/80">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                                <div className="relative xl:col-span-2">
                                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={filters.search}
                                        onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                                        placeholder="Search description, vendor or reference"
                                        className="input-field w-full pl-10"
                                        aria-label="Search expenses"
                                    />
                                </div>

                                <select
                                    value={filters.categoryId}
                                    onChange={e => setFilters(f => ({ ...f, categoryId: e.target.value }))}
                                    className="input-field w-full"
                                    aria-label="Filter by category"
                                >
                                    <option value="">All categories</option>
                                    {categories.filter(c => c.status === 'ACTIVE').map(category => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                    ))}
                                </select>

                                <input
                                    type="number"
                                    min="0"
                                    value={filters.minAmount}
                                    onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value }))}
                                    placeholder="Min amount"
                                    className="input-field w-full"
                                    aria-label="Minimum amount"
                                />
                                <input
                                    type="number"
                                    min="0"
                                    value={filters.maxAmount}
                                    onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value }))}
                                    placeholder="Max amount"
                                    className="input-field w-full"
                                    aria-label="Maximum amount"
                                />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
                                <p className="text-sm text-charcoal">
                                    <span className="font-semibold text-gray-900">{listTotal}</span>{' '}
                                    expense{listTotal === 1 ? '' : 's'} ·{' '}
                                    <span className="font-semibold text-gray-900">{money(filteredTotal)}</span> total
                                </p>

                                <div className="flex items-center gap-3">
                                    {activeFilterCount > 0 && (
                                        <button
                                            onClick={clearFilters}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
                                        >
                                            <X size={13} />
                                            Clear {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
                                        </button>
                                    )}

                                    {selectedIds.size > 0 && (
                                        <button
                                            onClick={handleBulkDelete}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                                        >
                                            <Trash2 size={13} />
                                            Delete {selectedIds.size} selected
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-2xl shadow-card border border-gray-100/80 overflow-hidden">
                            {listLoading && list.length === 0 ? (
                                <div className="p-8 space-y-4">
                                    {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
                                </div>
                            ) : list.length === 0 ? (
                                <div className="text-center py-20 px-8">
                                    <Wallet size={30} className="mx-auto text-gray-300 mb-4" />
                                    <p className="text-sm font-semibold text-gray-900 mb-1">No expenses found</p>
                                    <p className="text-sm text-mid-grey">
                                        {activeFilterCount > 0
                                            ? 'Try widening your filters or the date range.'
                                            : 'Nothing has been recorded for this period yet.'}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Desktop table */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-gray-100">
                                                    {(canManageAll || canEditOwn) && (
                                                        <th className="w-12 pl-6 py-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={allOnPageSelected}
                                                                onChange={toggleSelectAll}
                                                                disabled={selectableOnPage.length === 0}
                                                                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500/30"
                                                                aria-label="Select all on this page"
                                                            />
                                                        </th>
                                                    )}
                                                    <SortableHeader label="Date" field="expenseDate" sort={sort} onSort={toggleSort} />
                                                    <th className="text-left px-4 py-4 text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Category</th>
                                                    <SortableHeader label="Description" field="description" sort={sort} onSort={toggleSort} />
                                                    {!selectedStoreId && canViewAllStores && (
                                                        <th className="text-left px-4 py-4 text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Store</th>
                                                    )}
                                                    <th className="text-left px-4 py-4 text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Recorded by</th>
                                                    <SortableHeader label="Amount" field="amount" sort={sort} onSort={toggleSort} align="right" />
                                                    <th className="w-24 pr-6 py-4" />
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {list.map(expense => {
                                                    const mutable = canMutate(expense);
                                                    return (
                                                        <tr
                                                            key={expense.id}
                                                            className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                                                            onClick={() => setViewing(expense)}
                                                        >
                                                            {(canManageAll || canEditOwn) && (
                                                                <td className="pl-6 py-4" onClick={e => e.stopPropagation()}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedIds.has(expense.id)}
                                                                        onChange={() => toggleSelect(expense.id)}
                                                                        disabled={!mutable}
                                                                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500/30 disabled:opacity-30"
                                                                        aria-label={`Select ${expense.description}`}
                                                                    />
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-4 text-sm text-charcoal whitespace-nowrap">
                                                                {new Date(expense.expenseDate).toLocaleDateString(undefined, {
                                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                                })}
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                <span className="inline-flex items-center gap-2 min-w-0">
                                                                    <span
                                                                        className="w-2 h-2 rounded-full shrink-0"
                                                                        style={{ backgroundColor: expense.category?.color || '#A9B0B0' }}
                                                                    />
                                                                    <span className="text-sm text-charcoal truncate">
                                                                        {expense.category?.name || '—'}
                                                                    </span>
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-4 max-w-xs">
                                                                <span className="flex items-center gap-2">
                                                                    <span className="text-sm font-medium text-gray-900 truncate">
                                                                        {expense.description}
                                                                    </span>
                                                                    {expense.attachmentUrl && (
                                                                        <Paperclip size={13} className="text-mid-grey shrink-0" />
                                                                    )}
                                                                </span>
                                                                {expense.vendor && (
                                                                    <span className="block text-xs text-mid-grey truncate mt-0.5">
                                                                        {expense.vendor}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            {!selectedStoreId && canViewAllStores && (
                                                                <td className="px-4 py-4 text-sm text-charcoal truncate">
                                                                    {expense.store?.name || '—'}
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-4 text-sm text-charcoal truncate">
                                                                {expense.createdBy?.name || expense.createdBy?.email || '—'}
                                                            </td>
                                                            <td className="px-4 py-4 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                                                                {money(expense.amount)}
                                                            </td>
                                                            <td className="pr-6 py-4" onClick={e => e.stopPropagation()}>
                                                                {mutable && (
                                                                    <div className="flex items-center justify-end gap-0.5">
                                                                        <button
                                                                            onClick={() => { setEditing(expense); setShowForm(true); }}
                                                                            className="p-2 rounded-lg text-gray-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                                                                            aria-label={`Edit ${expense.description}`}
                                                                            title="Edit"
                                                                        >
                                                                            <Pencil size={15} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDelete(expense)}
                                                                            className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                                                            aria-label={`Delete ${expense.description}`}
                                                                            title="Delete"
                                                                        >
                                                                            <Trash2 size={15} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile cards */}
                                    <ul className="md:hidden divide-y divide-gray-100">
                                        {list.map(expense => (
                                            <li key={expense.id}>
                                                <button
                                                    onClick={() => setViewing(expense)}
                                                    className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between gap-3 mb-1">
                                                        <span className="text-sm font-semibold text-gray-900">
                                                            {expense.description}
                                                        </span>
                                                        <span className="text-sm font-semibold text-gray-900 shrink-0">
                                                            {money(expense.amount)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-mid-grey">
                                                        {expense.category?.name} ·{' '}
                                                        {new Date(expense.expenseDate).toLocaleDateString(undefined, {
                                                            day: 'numeric', month: 'short', year: 'numeric',
                                                        })}
                                                    </p>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                                            <p className="text-xs text-mid-grey">
                                                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, listTotal)} of {listTotal}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                                    disabled={page === 0}
                                                    className="p-2 rounded-lg text-gray-400 hover:bg-surface-muted hover:text-charcoal transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    aria-label="Previous page"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <span className="text-xs font-semibold text-charcoal tabular-nums px-2">
                                                    {page + 1} / {totalPages}
                                                </span>
                                                <button
                                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                                    disabled={page >= totalPages - 1}
                                                    className="p-2 rounded-lg text-gray-400 hover:bg-surface-muted hover:text-charcoal transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    aria-label="Next page"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ------------------------------------------------------ Categories */}
                {tab === 'categories' && (
                    <CategoryManager
                        categories={categories}
                        onChanged={() => { loadCategories(); refreshAll(); }}
                        canManage={canManageCategories}
                    />
                )}

                {/* --------------------------------------------------------- Reports */}
                {tab === 'reports' && canViewFinancials && (
                    <FinancialReport summary={summary} money={money} loading={loading} />
                )}
            </div>

            {showForm && (
                <ExpenseFormModal
                    expense={editing}
                    categories={categories}
                    stores={stores}
                    activeStoreId={selectedStoreId}
                    onClose={() => { setShowForm(false); setEditing(null); }}
                    onSaved={refreshAll}
                    onCategoryCreated={() => loadCategories()}
                />
            )}

            {viewing && (
                <ExpenseDetailModal
                    expense={viewing}
                    canEdit={canMutate(viewing)}
                    onEdit={() => { setEditing(viewing); setViewing(null); setShowForm(true); }}
                    onClose={() => setViewing(null)}
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------- components

function SortableHeader({
    label, field, sort, onSort, align = 'left',
}: {
    label: string;
    field: string;
    sort: { by: string; dir: 'asc' | 'desc' };
    onSort: (field: string) => void;
    align?: 'left' | 'right';
}) {
    const isActive = sort.by === field;
    return (
        <th className={`px-4 py-4 ${align === 'right' ? 'text-right' : 'text-left'}`}>
            <button
                onClick={() => onSort(field)}
                className={`
                    inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest transition-colors
                    ${isActive ? 'text-brand-700' : 'text-mid-grey hover:text-charcoal'}
                `}
            >
                {label}
                <ArrowUpDown size={11} className={isActive ? 'opacity-100' : 'opacity-40'} />
            </button>
        </th>
    );
}

function MonthToDateCards({
    mtd, loading, money, compact, canViewFinancials,
}: {
    mtd: ExpenseMonthToDate | null;
    loading: boolean;
    money: (v: number | string | null | undefined) => string;
    compact: (s: string) => string;
    canViewFinancials: boolean;
}) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl p-6 shadow-card border border-gray-100/80">
                        <div className="skeleton h-3 w-28 mb-5" />
                        <div className="skeleton h-8 w-32 mb-2" />
                        <div className="skeleton h-3 w-24" />
                    </div>
                ))}
            </div>
        );
    }

    if (!mtd) return null;

    const netProfit = mtd.netProfit.total;

    return (
        <div className="mb-10">
            <div className="flex items-baseline gap-2 mb-4">
                <h2 className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest">
                    Month to date
                </h2>
                <span className="text-[11px] text-mid-grey">· {mtd.monthLabel} · not affected by the period below</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard
                    title="Month-to-Date Expenses"
                    value={compact(money(mtd.expenses.total))}
                    icon={<Wallet size={20} className="text-brand-600" />}
                    bgColor="bg-brand-50"
                    // Rising expenses are unwelcome, so the arrow colour is inverted here.
                    trend={mtd.expenses.change !== null
                        ? { value: mtd.expenses.change, label: 'vs last month', invert: true }
                        : undefined}
                    subtext={mtd.expenses.change === null ? 'No spend the same days last month' : undefined}
                />

                {canViewFinancials ? (
                    <>
                        <KpiCard
                            title="Month-to-Date Net Profit"
                            value={compact(money(netProfit))}
                            icon={netProfit >= 0
                                ? <TrendingUp size={20} className="text-brand-600" />
                                : <TrendingDown size={20} className="text-red-500" />}
                            bgColor={netProfit >= 0 ? 'bg-brand-50' : 'bg-red-50'}
                            subtext="Gross profit less expenses"
                            negative={netProfit < 0}
                        />
                        <KpiCard
                            title="Expense to Sales"
                            value={mtd.expenseToSalesRatio !== null ? `${mtd.expenseToSalesRatio.toFixed(1)}%` : '—'}
                            icon={<Percent size={20} className="text-charcoal" />}
                            bgColor="bg-surface-muted"
                            subtext={mtd.expenseToSalesRatio !== null ? 'Of month-to-date sales' : 'No sales this month'}
                        />
                    </>
                ) : (
                    <KpiCard
                        title="Largest This Month"
                        value={compact(money(mtd.expenses.largest))}
                        icon={<TrendingUp size={20} className="text-charcoal" />}
                        bgColor="bg-surface-muted"
                        subtext="Single biggest entry"
                    />
                )}

                <KpiCard
                    title="Average Daily Spend"
                    value={compact(money(mtd.expenses.averageDaily))}
                    icon={<CalendarDays size={20} className="text-charcoal" />}
                    bgColor="bg-surface-muted"
                    subtext={`${mtd.expenses.count} expense${mtd.expenses.count === 1 ? '' : 's'} so far`}
                />
            </div>
        </div>
    );
}

function KpiCard({
    title, value, icon, bgColor, subtext, trend, negative,
}: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    bgColor: string;
    subtext?: string;
    trend?: { value: number; label: string; invert?: boolean };
    negative?: boolean;
}) {
    // `invert` flips the good/bad colouring: for expenses, up is bad.
    const isGood = trend ? (trend.invert ? trend.value < 0 : trend.value >= 0) : true;

    return (
        <div className="bg-white rounded-2xl p-6 shadow-card border border-gray-100/80 transition-all duration-300 hover:shadow-lifted">
            <div className="flex items-start justify-between gap-3 mb-5">
                <p className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest pt-1.5">{title}</p>
                <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}>
                    {icon}
                </div>
            </div>
            <div className="min-w-0">
                <div className={`text-xl xl:text-2xl 2xl:text-3xl font-semibold tracking-tight mb-1 ${negative ? 'text-red-600' : 'text-gray-900'}`}>
                    <FitText>{value}</FitText>
                </div>
                {trend ? (
                    <p className="text-xs font-medium flex items-center gap-1.5 truncate">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold ${isGood ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value).toFixed(1)}%
                        </span>
                        <span className="text-mid-grey">{trend.label}</span>
                    </p>
                ) : subtext ? (
                    <p className="text-xs font-medium text-mid-grey truncate">{subtext}</p>
                ) : null}
            </div>
        </div>
    );
}

function FinancialReport({
    summary, money, loading,
}: {
    summary: ExpenseSummary | null;
    money: (v: number | string | null | undefined) => string;
    loading: boolean;
}) {
    if (loading && !summary) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl p-6 shadow-card border border-gray-100/80">
                        <div className="skeleton h-3 w-24 mb-4" />
                        <div className="skeleton h-8 w-32" />
                    </div>
                ))}
            </div>
        );
    }

    const financials = summary?.financials;
    if (!financials) {
        return (
            <div className="bg-white rounded-2xl shadow-card border border-gray-100/80 p-12 text-center">
                <p className="text-sm text-mid-grey">
                    Financial figures are not available for your account.
                </p>
            </div>
        );
    }

    const change = (before: number, after: number) =>
        before === 0 ? null : ((after - before) / Math.abs(before)) * 100;

    const rows = [
        { label: 'Total sales', value: financials.totalSales, previous: financials.previous.totalSales },
        { label: 'Gross profit', value: financials.grossProfit, previous: financials.previous.grossProfit },
        { label: 'Total expenses', value: financials.totalExpenses, previous: financials.previous.totalExpenses, invert: true },
        { label: 'Net profit', value: financials.netProfit, previous: financials.previous.netProfit, emphasis: true },
    ];

    return (
        <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-card border border-gray-100/80 p-8">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-1">
                        Financial summary
                    </h2>
                    <p className="text-sm text-mid-grey font-medium">
                        {new Date(summary!.periodStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' – '}
                        {new Date(summary!.periodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · compared with the preceding period of equal length'}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left py-3 text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Measure</th>
                                <th className="text-right py-3 text-[11px] font-semibold text-mid-grey uppercase tracking-widest">This period</th>
                                <th className="text-right py-3 text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Previous</th>
                                <th className="text-right py-3 text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Difference</th>
                                <th className="text-right py-3 text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Change</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map(row => {
                                const delta = row.value - row.previous;
                                const percent = change(row.previous, row.value);
                                const isGood = row.invert ? delta <= 0 : delta >= 0;

                                return (
                                    <tr key={row.label}>
                                        <td className={`py-4 text-sm ${row.emphasis ? 'font-semibold text-gray-900' : 'text-charcoal'}`}>
                                            {row.label}
                                        </td>
                                        <td className={`py-4 text-right text-sm tabular-nums ${row.emphasis ? 'font-semibold' : 'font-medium'} ${row.emphasis && row.value < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                            {money(row.value)}
                                        </td>
                                        <td className="py-4 text-right text-sm text-mid-grey tabular-nums">
                                            {money(row.previous)}
                                        </td>
                                        <td className="py-4 text-right text-sm text-charcoal tabular-nums">
                                            {delta >= 0 ? '+' : '−'}{money(Math.abs(delta))}
                                        </td>
                                        <td className="py-4 text-right">
                                            {percent === null ? (
                                                <span className="text-xs text-mid-grey">—</span>
                                            ) : (
                                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-semibold ${isGood ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                                    {percent >= 0 ? '▲' : '▼'} {Math.abs(percent).toFixed(1)}%
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-6 border-t border-gray-100">
                    <div className="p-4 rounded-xl bg-surface-muted/60">
                        <p className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest mb-1.5">
                            Expense to sales ratio
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                            {financials.expenseToSalesRatio !== null
                                ? `${financials.expenseToSalesRatio.toFixed(1)}%`
                                : 'No sales in this period'}
                        </p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-muted/60">
                        <p className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest mb-1.5">
                            Net margin
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                            {financials.netMargin !== null
                                ? `${financials.netMargin.toFixed(1)}%`
                                : 'No sales in this period'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-card border border-gray-100/80 p-8">
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-6">
                    Expense breakdown by category
                </h2>
                <CategoryDonut categories={summary?.categories || []} height={260} />
            </div>
        </div>
    );
}
