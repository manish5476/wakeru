"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeRateAPI = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../config");
const logger_1 = require("../../config/logger");
const node_cache_1 = __importDefault(require("node-cache"));
class ExchangeRateAPI {
    static async getRates(baseCurrency) {
        const cacheKey = `rates:${baseCurrency}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/latest/${baseCurrency}`, {
                headers: {
                    'Authorization': `Bearer ${config_1.config.EXCHANGE_RATE_API_KEY}`
                }
            });
            this.cache.set(cacheKey, response.data.rates);
            return response.data.rates;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch exchange rates:', error);
            throw error;
        }
    }
    static async convert(amount, from, to) {
        const rates = await this.getRates(from);
        const rate = rates[to];
        if (!rate) {
            throw new Error(`Rate not found for ${from} to ${to}`);
        }
        return Math.round(amount * rate * 100) / 100;
    }
}
exports.ExchangeRateAPI = ExchangeRateAPI;
ExchangeRateAPI.cache = new node_cache_1.default({ stdTTL: 3600 });
ExchangeRateAPI.baseUrl = config_1.config.EXCHANGE_RATE_API_URL;
//# sourceMappingURL=exchangeRate.api.js.map