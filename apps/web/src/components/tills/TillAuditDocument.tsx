"use client";

import { formatCurrency } from '@/lib/format';

// The A4 document behind the Till Activity Dashboard's "Audit PDF" button. html2pdf renders a
// clone of #till-audit-root, so it is styled inline with plain colours (no Tailwind classes)
// and kept out of sight in the page by a zero-height wrapper rather than display:none, which
// the clone would inherit.

export interface TillAuditData {
    businessName: string;
    scopeLabel: string;   // store name, or "All stores"
    tillLabel: string;    // till name, or "All tills"
    periodLabel: string;
    generatedAt: Date;
    generatedBy: string;
    currency?: string;
    locale?: string;
    overview: any;        // GET /till-reports/dashboard
    exceptions: any;      // GET /till-reports/exceptions
    inventory: any[];     // GET /till-reports/inventory
}

// html2pdf captures the element at the width of the page's printable area (A4 minus margins),
// so the document must be laid out at exactly that width or the right-hand side is cut off.
export const AUDIT_PDF_MARGIN_MM: [number, number, number, number] = [8, 8, 10, 8]; // top, right, bottom, left
const AUDIT_WIDTH_PX = Math.floor((210 - AUDIT_PDF_MARGIN_MM[1] - AUDIT_PDF_MARGIN_MM[3]) * 96 / 25.4);

const C = { ink: '#111827', muted: '#6B7280', line: '#E5E7EB', head: '#F3F4F6', brand: '#235347', red: '#B91C1C', green: '#15803D' };

const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', background: C.head, borderBottom: `1px solid ${C.line}`, fontSize: 10, color: C.muted, fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 8px', borderBottom: `1px solid ${C.line}`, fontSize: 10.5, color: C.ink, verticalAlign: 'top' };
const num: React.CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 700, color: C.brand, marginBottom: 8, paddingBottom: 7, borderBottom: `2px solid ${C.brand}` }}>{title}</div>
            {children}
        </div>
    );
}

