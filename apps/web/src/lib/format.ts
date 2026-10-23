export const formatCurrency = (amount: number | string | undefined | null, currency = 'USD', locale = 'en-US') => {
    const validAmount = Number(amount) || 0;
    // Force en-NG locale for NGN to ensure ₦ symbol is shown instead of NGN code
    const formatLocale = currency === 'NGN' ? 'en-NG' : locale;
    return new Intl.NumberFormat(formatLocale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(validAmount);
};

// The one receipt number shown everywhere a sale is identified — printed
// receipt, Sale Complete box, customer page, sales history. First 8 characters
// of the sale ID: Sales search matches it (case-insensitive, "#" optional) and
// it matches the "Sale #…" notes on stock movements and refunds.
export const receiptNumber = (id: string | undefined | null) =>
    id ? `#${id.slice(0, 8).toUpperCase()}` : '';
