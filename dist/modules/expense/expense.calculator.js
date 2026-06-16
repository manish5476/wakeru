"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expenseCalculator = exports.ExpenseCalculator = void 0;
const mongoose_1 = require("mongoose");
const decimal_js_1 = __importDefault(require("decimal.js"));
class ExpenseCalculator {
    /**
     * Calculate proportional itemized splits
     * This is the CORE algorithm that makes WAKERU superior
     */
    calculateProportionalSplit(lineItems, taxes, discounts, paidBy, currency) {
        const userConsumption = new Map();
        // Initialize all consumers
        lineItems.forEach(item => {
            item.consumers.forEach(consumer => {
                if (!userConsumption.has(consumer.userId)) {
                    userConsumption.set(consumer.userId, {
                        baseAmount: new decimal_js_1.default(0),
                        taxAmount: new decimal_js_1.default(0),
                        discountAmount: new decimal_js_1.default(0),
                        items: []
                    });
                }
            });
        });
        // Step 1: Calculate base consumption
        lineItems.forEach(item => {
            const itemPrice = new decimal_js_1.default(item.basePrice);
            item.consumers.forEach(consumer => {
                const userId = consumer.userId;
                const userData = userConsumption.get(userId);
                // Calculate proportional amount
                const consumptionAmount = itemPrice.times(consumer.consumptionPercentage).dividedBy(100);
                userData.baseAmount = userData.baseAmount.plus(consumptionAmount);
                userData.items.push({
                    itemId: item.itemId,
                    name: item.name,
                    category: item.category,
                    amount: mongoose_1.Types.Decimal128.fromString(consumptionAmount.toFixed(2)),
                    consumptionPercent: consumer.consumptionPercentage
                });
            });
        });
        // Step 2: Calculate proportional tax distribution
        taxes.forEach(tax => {
            const taxRate = new decimal_js_1.default(tax.percentage).dividedBy(100);
            lineItems.forEach(item => {
                // Check if tax applies to this item
                if (tax.applicableTo === 'specific' &&
                    tax.applicableItems &&
                    !tax.applicableItems.includes(item.itemId)) {
                    return;
                }
                const itemPrice = new decimal_js_1.default(item.basePrice);
                item.consumers.forEach(consumer => {
                    const userId = consumer.userId;
                    const userData = userConsumption.get(userId);
                    // Tax is proportional to consumption
                    const consumerBase = itemPrice.times(consumer.consumptionPercentage).dividedBy(100);
                    const taxOnItem = consumerBase.times(taxRate);
                    userData.taxAmount = userData.taxAmount.plus(taxOnItem);
                });
            });
        });
        // Step 3: Calculate proportional discount distribution
        const totalBaseAmount = lineItems.reduce((sum, item) => sum.plus(new decimal_js_1.default(item.basePrice)), new decimal_js_1.default(0));
        discounts.forEach(discount => {
            let totalDiscountValue;
            if (discount.type === 'fixed') {
                totalDiscountValue = new decimal_js_1.default(discount.value);
            }
            else {
                totalDiscountValue = totalBaseAmount.times(new decimal_js_1.default(discount.value).dividedBy(100));
            }
            // Calculate discount per item based on item weight
            const applicableItems = lineItems.filter(item => {
                if (discount.applicableTo === 'specific' &&
                    discount.applicableItems &&
                    !discount.applicableItems.includes(item.itemId)) {
                    return false;
                }
                return true;
            });
            const applicableTotal = applicableItems.reduce((sum, item) => sum.plus(new decimal_js_1.default(item.basePrice)), new decimal_js_1.default(0));
            applicableItems.forEach(item => {
                const itemWeight = new decimal_js_1.default(item.basePrice).dividedBy(applicableTotal);
                const itemDiscount = totalDiscountValue.times(itemWeight);
                item.consumers.forEach(consumer => {
                    const userId = consumer.userId;
                    const userData = userConsumption.get(userId);
                    // Discount is proportional to consumption
                    const consumerDiscount = itemDiscount.times(consumer.consumptionPercentage).dividedBy(100);
                    userData.discountAmount = userData.discountAmount.plus(consumerDiscount);
                });
            });
        });
        // Step 4: Calculate final amounts with precision
        const splits = [];
        let totalSubTotal = new decimal_js_1.default(0);
        let totalTax = new decimal_js_1.default(0);
        let totalDiscount = new decimal_js_1.default(0);
        for (const [userId, data] of userConsumption) {
            const finalAmount = data.baseAmount.plus(data.taxAmount).minus(data.discountAmount);
            const roundedFinal = finalAmount.toDecimalPlaces(2, decimal_js_1.default.ROUND_HALF_UP);
            splits.push({
                userId: new mongoose_1.Types.ObjectId(userId),
                baseAmount: mongoose_1.Types.Decimal128.fromString(data.baseAmount.toFixed(2)),
                taxAmount: mongoose_1.Types.Decimal128.fromString(data.taxAmount.toFixed(2)),
                discountAmount: mongoose_1.Types.Decimal128.fromString(data.discountAmount.toFixed(2)),
                finalAmount: mongoose_1.Types.Decimal128.fromString(roundedFinal.toFixed(2)),
                isPayer: userId === paidBy,
                items: data.items,
                settlementStatus: 'PENDING'
            });
            totalSubTotal = totalSubTotal.plus(data.baseAmount);
            totalTax = totalTax.plus(data.taxAmount);
            totalDiscount = totalDiscount.plus(data.discountAmount);
        }
        // Step 5: Generate consumption analytics
        const analytics = this.generateAnalytics(splits, lineItems);
        return {
            splits,
            analytics,
            totals: {
                subTotal: mongoose_1.Types.Decimal128.fromString(totalSubTotal.toFixed(2)),
                taxTotal: mongoose_1.Types.Decimal128.fromString(totalTax.toFixed(2)),
                discountTotal: mongoose_1.Types.Decimal128.fromString(totalDiscount.toFixed(2)),
                totalAmount: mongoose_1.Types.Decimal128.fromString(totalSubTotal.plus(totalTax).minus(totalDiscount).toFixed(2))
            }
        };
    }
    /**
     * Calculate equal split (for simple cases)
     */
    calculateEqualSplit(totalAmount, consumerIds, paidBy, taxes = [], discounts = []) {
        const consumerCount = consumerIds.length;
        const amount = new decimal_js_1.default(totalAmount);
        const perPerson = amount.dividedBy(consumerCount).toDecimalPlaces(2, decimal_js_1.default.ROUND_FLOOR);
        // Handle penny rounding
        const remainder = amount.minus(perPerson.times(consumerCount));
        return consumerIds.map((userId, index) => {
            let finalAmount = perPerson;
            // Distribute remainder to first few people
            if (index < remainder.toNumber() * 100) {
                finalAmount = finalAmount.plus(0.01);
            }
            return {
                userId: new mongoose_1.Types.ObjectId(userId),
                baseAmount: mongoose_1.Types.Decimal128.fromString(finalAmount.toFixed(2)),
                taxAmount: mongoose_1.Types.Decimal128.fromString('0'),
                discountAmount: mongoose_1.Types.Decimal128.fromString('0'),
                finalAmount: mongoose_1.Types.Decimal128.fromString(finalAmount.toFixed(2)),
                isPayer: userId === paidBy,
                items: [],
                settlementStatus: 'PENDING'
            };
        });
    }
    /**
     * Generate consumption analytics
     */
    generateAnalytics(splits, lineItems) {
        const categoryConsumption = new Map();
        splits.forEach(split => {
            split.items.forEach(item => {
                const category = item.category;
                if (!categoryConsumption.has(category)) {
                    categoryConsumption.set(category, {
                        totalAmount: 0,
                        itemCount: 0,
                        consumerCount: new Set()
                    });
                }
                const catData = categoryConsumption.get(category);
                catData.totalAmount += parseFloat(item.amount.toString());
                catData.itemCount++;
                catData.consumerCount.add(split.userId.toString());
            });
        });
        // Convert to plain object
        const categoryBreakdown = {};
        categoryConsumption.forEach((value, key) => {
            categoryBreakdown[key] = {
                totalAmount: mongoose_1.Types.Decimal128.fromString(value.totalAmount.toFixed(2)),
                itemCount: value.itemCount,
                consumerCount: value.consumerCount.size
            };
        });
        // Find most expensive item
        let mostExpensiveItem = null;
        let maxPrice = 0;
        lineItems.forEach(item => {
            const price = item.basePrice;
            if (price > maxPrice) {
                maxPrice = price;
                mostExpensiveItem = {
                    name: item.name,
                    amount: mongoose_1.Types.Decimal128.fromString(price.toString())
                };
            }
        });
        // Calculate consumption distribution
        const totalAmount = splits.reduce((sum, split) => sum + parseFloat(split.finalAmount.toString()), 0);
        const consumptionDistribution = splits.map(split => ({
            userId: split.userId,
            percentage: totalAmount > 0
                ? Math.round((parseFloat(split.finalAmount.toString()) / totalAmount) * 10000) / 100
                : 0
        }));
        return {
            categoryBreakdown,
            averagePerPerson: mongoose_1.Types.Decimal128.fromString((totalAmount / (splits.length || 1)).toFixed(2)),
            mostExpensiveItem,
            consumptionDistribution
        };
    }
    /**
     * Validate expense data
     */
    validateExpense(lineItems, taxes) {
        const errors = [];
        if (!lineItems || lineItems.length === 0) {
            errors.push('At least one line item is required');
            return { isValid: false, errors };
        }
        // Validate consumption percentages
        lineItems.forEach((item, index) => {
            const totalPercentage = item.consumers.reduce((sum, c) => sum + c.consumptionPercentage, 0);
            if (Math.abs(totalPercentage - 100) > 0.01) {
                errors.push(`Line item "${item.name}": Consumption percentages must total 100% (current: ${totalPercentage}%)`);
            }
            if (item.basePrice <= 0) {
                errors.push(`Line item "${item.name}": Price must be greater than 0`);
            }
            if (item.quantity < 1) {
                errors.push(`Line item "${item.name}": Quantity must be at least 1`);
            }
        });
        // Validate tax percentages
        taxes.forEach((tax, index) => {
            if (tax.percentage < 0 || tax.percentage > 100) {
                errors.push(`Tax "${tax.name}": Percentage must be between 0 and 100`);
            }
        });
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
exports.ExpenseCalculator = ExpenseCalculator;
exports.expenseCalculator = new ExpenseCalculator();
//# sourceMappingURL=expense.calculator.js.map