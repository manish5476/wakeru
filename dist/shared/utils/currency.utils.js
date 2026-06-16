"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrencyUtils = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../config");
const logger_1 = require("../../config/logger");
const node_cache_1 = __importDefault(require("node-cache"));
class CurrencyUtils {
    /**
     * Get exchange rate between two currencies
     */
    static async getExchangeRate(from, to) {
        const cacheKey = `${from}-${to}`;
        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        try {
            // If both currencies are same
            if (from === to)
                return 1;
            // Fetch from API
            const response = await axios_1.default.get(`${config_1.config.EXCHANGE_RATE_API_URL}/latest/${from}`, {
                headers: {
                    'Authorization': `Bearer ${config_1.config.EXCHANGE_RATE_API_KEY}`
                }
            });
            const rate = response.data.rates[to];
            if (!rate) {
                throw new Error(`Exchange rate not found for ${from} to ${to}`);
            }
            // Cache the rate
            this.cache.set(cacheKey, rate);
            return rate;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch exchange rate:', error);
            throw new Error(`Failed to get exchange rate from ${from} to ${to}`);
        }
    }
    /**
     * Convert amount from one currency to another
     */
    static async convertCurrency(amount, fromCurrency, toCurrency) {
        const rate = await this.getExchangeRate(fromCurrency, toCurrency);
        const converted = amount * rate;
        return Math.round(converted * 100) / 100;
    }
    /**
     * Get currency symbol
     */
    static getCurrencySymbol(currency) {
        const symbols = {
            INR: '₹',
            USD: '$',
            EUR: '€',
            GBP: '£',
            JPY: '¥',
            AUD: 'A$',
            CAD: 'C$',
            SGD: 'S$',
            AED: 'د.إ',
            SAR: '﷼',
        };
        return symbols[currency] || currency;
    }
    /**
     * Format currency for display
     */
    static formatCurrency(amount, currency) {
        const symbol = this.getCurrencySymbol(currency);
        return `${symbol}${amount.toFixed(2)}`;
    }
    /**
     * Bulk convert multiple amounts
     */
    static async bulkConvert(amounts) {
        const conversions = amounts.map(async (item) => {
            return await this.convertCurrency(item.amount, item.from, item.to);
        });
        return Promise.all(conversions);
    }
    /**
     * Get all available currencies
     */
    static getAvailableCurrencies() {
        return [
            { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
            { code: 'USD', symbol: '$', name: 'US Dollar' },
            { code: 'EUR', symbol: '€', name: 'Euro' },
            { code: 'GBP', symbol: '£', name: 'British Pound' },
            { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
            { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
            { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
            { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
            { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
            { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
        ];
    }
    /**
     * Validate currency code
     */
    static isValidCurrency(currency) {
        const validCurrencies = this.getAvailableCurrencies().map(c => c.code);
        return validCurrencies.includes(currency);
    }
}
exports.CurrencyUtils = CurrencyUtils;
CurrencyUtils.cache = new node_cache_1.default({ stdTTL: 3600 }); // 1 hour cache
CurrencyUtils.rates = new Map();
//# sourceMappingURL=currency.utils.js.map