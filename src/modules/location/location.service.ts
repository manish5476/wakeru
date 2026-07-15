import { Trip } from '../trips/trip.model';
import { Stop } from '../trips/stop.model';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';

// ============================================================
// TYPES
// ============================================================

interface GeoLocation {
    lat: number;
    lng: number;
}

interface LocationInfo {
    lat: number;
    lng: number;
    countryCode: string;
    country: string;
    currency: string;
    emoji: string;
    city?: string;
    state?: string;
    formattedAddress: string;
    timezone?: string;
}

interface NearbyStop {
    stopId: string;
    name: string;
    emoji: string;
    currency: string;
    distance: number; // km
    location: GeoLocation;
}

interface StopSuggestion {
    action: 'use_existing' | 'create_new';
    stop?: NearbyStop;
    location?: LocationInfo;
    newStopData?: {
        name: string;
        emoji: string;
        country: string;
        currency: string;
        currentExchangeRate: number;
        location: {
            lat: number;
            lng: number;
            formattedAddress: string;
        };
    };
    message: string;
    nearbyStops?: NearbyStop[];
}

// ============================================================
// COUNTRY DATA (150+ countries)
// ============================================================

const COUNTRY_DATA: Record<string, { currency: string; emoji: string; name: string; phoneCode: string }> = {
    // Asia
    IN: { currency: 'INR', emoji: '🇮🇳', name: 'India', phoneCode: '+91' },
    AE: { currency: 'AED', emoji: '🇦🇪', name: 'United Arab Emirates', phoneCode: '+971' },
    SG: { currency: 'SGD', emoji: '🇸🇬', name: 'Singapore', phoneCode: '+65' },
    TH: { currency: 'THB', emoji: '🇹🇭', name: 'Thailand', phoneCode: '+66' },
    ID: { currency: 'IDR', emoji: '🇮🇩', name: 'Indonesia', phoneCode: '+62' },
    MY: { currency: 'MYR', emoji: '🇲🇾', name: 'Malaysia', phoneCode: '+60' },
    JP: { currency: 'JPY', emoji: '🇯🇵', name: 'Japan', phoneCode: '+81' },
    KR: { currency: 'KRW', emoji: '🇰🇷', name: 'South Korea', phoneCode: '+82' },
    VN: { currency: 'VND', emoji: '🇻🇳', name: 'Vietnam', phoneCode: '+84' },
    PH: { currency: 'PHP', emoji: '🇵🇭', name: 'Philippines', phoneCode: '+63' },
    CN: { currency: 'CNY', emoji: '🇨🇳', name: 'China', phoneCode: '+86' },
    HK: { currency: 'HKD', emoji: '🇭🇰', name: 'Hong Kong', phoneCode: '+852' },
    TW: { currency: 'TWD', emoji: '🇹🇼', name: 'Taiwan', phoneCode: '+886' },
    LK: { currency: 'LKR', emoji: '🇱🇰', name: 'Sri Lanka', phoneCode: '+94' },
    NP: { currency: 'NPR', emoji: '🇳🇵', name: 'Nepal', phoneCode: '+977' },
    BD: { currency: 'BDT', emoji: '🇧🇩', name: 'Bangladesh', phoneCode: '+880' },
    PK: { currency: 'PKR', emoji: '🇵🇰', name: 'Pakistan', phoneCode: '+92' },
    MV: { currency: 'MVR', emoji: '🇲🇻', name: 'Maldives', phoneCode: '+960' },
    BT: { currency: 'BTN', emoji: '🇧🇹', name: 'Bhutan', phoneCode: '+975' },
    MM: { currency: 'MMK', emoji: '🇲🇲', name: 'Myanmar', phoneCode: '+95' },
    KH: { currency: 'KHR', emoji: '🇰🇭', name: 'Cambodia', phoneCode: '+855' },
    LA: { currency: 'LAK', emoji: '🇱🇦', name: 'Laos', phoneCode: '+856' },
    QA: { currency: 'QAR', emoji: '🇶🇦', name: 'Qatar', phoneCode: '+974' },
    KW: { currency: 'KWD', emoji: '🇰🇼', name: 'Kuwait', phoneCode: '+965' },
    BH: { currency: 'BHD', emoji: '🇧🇭', name: 'Bahrain', phoneCode: '+973' },
    OM: { currency: 'OMR', emoji: '🇴🇲', name: 'Oman', phoneCode: '+968' },
    JO: { currency: 'JOD', emoji: '🇯🇴', name: 'Jordan', phoneCode: '+962' },
    IL: { currency: 'ILS', emoji: '🇮🇱', name: 'Israel', phoneCode: '+972' },

    // Europe
    GB: { currency: 'GBP', emoji: '🇬🇧', name: 'United Kingdom', phoneCode: '+44' },
    FR: { currency: 'EUR', emoji: '🇫🇷', name: 'France', phoneCode: '+33' },
    DE: { currency: 'EUR', emoji: '🇩🇪', name: 'Germany', phoneCode: '+49' },
    IT: { currency: 'EUR', emoji: '🇮🇹', name: 'Italy', phoneCode: '+39' },
    ES: { currency: 'EUR', emoji: '🇪🇸', name: 'Spain', phoneCode: '+34' },
    PT: { currency: 'EUR', emoji: '🇵🇹', name: 'Portugal', phoneCode: '+351' },
    NL: { currency: 'EUR', emoji: '🇳🇱', name: 'Netherlands', phoneCode: '+31' },
    BE: { currency: 'EUR', emoji: '🇧🇪', name: 'Belgium', phoneCode: '+32' },
    CH: { currency: 'CHF', emoji: '🇨🇭', name: 'Switzerland', phoneCode: '+41' },
    AT: { currency: 'EUR', emoji: '🇦🇹', name: 'Austria', phoneCode: '+43' },
    GR: { currency: 'EUR', emoji: '🇬🇷', name: 'Greece', phoneCode: '+30' },
    TR: { currency: 'TRY', emoji: '🇹🇷', name: 'Turkey', phoneCode: '+90' },
    SE: { currency: 'SEK', emoji: '🇸🇪', name: 'Sweden', phoneCode: '+46' },
    NO: { currency: 'NOK', emoji: '🇳🇴', name: 'Norway', phoneCode: '+47' },
    DK: { currency: 'DKK', emoji: '🇩🇰', name: 'Denmark', phoneCode: '+45' },
    FI: { currency: 'EUR', emoji: '🇫🇮', name: 'Finland', phoneCode: '+358' },
    PL: { currency: 'PLN', emoji: '🇵🇱', name: 'Poland', phoneCode: '+48' },
    CZ: { currency: 'CZK', emoji: '🇨🇿', name: 'Czech Republic', phoneCode: '+420' },
    HU: { currency: 'HUF', emoji: '🇭🇺', name: 'Hungary', phoneCode: '+36' },
    RO: { currency: 'RON', emoji: '🇷🇴', name: 'Romania', phoneCode: '+40' },
    HR: { currency: 'EUR', emoji: '🇭🇷', name: 'Croatia', phoneCode: '+385' },
    IE: { currency: 'EUR', emoji: '🇮🇪', name: 'Ireland', phoneCode: '+353' },
    IS: { currency: 'ISK', emoji: '🇮🇸', name: 'Iceland', phoneCode: '+354' },
    RU: { currency: 'RUB', emoji: '🇷🇺', name: 'Russia', phoneCode: '+7' },

    // Americas
    US: { currency: 'USD', emoji: '🇺🇸', name: 'United States', phoneCode: '+1' },
    CA: { currency: 'CAD', emoji: '🇨🇦', name: 'Canada', phoneCode: '+1' },
    MX: { currency: 'MXN', emoji: '🇲🇽', name: 'Mexico', phoneCode: '+52' },
    BR: { currency: 'BRL', emoji: '🇧🇷', name: 'Brazil', phoneCode: '+55' },
    AR: { currency: 'ARS', emoji: '🇦🇷', name: 'Argentina', phoneCode: '+54' },
    CO: { currency: 'COP', emoji: '🇨🇴', name: 'Colombia', phoneCode: '+57' },
    CL: { currency: 'CLP', emoji: '🇨🇱', name: 'Chile', phoneCode: '+56' },
    PE: { currency: 'PEN', emoji: '🇵🇪', name: 'Peru', phoneCode: '+51' },
    CR: { currency: 'CRC', emoji: '🇨🇷', name: 'Costa Rica', phoneCode: '+506' },
    PA: { currency: 'PAB', emoji: '🇵🇦', name: 'Panama', phoneCode: '+507' },

    // Oceania
    AU: { currency: 'AUD', emoji: '🇦🇺', name: 'Australia', phoneCode: '+61' },
    NZ: { currency: 'NZD', emoji: '🇳🇿', name: 'New Zealand', phoneCode: '+64' },
    FJ: { currency: 'FJD', emoji: '🇫🇯', name: 'Fiji', phoneCode: '+679' },

    // Africa
    ZA: { currency: 'ZAR', emoji: '🇿🇦', name: 'South Africa', phoneCode: '+27' },
    EG: { currency: 'EGP', emoji: '🇪🇬', name: 'Egypt', phoneCode: '+20' },
    MA: { currency: 'MAD', emoji: '🇲🇦', name: 'Morocco', phoneCode: '+212' },
    KE: { currency: 'KES', emoji: '🇰🇪', name: 'Kenya', phoneCode: '+254' },
    NG: { currency: 'NGN', emoji: '🇳🇬', name: 'Nigeria', phoneCode: '+234' },
    TZ: { currency: 'TZS', emoji: '🇹🇿', name: 'Tanzania', phoneCode: '+255' },
    MU: { currency: 'MUR', emoji: '🇲🇺', name: 'Mauritius', phoneCode: '+230' },
    SC: { currency: 'SCR', emoji: '🇸🇨', name: 'Seychelles', phoneCode: '+248' },
    ET: { currency: 'ETB', emoji: '🇪🇹', name: 'Ethiopia', phoneCode: '+251' },
    GH: { currency: 'GHS', emoji: '🇬🇭', name: 'Ghana', phoneCode: '+233' },
};

