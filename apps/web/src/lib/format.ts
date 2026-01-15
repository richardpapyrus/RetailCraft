export const formatCurrency = (amount: number | string | undefined | null, currency = 'USD', locale = 'en-US') => {
    const validAmount = Number(amount) || 0;
    // Force en-NG locale for NGN to ensure ₦ symbol is shown instead of NGN code
    const formatLocale = currency === 'NGN' ? 'en-NG' : locale;
    return new Intl.NumberFormat(formatLocale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(validAmount);
};
