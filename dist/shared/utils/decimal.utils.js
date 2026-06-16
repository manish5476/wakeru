"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecimalUtils = void 0;
const mongoose_1 = require("mongoose");
const decimal_js_1 = __importDefault(require("decimal.js"));
class DecimalUtils {
    /**
     * Convert any number to Decimal128 with proper precision
     */
    static toDecimal128(value) {
        const decimal = new decimal_js_1.default(value.toString());
        return mongoose_1.Types.Decimal128.fromString(decimal.toFixed(2));
    }
    /**
     * Convert Decimal128 to number
     */
    static toNumber(value) {
        return parseFloat(value.toString());
    }
    /**
     * Add two Decimal128 values
     */
    static add(a, b) {
        const result = new decimal_js_1.default(a.toString()).plus(new decimal_js_1.default(b.toString()));
        return mongoose_1.Types.Decimal128.fromString(result.toFixed(2));
    }
    /**
     * Subtract two Decimal128 values
     */
    static subtract(a, b) {
        const result = new decimal_js_1.default(a.toString()).minus(new decimal_js_1.default(b.toString()));
        return mongoose_1.Types.Decimal128.fromString(result.toFixed(2));
    }
    /**
     * Multiply Decimal128 by a number
     */
    static multiply(value, multiplier) {
        const result = new decimal_js_1.default(value.toString()).times(multiplier);
        return mongoose_1.Types.Decimal128.fromString(result.toFixed(2));
    }
    /**
     * Divide Decimal128 by a number
     */
    static divide(value, divisor) {
        if (divisor === 0)
            throw new Error('Division by zero');
        const result = new decimal_js_1.default(value.toString()).dividedBy(divisor);
        return mongoose_1.Types.Decimal128.fromString(result.toFixed(2));
    }
    /**
     * Calculate percentage of a value
     */
    static percentage(value, percent) {
        const result = new decimal_js_1.default(value.toString()).times(percent).dividedBy(100);
        return mongoose_1.Types.Decimal128.fromString(result.toFixed(2));
    }
    /**
     * Round to specified decimal places
     */
    static round(value, decimals = 2) {
        const result = new decimal_js_1.default(value.toString()).toFixed(decimals);
        return mongoose_1.Types.Decimal128.fromString(result);
    }
    /**
     * Check if a value is zero
     */
    static isZero(value) {
        return new decimal_js_1.default(value.toString()).isZero();
    }
    /**
     * Compare two Decimal128 values
     */
    static compare(a, b) {
        return new decimal_js_1.default(a.toString()).comparedTo(new decimal_js_1.default(b.toString()));
    }
    /**
     * Format Decimal128 for display
     */
    static format(value, currency) {
        const num = new decimal_js_1.default(value.toString());
        if (currency) {
            return `${currency} ${num.toFixed(2)}`;
        }
        return num.toFixed(2);
    }
    /**
     * Ensure precise splitting without losing pennies
     * This is critical for financial calculations
     */
    static preciseSplit(total, parts) {
        const totalDecimal = new decimal_js_1.default(total.toString());
        const perPart = totalDecimal.dividedBy(parts).toDecimalPlaces(2, decimal_js_1.default.ROUND_FLOOR);
        const remainder = totalDecimal.minus(perPart.times(parts));
        const splits = [];
        for (let i = 0; i < parts; i++) {
            if (i < remainder.toNumber()) {
                splits.push(mongoose_1.Types.Decimal128.fromString(perPart.plus(0.01).toString()));
            }
            else {
                splits.push(mongoose_1.Types.Decimal128.fromString(perPart.toString()));
            }
        }
        return splits;
    }
}
exports.DecimalUtils = DecimalUtils;
//# sourceMappingURL=decimal.utils.js.map