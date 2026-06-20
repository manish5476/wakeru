import { Trip } from '../trips/trip.model';
import { AppError } from '../../shared/errors/AppError';

// Country to currency/emoji mapping
const COUNTRY_DATA: Record<string, { currency: string; emoji: string; name: string }> = {
    IN: { currency: 'INR', emoji: '🇮🇳', name: 'India' },
    AE: { currency: 'AED', emoji: '🇦🇪', name: 'UAE' },
    US: { currency: 'USD', emoji: '🇺🇸', name: 'USA' },
    GB: { currency: 'GBP', emoji: '🇬🇧', name: 'UK' },
    FR: { currency: 'EUR', emoji: '🇫🇷', name: 'France' },
    IT: { currency: 'EUR', emoji: '🇮🇹', name: 'Italy' },
    ES: { currency: 'EUR', emoji: '🇪🇸', name: 'Spain' },
    DE: { currency: 'EUR', emoji: '🇩🇪', name: 'Germany' },
    JP: { currency: 'JPY', emoji: '🇯🇵', name: 'Japan' },
    SG: { currency: 'SGD', emoji: '🇸🇬', name: 'Singapore' },
    TH: { currency: 'THB', emoji: '🇹🇭', name: 'Thailand' },
    ID: { currency: 'IDR', emoji: '🇮🇩', name: 'Indonesia' },
    MY: { currency: 'MYR', emoji: '🇲🇾', name: 'Malaysia' },
    AU: { currency: 'AUD', emoji: '🇦🇺', name: 'Australia' },
    NZ: { currency: 'NZD', emoji: '🇳🇿', name: 'New Zealand' },
    CH: { currency: 'CHF', emoji: '🇨🇭', name: 'Switzerland' },
    CA: { currency: 'CAD', emoji: '🇨🇦', name: 'Canada' },
    SA: { currency: 'SAR', emoji: '🇸🇦', name: 'Saudi Arabia' },
    BR: { currency: 'BRL', emoji: '🇧🇷', name: 'Brazil' },
    ZA: { currency: 'ZAR', emoji: '🇿🇦', name: 'South Africa' },
    KR: { currency: 'KRW', emoji: '🇰🇷', name: 'South Korea' },
    VN: { currency: 'VND', emoji: '🇻🇳', name: 'Vietnam' },
    TR: { currency: 'TRY', emoji: '🇹🇷', name: 'Turkey' },
    EG: { currency: 'EGP', emoji: '🇪🇬', name: 'Egypt' },
    NP: { currency: 'NPR', emoji: '🇳🇵', name: 'Nepal' },
    LK: { currency: 'LKR', emoji: '🇱🇰', name: 'Sri Lanka' },
    BD: { currency: 'BDT', emoji: '🇧🇩', name: 'Bangladesh' },
    PK: { currency: 'PKR', emoji: '🇵🇰', name: 'Pakistan' },
    MV: { currency: 'MVR', emoji: '🇲🇻', name: 'Maldives' },
    MU: { currency: 'MUR', emoji: '🇲🇺', name: 'Mauritius' },
};

export const locationService = {
    /**
     * Get location suggestions based on GPS coordinates.
     */
    async getLocationInfo(lat: number, lng: number) {
        // In production: use reverse geocoding API (Google Maps, OpenStreetMap)
        // For now: return basic info based on coordinates

        // Rough country detection by lat/lng (simplified)
        const countryCode = this.roughCountryDetection(lat, lng);
        const countryData = COUNTRY_DATA[countryCode];

        return {
            lat,
            lng,
            countryCode,
            country: countryData?.name || 'Unknown',
            currency: countryData?.currency || 'INR',
            emoji: countryData?.emoji || '📍',
            formattedAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            suggestion: countryData
                ? `📍 You seem to be in ${countryData.emoji} ${countryData.name}. Create a stop here?`
                : '📍 Add this location as a stop?',
        };
    },

    /**
     * Check if user is near an existing stop.
     */
    async checkNearbyStops(tripId: string, lat: number, lng: number) {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new AppError('Trip not found', 404);

        const nearbyStops = trip.stops.filter((stop: any) => {
            if (!stop.location?.lat || !stop.location?.lng) return false;
            const distance = this.calculateDistance(
                lat, lng,
                stop.location.lat, stop.location.lng
            );
            return distance < 50; // Within 50km
        });

        return {
            nearby: nearbyStops.length > 0,
            stops: nearbyStops.map((s: any) => ({
                stopId: s._id,
                name: s.name,
                emoji: s.emoji,
                currency: s.currency,
                distance: this.calculateDistance(lat, lng, s.location!.lat, s.location!.lng),
            })),
            suggestion: nearbyStops.length > 0
                ? 'You are near an existing stop. Log expenses here?'
                : 'No nearby stops. Create a new one?',
        };
    },

    /**
     * Auto-suggest stop creation based on location.
     */
    async suggestStop(tripId: string, lat: number, lng: number) {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new AppError('Trip not found', 404);

        const locationInfo = await this.getLocationInfo(lat, lng);
        const nearbyCheck = await this.checkNearbyStops(tripId, lat, lng);

        // If near existing stop, suggest using it
        if (nearbyCheck.nearby && nearbyCheck.stops.length > 0) {
            return {
                action: 'use_existing',
                stop: nearbyCheck.stops[0],
                message: `You're near ${nearbyCheck.stops[0].emoji} ${nearbyCheck.stops[0].name}. Add expenses here?`,
            };
        }

        // Otherwise suggest creating new stop
        return {
            action: 'create_new',
            location: locationInfo,
            suggestion: {
                name: locationInfo.country || 'New Location',
                emoji: locationInfo.emoji,
                country: locationInfo.countryCode,
                currency: locationInfo.currency,
                currentExchangeRate: locationInfo.currency === trip.baseCurrency ? 1.0 : undefined,
                location: {
                    lat,
                    lng,
                    formattedAddress: locationInfo.formattedAddress,
                },
            },
            message: `Create a new stop for ${locationInfo.emoji} ${locationInfo.country}?`,
        };
    },

    // Helpers
    roughCountryDetection(lat: number, lng: number): string {
        // Simplified — in production, use reverse geocoding
        if (lat > 20 && lat < 40 && lng > 68 && lng < 98) return 'IN';  // India
        if (lat > 22 && lat < 27 && lng > 51 && lng < 57) return 'AE';  // UAE
        if (lat > 41 && lat < 52 && lng > -5 && lng < 10) return 'FR';  // France
        if (lat > 1 && lat < 2 && lng > 103 && lng < 104) return 'SG';  // Singapore
        if (lat > 13 && lat < 16 && lng > 100 && lng < 101) return 'TH'; // Thailand
        if (lat > 25 && lat < 50 && lng > -125 && lng < -65) return 'US'; // USA
        if (lat > 50 && lat < 60 && lng > -8 && lng < 2) return 'GB';    // UK
        if (lat > -45 && lat < -10 && lng > 110 && lng < 155) return 'AU'; // Australia
        return 'IN'; // Default
    },

    calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    },
};