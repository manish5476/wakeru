import { Types } from 'mongoose';
import Decimal from 'decimal.js';
export declare class DecimalUtils {
    /**
     * Convert any number to Decimal128 with proper precision
     */
    static toDecimal128(value: number | string | Decimal): Types.Decimal128;
    /**
     * Convert Decimal128 to number
     */
    static toNumber(value: Types.Decimal128): number;
    /**
     * Add two Decimal128 values
     */
    static add(a: Types.Decimal128, b: Types.Decimal128): Types.Decimal128;
    /**
     * Subtract two Decimal128 values
     */
    static subtract(a: Types.Decimal128, b: Types.Decimal128): Types.Decimal128;
    /**
     * Multiply Decimal128 by a number
     */
    static multiply(value: Types.Decimal128, multiplier: number): Types.Decimal128;
    /**
     * Divide Decimal128 by a number
     */
    static divide(value: Types.Decimal128, divisor: number): Types.Decimal128;
    /**
     * Calculate percentage of a value
     */
    static percentage(value: Types.Decimal128, percent: number): Types.Decimal128;
    /**
     * Round to specified decimal places
     */
    static round(value: Types.Decimal128, decimals?: number): Types.Decimal128;
    /**
     * Check if a value is zero
     */
    static isZero(value: Types.Decimal128): boolean;
    /**
     * Compare two Decimal128 values
     */
    static compare(a: Types.Decimal128, b: Types.Decimal128): number;
    /**
     * Format Decimal128 for display
     */
    static format(value: Types.Decimal128, currency?: string): string;
    /**
     * Ensure precise splitting without losing pennies
     * This is critical for financial calculations
     */
    static preciseSplit(total: Types.Decimal128, parts: number): Types.Decimal128[];
}
//# sourceMappingURL=decimal.utils.d.ts.map