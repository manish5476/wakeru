import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../config/logger';
import NodeCache from 'node-cache';

export class CurrencyUtils {
  private static cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache
  private static rates: Map<string, number> = new Map();
  
  /**
   * Get exchange rate between two currencies
   */
  static async getExchangeRate(from: string, to: string): Promise<number> {
    const cacheKey = `${from}-${to}`;
    
    // Check cache first
    const cached = this.cache.get<number>(cacheKey);
    if (cached) return cached;
    
    try {
      // If both currencies are same
      if (from === to) return 1;
      
      // Fetch from API
      const response = await axios.get(`${config.EXCHANGE_RATE_API_URL}/latest/${from}`, {
        headers: {
          'Authorization': `Bearer ${config.EXCHANGE_RATE_API_KEY}`
        }
      });
      
      const rate = response.data.rates[to];
      
      if (!rate) {
        throw new Error(`Exchange rate not found for ${from} to ${to}`);
      }
      
      // Cache the rate
      this.cache.set(cacheKey, rate);
      
      return rate;
    } catch (error) {
      logger.error('Failed to fetch exchange rate:', error);
      throw new Error(`Failed to get exchange rate from ${from} to ${to}`);
    }
  }

  /**
   * Convert amount from one currency to another
   */
  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    const converted = amount * rate;
    return Math.round(converted * 100) / 100;
  }

  /**
   * Get currency symbol
   */
  static getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
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
  static formatCurrency(amount: number, currency: string): string {
    const symbol = this.getCurrencySymbol(currency);
    return `${symbol}${amount.toFixed(2)}`;
  }

  /**
   * Bulk convert multiple amounts
   */
  static async bulkConvert(
    amounts: Array<{ amount: number; from: string; to: string }>
  ): Promise<number[]> {
    const conversions = amounts.map(async (item) => {
      return await this.convertCurrency(item.amount, item.from, item.to);
    });
    
    return Promise.all(conversions);
  }

  /**
   * Get all available currencies
   */
  static getAvailableCurrencies(): Array<{ code: string; symbol: string; name: string }> {
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
  static isValidCurrency(currency: string): boolean {
    const validCurrencies = this.getAvailableCurrencies().map(c => c.code);
    return validCurrencies.includes(currency);
  }
}