export function TillAuditDocument({ data }: { data: TillAuditData }) {
    const money = (v: number | null | undefined) => (v === null || v === undefined ? '—' : formatCurrency(v, data.currency, data.locale));
    // Compact so date columns fit on one line: "21 Oct 2026, 4:01 PM".
    const dt = (v: string | null | undefined) => (v
        ? new Date(v).toLocaleString(data.locale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '—');
    const { sales } = data.overview;
    const sessions: any[] = data.overview.overview.sessions;
    const payments: any[] = data.overview.payments;
    const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    const closed = sessions.filter(s => s.variance !== null);
    const netVariance = closed.reduce((sum, s) => sum + s.variance, 0);
    const exceptionRows = [
        ...data.exceptions.refunds.map((r: any) => ({ at: r.createdAt, type: 'REFUND', staff: r.user?.name || '—', detail: r.reason || '', amount: -Number(r.total) })),
        ...data.exceptions.voids.map((v: any) => ({ at: v.createdAt, type: 'VOID', staff: v.user?.name || '—', detail: '', amount: null })),
        ...data.exceptions.cashEvents.map((c: any) => ({ at: c.createdAt, type: c.type, staff: '—', detail: c.reason || c.description || '', amount: Number(c.amount) })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return (
        <div id="till-audit-root" style={{ width: AUDIT_WIDTH_PX, boxSizing: 'border-box', padding: '24px 22px', background: '#FFFFFF', color: C.ink, fontFamily: 'Inter, Arial, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${C.line}`, paddingBottom: 14 }}>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>Till Activity Audit</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{data.businessName}</div>
                    <div style={{ fontSize: 10, color: C.red, marginTop: 6, fontWeight: 600 }}>STRICTLY CONFIDENTIAL — AUTHORISED PERSONNEL ONLY</div>
                </div>
                <table style={{ fontSize: 10.5, borderCollapse: 'collapse' }}>
                    <tbody>
                        {[['Period', data.periodLabel], ['Store', data.scopeLabel], ['Till', data.tillLabel], ['Generated', dt(data.generatedAt.toISOString())], ['By', data.generatedBy]].map(([k, v]) => (
                            <tr key={k}><td style={{ color: C.muted, paddingRight: 10, paddingBottom: 2 }}>{k}</td><td style={{ fontWeight: 600, paddingBottom: 2 }}>{v}</td></tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Section title="1. Sales Summary">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        {[
                            ['Gross sales', sales.grossSales, `${sales.transactionCount} transactions`],
                            ['Less discounts', -sales.totalDiscount, ''],
                            ['Plus tax', sales.totalTax, ''],
                            ['Less refunds', -sales.refundTotal, `${sales.refundCount} refunds`],
                        ].map(([label, value, note]) => (
                            <tr key={label as string}>
                                <td style={td}>{label}</td>
                                <td style={{ ...td, color: C.muted }}>{note}</td>
                                <td style={{ ...td, ...num }}>{money(value as number)}</td>
                            </tr>
                        ))}
                        <tr>
                            <td style={{ ...td, fontWeight: 700 }}>Net collected</td>
                            <td style={{ ...td, color: C.muted }}>{data.overview.overview.sessionCount} sessions ({data.overview.overview.openSessions} still open)</td>
                            <td style={{ ...td, ...num, fontWeight: 700 }}>{money(sales.totalCollected)}</td>
                        </tr>
                    </tbody>
                </table>
            </Section>

            <Section title="2. Payment Methods">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Method</th><th style={{ ...th, ...num }}>Transactions</th><th style={{ ...th, ...num }}>Amount</th></tr></thead>
                    <tbody>
                        {payments.map(p => (
                            <tr key={p.method}><td style={td}>{p.method}</td><td style={{ ...td, ...num }}>{p.count}</td><td style={{ ...td, ...num }}>{money(p.amount)}</td></tr>
                        ))}
                        {payments.length === 0 && <tr><td style={{ ...td, color: C.muted }} colSpan={3}>No payments recorded</td></tr>}
                        <tr><td style={{ ...td, fontWeight: 700 }} colSpan={2}>Total (before refunds)</td><td style={{ ...td, ...num, fontWeight: 700 }}>{money(paymentsTotal)}</td></tr>
                    </tbody>
                </table>
            </Section>

            <Section title="3. Cash Reconciliation">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={th}>Till / Staff</th><th style={th}>Opened</th><th style={th}>Closed</th>
                            <th style={{ ...th, ...num }}>Float</th><th style={{ ...th, ...num }}>Expected</th><th style={{ ...th, ...num }}>Counted</th><th style={{ ...th, ...num }}>Variance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map(s => (
                            <tr key={s.id}>
                                <td style={td}><div style={{ fontWeight: 600 }}>{s.tillName}</div><div style={{ color: C.muted }}>{[s.storeName, s.staffName].filter(Boolean).join(' · ')}</div></td>
                                <td style={td}>{dt(s.openedAt)}</td>
                                <td style={td}>{s.status === 'OPEN' ? 'Still open' : dt(s.closedAt)}</td>
                                <td style={{ ...td, ...num }}>{money(s.openingFloat)}</td>
                                <td style={{ ...td, ...num }}>{money(s.expectedCash)}</td>
                                <td style={{ ...td, ...num }}>{money(s.closingCash)}</td>
                                <td style={{ ...td, ...num, fontWeight: 600, color: s.variance < 0 ? C.red : s.variance > 0 ? C.green : C.ink }}>{money(s.variance)}</td>
                            </tr>
                        ))}
                        {sessions.length === 0 && <tr><td style={{ ...td, color: C.muted }} colSpan={7}>No till sessions in this period</td></tr>}
                        <tr><td style={{ ...td, fontWeight: 700 }} colSpan={6}>Net variance ({closed.length} closed sessions)</td><td style={{ ...td, ...num, fontWeight: 700, color: netVariance < 0 ? C.red : netVariance > 0 ? C.green : C.ink }}>{money(netVariance)}</td></tr>
                    </tbody>
                </table>
            </Section>

            <Section title="4. Exceptions & Audit Log">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Date & time</th><th style={th}>Type</th><th style={th}>Staff</th><th style={th}>Reason</th><th style={{ ...th, ...num }}>Amount</th></tr></thead>
                    <tbody>
                        {exceptionRows.map((e, i) => (
                            <tr key={i}>
                                <td style={td}>{dt(e.at)}</td>
                                <td style={{ ...td, fontWeight: 600, color: e.type === 'REFUND' ? C.red : C.ink }}>{e.type}</td>
                                <td style={td}>{e.staff}</td>
                                <td style={td}>{e.detail}</td>
                                <td style={{ ...td, ...num }}>{money(e.amount)}</td>
                            </tr>
                        ))}
                        {exceptionRows.length === 0 && <tr><td style={{ ...td, color: C.muted }} colSpan={5}>No exceptions recorded for this period</td></tr>}
                    </tbody>
                </table>
            </Section>

            <Section title="5. Inventory Impact">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Product</th><th style={th}>SKU</th><th style={{ ...th, ...num }}>Quantity sold</th></tr></thead>
                    <tbody>
                        {data.inventory.map((i: any) => (
                            <tr key={i.productId}><td style={td}>{i.name}</td><td style={{ ...td, color: C.muted }}>{i.sku}</td><td style={{ ...td, ...num }}>{i.quantitySold}</td></tr>
                        ))}
                        {data.inventory.length === 0 && <tr><td style={{ ...td, color: C.muted }} colSpan={3}>No inventory movement recorded</td></tr>}
                    </tbody>
                </table>
            </Section>

            {/* Sign-off */}
            <div style={{ display: 'flex', gap: 40, marginTop: 40 }}>
                {['Prepared by', 'Reviewed by'].map(label => (
                    <div key={label} style={{ flex: 1 }}>
                        <div style={{ borderBottom: `1px solid ${C.ink}`, height: 28 }} />
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{label} — name, signature & date</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