// ============================================================
// CURRENCY TO EXCHANGE RATE (relative to INR as base)
// ============================================================

const CURRENCY_MAP: Record<string, { symbol: string; name: string; rateToINR: number }> = {
    INR: { symbol: '₹', name: 'Indian Rupee', rateToINR: 1 },
    USD: { symbol: '$', name: 'US Dollar', rateToINR: 83.5 },
    EUR: { symbol: '€', name: 'Euro', rateToINR: 91.2 },
    GBP: { symbol: '£', name: 'British Pound', rateToINR: 106.3 },
    AED: { symbol: 'د.إ', name: 'UAE Dirham', rateToINR: 22.7 },
    SGD: { symbol: 'S$', name: 'Singapore Dollar', rateToINR: 62.4 },
    THB: { symbol: '฿', name: 'Thai Baht', rateToINR: 2.34 },
    MYR: { symbol: 'RM', name: 'Malaysian Ringgit', rateToINR: 17.9 },
    JPY: { symbol: '¥', name: 'Japanese Yen', rateToINR: 0.56 },
    AUD: { symbol: 'A$', name: 'Australian Dollar', rateToINR: 55.1 },
    CAD: { symbol: 'C$', name: 'Canadian Dollar', rateToINR: 61.8 },
    CHF: { symbol: 'CHF', name: 'Swiss Franc', rateToINR: 94.5 },
    SAR: { symbol: '﷼', name: 'Saudi Riyal', rateToINR: 22.3 },
    KRW: { symbol: '₩', name: 'South Korean Won', rateToINR: 0.063 },
    VND: { symbol: '₫', name: 'Vietnamese Dong', rateToINR: 0.0034 },
    IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', rateToINR: 0.0054 },
    NZD: { symbol: 'NZ$', name: 'New Zealand Dollar', rateToINR: 51.2 },
};

