import { Types } from 'mongoose';
import Decimal from 'decimal.js';

export class DecimalUtils {
  /**
   * Convert any number to Decimal128 with proper precision
   */
  static toDecimal128(value: number | string | Decimal): Types.Decimal128 {
    const decimal = new Decimal(value.toString());
    return Types.Decimal128.fromString(decimal.toFixed(2));
  }

  /**
   * Convert Decimal128 to number
   */
  static toNumber(value: Types.Decimal128): number {
    return parseFloat(value.toString());
  }

  /**
   * Add two Decimal128 values
   */
  static add(a: Types.Decimal128, b: Types.Decimal128): Types.Decimal128 {
    const result = new Decimal(a.toString()).plus(new Decimal(b.toString()));
    return Types.Decimal128.fromString(result.toFixed(2));
  }

  /**
   * Subtract two Decimal128 values
   */
  static subtract(a: Types.Decimal128, b: Types.Decimal128): Types.Decimal128 {
    const result = new Decimal(a.toString()).minus(new Decimal(b.toString()));
    return Types.Decimal128.fromString(result.toFixed(2));
  }

  /**
   * Multiply Decimal128 by a number
   */
  static multiply(value: Types.Decimal128, multiplier: number): Types.Decimal128 {
    const result = new Decimal(value.toString()).times(multiplier);
    return Types.Decimal128.fromString(result.toFixed(2));
  }

  /**
   * Divide Decimal128 by a number
   */
  static divide(value: Types.Decimal128, divisor: number): Types.Decimal128 {
    if (divisor === 0) throw new Error('Division by zero');
    const result = new Decimal(value.toString()).dividedBy(divisor);
    return Types.Decimal128.fromString(result.toFixed(2));
  }

  /**
   * Calculate percentage of a value
   */
  static percentage(value: Types.Decimal128, percent: number): Types.Decimal128 {
    const result = new Decimal(value.toString()).times(percent).dividedBy(100);
    return Types.Decimal128.fromString(result.toFixed(2));
  }

  /**
   * Round to specified decimal places
   */
  static round(value: Types.Decimal128, decimals: number = 2): Types.Decimal128 {
    const result = new Decimal(value.toString()).toFixed(decimals);
    return Types.Decimal128.fromString(result);
  }

  /**
   * Check if a value is zero
   */
  static isZero(value: Types.Decimal128): boolean {
    return new Decimal(value.toString()).isZero();
  }

  /**
   * Compare two Decimal128 values
   */
  static compare(a: Types.Decimal128, b: Types.Decimal128): number {
    return new Decimal(a.toString()).comparedTo(new Decimal(b.toString()));
  }

  /**
   * Format Decimal128 for display
   */
  static format(value: Types.Decimal128, currency?: string): string {
    const num = new Decimal(value.toString());
    if (currency) {
      return `${currency} ${num.toFixed(2)}`;
    }
    return num.toFixed(2);
  }

  /**
   * Ensure precise splitting without losing pennies
   * This is critical for financial calculations
   */
  static preciseSplit(total: Types.Decimal128, parts: number): Types.Decimal128[] {
    const totalDecimal = new Decimal(total.toString());
    const perPart = totalDecimal.dividedBy(parts).toDecimalPlaces(2, Decimal.ROUND_FLOOR);
    const remainder = totalDecimal.minus(perPart.times(parts));
    
    const splits: Types.Decimal128[] = [];
    for (let i = 0; i < parts; i++) {
      if (i < remainder.toNumber()) {
        splits.push(Types.Decimal128.fromString(perPart.plus(0.01).toString()));
      } else {
        splits.push(Types.Decimal128.fromString(perPart.toString()));
      }
    }
    
    return splits;
  }
}