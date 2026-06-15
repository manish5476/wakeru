import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../config/logger';
import NodeCache from 'node-cache';

export class ExchangeRateAPI {
  private static cache = new NodeCache({ stdTTL: 3600 });
  private static baseUrl = config.EXCHANGE_RATE_API_URL;

  static async getRates(baseCurrency: string): Promise<any> {
    const cacheKey = `rates:${baseCurrency}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseUrl}/latest/${baseCurrency}`, {
        headers: {
          'Authorization': `Bearer ${config.EXCHANGE_RATE_API_KEY}`
        }
      });

      this.cache.set(cacheKey, response.data.rates);
      return response.data.rates;
    } catch (error) {
      logger.error('Failed to fetch exchange rates:', error);
      throw error;
    }
  }

  static async convert(amount: number, from: string, to: string): Promise<number> {
    const rates = await this.getRates(from);
    const rate = rates[to];
    
    if (!rate) {
      throw new Error(`Rate not found for ${from} to ${to}`);
    }

    return Math.round(amount * rate * 100) / 100;
  }
}