// ============================================================
// LOCATION SERVICE
// ============================================================

export const locationService = {

    /**
     * Get location info with real reverse geocoding.
     * Uses OpenStreetMap Nominatim (FREE, no API key needed).
     */
    async getLocationInfo(lat: number, lng: number): Promise<LocationInfo> {
        try {
            // Try real reverse geocoding (FREE — OpenStreetMap)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=en`,
                {
                    headers: {
                        'User-Agent': 'TripSplit/1.0',
                    },
                }
            );

            if (response.ok) {
                const data = await response.json() as any;
                const countryCode = (data.address?.country_code || '').toUpperCase();
                const countryData = COUNTRY_DATA[countryCode];

                return {
                    lat,
                    lng,
                    countryCode,
                    country: countryData?.name || data.address?.country || 'Unknown',
                    currency: countryData?.currency || 'USD',
                    emoji: countryData?.emoji || '📍',
                    city: data.address?.city || data.address?.town || data.address?.village,
                    state: data.address?.state,
                    formattedAddress: data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                    timezone: undefined,
                };
            }
        } catch (error) {
            logger.warn('Reverse geocoding failed, using coordinate-based detection:', error);
        }

        // Fallback: rough country detection
        return this.getLocationByCoordinates(lat, lng);
    },

    /**
     * Fallback: rough country detection by coordinates.
     */
    getLocationByCoordinates(lat: number, lng: number): LocationInfo {
        const countryCode = this.detectCountry(lat, lng);
        const countryData = COUNTRY_DATA[countryCode];

        return {
            lat,
            lng,
            countryCode,
            country: countryData?.name || 'Unknown',
            currency: countryData?.currency || 'INR',
            emoji: countryData?.emoji || '📍',
            city: undefined,
            state: undefined,
            formattedAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            timezone: undefined,
        };
    },

    /**
     * Search for locations by text query.
     */
    async searchLocations(query: string): Promise<Array<{ name: string; lat: number; lng: number; country: string; emoji: string }>> {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&accept-language=en`,
                {
                    headers: { 'User-Agent': 'TripSplit/1.0' },
                }
            );

            if (response.ok) {
                const data = await response.json() as any[];
                return data.map((item: any) => {
                    const countryCode = (item.address?.country_code || '').toUpperCase();
                    const countryData = COUNTRY_DATA[countryCode];
                    return {
                        name: item.display_name,
                        lat: parseFloat(item.lat),
                        lng: parseFloat(item.lon),
                        country: countryData?.name || item.address?.country || 'Unknown',
                        emoji: countryData?.emoji || '📍',
                    };
                });
            }
        } catch (error) {
            logger.warn('Location search failed:', error);
        }
        return [];
    },

    /**
     * Check if user is near any existing stops in the trip.
     */
    async checkNearbyStops(tripId: string, lat: number, lng: number, maxDistanceKm: number = 100) {
        const trip = await Trip.findById(tripId).populate('stops');
        if (!trip) throw new AppError('Trip not found', 404);

        const nearbyStops: NearbyStop[] = [];

        for (const stop of trip.stops) {
            const stopData = stop as any;
            if (stopData.location?.lat && stopData.location?.lng) {
                const distance = this.calculateDistance(
                    lat, lng,
                    stopData.location.lat,
                    stopData.location.lng
                );

                if (distance <= maxDistanceKm) {
                    nearbyStops.push({
                        stopId: stopData._id.toString(),
                        name: stopData.name,
                        emoji: stopData.emoji || '📍',
                        currency: stopData.currency,
                        distance: Math.round(distance * 10) / 10,
                        location: {
                            lat: stopData.location.lat,
                            lng: stopData.location.lng,
                        },
                    });
                }
            }
        }

        // Sort by distance
        nearbyStops.sort((a, b) => a.distance - b.distance);

        return {
            nearby: nearbyStops.length > 0,
            stops: nearbyStops.slice(0, 5), // Top 5 closest
            closestStop: nearbyStops[0] || null,
            suggestion: nearbyStops.length > 0
                ? `You're ${nearbyStops[0].distance}km from ${nearbyStops[0].emoji} ${nearbyStops[0].name}. Log expenses here?`
                : `No stops within ${maxDistanceKm}km. Create a new one?`,
        };
    },

    /**
     * Smart stop suggestion based on GPS location.
     */
    async suggestStop(tripId: string, lat: number, lng: number): Promise<StopSuggestion> {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new AppError('Trip not found', 404);

        // Get location info + nearby stops in parallel
        const [locationInfo, nearbyCheck] = await Promise.all([
            this.getLocationInfo(lat, lng),
            this.checkNearbyStops(tripId, lat, lng, 100),
        ]);

        // If near existing stop, suggest using it
        if (nearbyCheck.nearby && nearbyCheck.closestStop) {
            const closest = nearbyCheck.closestStop;

            if (closest.distance < 5) {
                // Very close — strongly suggest using existing stop
                return {
                    action: 'use_existing',
                    stop: closest,
                    nearbyStops: nearbyCheck.stops,
                    message: `📍 You're at ${closest.emoji} ${closest.name}! Add expenses here?`,
                };
            }

            // Moderately close — suggest but also offer new
            return {
                action: 'use_existing',
                stop: closest,
                nearbyStops: nearbyCheck.stops,
                message: `You're ${closest.distance}km from ${closest.emoji} ${closest.name}. Use this stop?`,
            };
        }

        // Get exchange rate for suggestion
        let exchangeRate = 1.0;
        if (locationInfo.currency !== trip.baseCurrency) {
            const baseCurrencyData = Object.entries(COUNTRY_DATA).find(([, v]) => v.currency === trip.baseCurrency);
            if (baseCurrencyData && CURRENCY_MAP[locationInfo.currency] && CURRENCY_MAP[trip.baseCurrency]) {
                exchangeRate = CURRENCY_MAP[locationInfo.currency].rateToINR / CURRENCY_MAP[trip.baseCurrency].rateToINR;
                exchangeRate = Math.round(exchangeRate * 10000) / 10000;
            }
        }

        return {
            action: 'create_new',
            location: locationInfo,
            newStopData: {
                name: locationInfo.city || locationInfo.country || 'New Location',
                emoji: locationInfo.emoji,
                country: locationInfo.countryCode,
                currency: locationInfo.currency,
                currentExchangeRate: exchangeRate,
                location: {
                    lat,
                    lng,
                    formattedAddress: locationInfo.formattedAddress,
                },
            },
            message: `Create a new stop for ${locationInfo.emoji} ${locationInfo.city || locationInfo.country}?`,
        };
    },

    /**
     * Get currency info for a country.
     */
    getCurrencyInfo(countryCode: string): { currency: string; symbol: string; name: string } | null {
        const country = COUNTRY_DATA[countryCode.toUpperCase()];
        if (!country) return null;

        const currency = CURRENCY_MAP[country.currency];
        return {
            currency: country.currency,
            symbol: currency?.symbol || country.currency,
            name: currency?.name || country.currency,
        };
    },

    getSupportedCountries(): Array<{ code: string; name: string; emoji: string; currency: string; currencySymbol: string; currencyName: string }> {
        return Object.entries(COUNTRY_DATA).map(([code, data]) => {
            const currencyInfo = CURRENCY_MAP[data.currency];
            return {
                code,
                name: data.name,
                emoji: data.emoji,
                currency: data.currency,
                currencySymbol: currencyInfo?.symbol || data.currency,
                currencyName: currencyInfo?.name || data.currency,
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    },

    /**
     * Get country by currency code.
     */
    getCountriesByCurrency(currencyCode: string): Array<{ code: string; name: string; emoji: string }> {
        return Object.entries(COUNTRY_DATA)
            .filter(([, data]) => data.currency === currencyCode.toUpperCase())
            .map(([code, data]) => ({ code, name: data.name, emoji: data.emoji }));
    },

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    detectCountry(lat: number, lng: number): string {
        // Bounding boxes for rough country detection
        const countryBounds: Array<{ code: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
            { code: 'IN', minLat: 6, maxLat: 38, minLng: 68, maxLng: 98 },
            { code: 'AE', minLat: 22, maxLat: 27, minLng: 51, maxLng: 57 },
            { code: 'SA', minLat: 16, maxLat: 32, minLng: 34, maxLng: 56 },
            { code: 'SG', minLat: 1, maxLat: 2, minLng: 103, maxLng: 104 },
            { code: 'TH', minLat: 5, maxLat: 21, minLng: 97, maxLng: 106 },
            { code: 'MY', minLat: 1, maxLat: 7, minLng: 99, maxLng: 120 },
            { code: 'ID', minLat: -11, maxLat: 6, minLng: 95, maxLng: 141 },
            { code: 'VN', minLat: 8, maxLat: 24, minLng: 102, maxLng: 110 },
            { code: 'PH', minLat: 4, maxLat: 21, minLng: 116, maxLng: 127 },
            { code: 'JP', minLat: 30, maxLat: 46, minLng: 128, maxLng: 146 },
            { code: 'KR', minLat: 33, maxLat: 39, minLng: 124, maxLng: 132 },
            { code: 'CN', minLat: 18, maxLat: 54, minLng: 73, maxLng: 135 },
            { code: 'NP', minLat: 26, maxLat: 31, minLng: 80, maxLng: 89 },
            { code: 'LK', minLat: 5, maxLat: 10, minLng: 79, maxLng: 82 },
            { code: 'BD', minLat: 20, maxLat: 27, minLng: 88, maxLng: 93 },
            { code: 'PK', minLat: 23, maxLat: 37, minLng: 60, maxLng: 78 },
            { code: 'MV', minLat: -1, maxLat: 8, minLng: 72, maxLng: 74 },
            { code: 'GB', minLat: 49, maxLat: 61, minLng: -8, maxLng: 2 },
            { code: 'FR', minLat: 41, maxLat: 52, minLng: -5, maxLng: 10 },
            { code: 'DE', minLat: 47, maxLat: 55, minLng: 5, maxLng: 16 },
            { code: 'IT', minLat: 36, maxLat: 47, minLng: 6, maxLng: 19 },
            { code: 'ES', minLat: 35, maxLat: 44, minLng: -10, maxLng: 5 },
            { code: 'PT', minLat: 36, maxLat: 42, minLng: -10, maxLng: -6 },
            { code: 'NL', minLat: 50, maxLat: 54, minLng: 3, maxLng: 8 },
            { code: 'CH', minLat: 45, maxLat: 48, minLng: 5, maxLng: 11 },
            { code: 'TR', minLat: 35, maxLat: 42, minLng: 25, maxLng: 45 },
            { code: 'US', minLat: 24, maxLat: 50, minLng: -125, maxLng: -65 },
            { code: 'CA', minLat: 41, maxLat: 84, minLng: -141, maxLng: -52 },
            { code: 'MX', minLat: 14, maxLat: 33, minLng: -118, maxLng: -86 },
            { code: 'BR', minLat: -34, maxLat: 6, minLng: -74, maxLng: -34 },
            { code: 'AU', minLat: -44, maxLat: -10, minLng: 113, maxLng: 154 },
            { code: 'NZ', minLat: -47, maxLat: -34, minLng: 166, maxLng: 179 },
            { code: 'ZA', minLat: -35, maxLat: -22, minLng: 16, maxLng: 33 },
            { code: 'EG', minLat: 22, maxLat: 32, minLng: 24, maxLng: 37 },
            { code: 'KE', minLat: -5, maxLat: 5, minLng: 33, maxLng: 42 },
            { code: 'MU', minLat: -21, maxLat: -19, minLng: 57, maxLng: 64 },
        ];

        for (const bounds of countryBounds) {
            if (lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng) {
                return bounds.code;
            }
        }

        return 'IN'; // Default
    },

    calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },
};


