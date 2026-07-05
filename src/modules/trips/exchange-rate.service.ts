import { Schema, model, Document } from 'mongoose';
import { User } from '../auth/auth.model';
import { Trip } from './trip.model';
import { Stop } from './stop.model';
import { notificationService } from '../notification/notification.service';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { logger } from '../../config/logger';

// ============================================================
// MODEL
// ============================================================

export interface IRateAlert extends Document {
    userId: string;
    tripId: Schema.Types.ObjectId;
    stopId: Schema.Types.ObjectId;
    fromCurrency: string;
    toCurrency: string;
    targetRate: number;
    direction: 'above' | 'below';
    isActive: boolean;
    lastTriggeredAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const rateAlertSchema = new Schema<IRateAlert>(
    {
        userId: { type: String, required: true, index: true },
        tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
        stopId: { type: Schema.Types.ObjectId, ref: 'Stop', required: true },
        fromCurrency: { type: String, required: true, uppercase: true },
        toCurrency: { type: String, required: true, uppercase: true },
        targetRate: { type: Number, required: true, min: 0.000001 },
        direction: { type: String, enum: ['above', 'below'], required: true },
        isActive: { type: Boolean, default: true },
        lastTriggeredAt: { type: Date },
    },
    { timestamps: true, versionKey: false }
);

rateAlertSchema.index({ userId: 1, isActive: 1 });

export const RateAlert = model<IRateAlert>('RateAlert', rateAlertSchema);

// ============================================================
// SERVICE
// ============================================================

// Free exchange rate API (you can replace with paid API for production)
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest';

// Cache rates for 1 hour
const rateCache: Map<string, { rate: number; timestamp: number }> = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const exchangeRateService = {
    /**
     * Get current exchange rate for a currency pair.
     */
    async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
        if (fromCurrency === toCurrency) return 1;

        const cacheKey = `${fromCurrency}:${toCurrency}`;
        const cached = rateCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.rate;
        }

        try {
            const response = await fetch(`${EXCHANGE_RATE_API}/${fromCurrency}`);
            const data = await response.json() as any;
            const rate = data.rates?.[toCurrency];

            if (!rate) {
                throw new Error(`Rate not found for ${fromCurrency} → ${toCurrency}`);
            }

            rateCache.set(cacheKey, { rate, timestamp: Date.now() });
            return rate;
        } catch (error) {
            logger.error('Failed to fetch exchange rate:', error);
            // Return fallback or throw
            throw error;
        }
    },

    /**
     * Create a rate alert.
     */
    async createAlert(
        userId: string,
        tripId: string,
        stopId: string,
        targetRate: number,
        direction: 'above' | 'below'
    ): Promise<IRateAlert> {
        const stop = await Stop.findById(stopId);
        if (!stop) throw new Error('Stop not found');

        const trip = await Trip.findById(tripId);
        if (!trip) throw new Error('Trip not found');

        const alert = new RateAlert({
            userId,
            tripId,
            stopId,
            fromCurrency: stop.currency,
            toCurrency: trip.baseCurrency,
            targetRate,
            direction,
            isActive: true,
        });

        await alert.save();

        logger.info(`Rate alert created: ${stop.currency}/${trip.baseCurrency} ${direction} ${targetRate}`);
        return alert;
    },

    /**
     * Check all active alerts and notify if triggered.
     */
    async checkAlerts(): Promise<void> {
        const alerts = await RateAlert.find({ isActive: true }).lean();

        if (alerts.length === 0) return;

        logger.info(`Checking ${alerts.length} rate alerts...`);

        for (const alert of alerts) {
            try {
                const currentRate = await this.getExchangeRate(alert.fromCurrency, alert.toCurrency);

                const triggered = alert.direction === 'above'
                    ? currentRate >= alert.targetRate
                    : currentRate <= alert.targetRate;

                if (triggered) {
                    await this._triggerAlert(alert, currentRate);
                }
            } catch (error) {
                logger.error(`Alert check failed for ${alert._id}:`, error);
            }
        }
    },

    /**
     * Get alerts for a user.
     */
    async getUserAlerts(userId: string): Promise<IRateAlert[]> {
        return RateAlert.find({ userId, isActive: true })
            .populate('tripId', 'title')
            .populate('stopId', 'name currency')
            .lean() as unknown as Promise<IRateAlert[]>;
    },

    /**
     * Deactivate an alert.
     */
    async deactivateAlert(alertId: string, userId: string): Promise<void> {
        await RateAlert.findOneAndUpdate(
            { _id: alertId, userId },
            { $set: { isActive: false } }
        );
    },

    /**
     * Trigger notification when alert condition is met.
     */
    async _triggerAlert(alert: any, currentRate: number): Promise<void> {
        const trip = await Trip.findById(alert.tripId).select('title').lean();
        const direction = alert.direction === 'above' ? '📈 above' : '📉 below';

        await notificationService.create(
            alert.userId,
            'RATE_ALERT',
            'Exchange Rate Alert! 💱',
            `${alert.fromCurrency}/${alert.toCurrency} is now ${currentRate.toFixed(4)} (${direction} your target of ${alert.targetRate})`,
            {
                data: {
                    alertId: alert._id,
                    tripId: alert.tripId,
                    currentRate,
                    targetRate: alert.targetRate,
                    tripName: trip?.title,
                },
                priority: 'high',
            }
        );

        socketServer.sendToUser(alert.userId, 'rate:alert_triggered', {
            type: 'RATE_ALERT_TRIGGERED',
            alertId: alert._id,
            tripId: alert.tripId,
            currentRate,
            targetRate: alert.targetRate,
            direction: alert.direction,
            timestamp: new Date().toISOString(),
        });

        // Update last triggered time
        await RateAlert.findByIdAndUpdate(alert._id, {
            $set: { lastTriggeredAt: new Date() },
        });

        logger.info(`Rate alert triggered: ${alert.fromCurrency}/${alert.toCurrency} = ${currentRate}`);
    },

    /**
     * Get supported currencies.
     */
    getSupportedCurrencies(): string[] {
        return [
            'INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY',
            'SGD', 'AED', 'SAR', 'THB', 'MYR', 'IDR', 'VND', 'PHP', 'NPR',
            'LKR', 'BDT', 'PKR', 'MVR', 'KRW', 'BRL', 'MXN', 'ZAR', 'TRY',
        ];
    },
};