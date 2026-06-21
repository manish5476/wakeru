export declare const CONSTANTS: {
    readonly EXPENSE_CATEGORIES: readonly ["Food & Dining", "Transportation", "Accommodation", "Entertainment", "Shopping", "Groceries", "Utilities", "Healthcare", "Education", "Travel", "Personal Care", "Gifts", "Business", "Other"];
    readonly PAYMENT_METHODS: readonly ["Cash", "Credit Card", "Debit Card", "UPI", "Net Banking", "Wallet", "Other"];
    readonly CURRENCIES: {
        readonly INR: {
            readonly symbol: "₹";
            readonly name: "Indian Rupee";
            readonly decimalPlaces: 2;
        };
        readonly USD: {
            readonly symbol: "$";
            readonly name: "US Dollar";
            readonly decimalPlaces: 2;
        };
        readonly EUR: {
            readonly symbol: "€";
            readonly name: "Euro";
            readonly decimalPlaces: 2;
        };
        readonly GBP: {
            readonly symbol: "£";
            readonly name: "British Pound";
            readonly decimalPlaces: 2;
        };
        readonly JPY: {
            readonly symbol: "¥";
            readonly name: "Japanese Yen";
            readonly decimalPlaces: 0;
        };
        readonly AUD: {
            readonly symbol: "A$";
            readonly name: "Australian Dollar";
            readonly decimalPlaces: 2;
        };
        readonly CAD: {
            readonly symbol: "C$";
            readonly name: "Canadian Dollar";
            readonly decimalPlaces: 2;
        };
        readonly SGD: {
            readonly symbol: "S$";
            readonly name: "Singapore Dollar";
            readonly decimalPlaces: 2;
        };
        readonly AED: {
            readonly symbol: "د.إ";
            readonly name: "UAE Dirham";
            readonly decimalPlaces: 2;
        };
        readonly SAR: {
            readonly symbol: "﷼";
            readonly name: "Saudi Riyal";
            readonly decimalPlaces: 2;
        };
    };
    readonly TAX_TYPES: readonly [{
        readonly name: "GST";
        readonly percentage: 18;
        readonly description: "Goods and Services Tax";
    }, {
        readonly name: "Service Charge";
        readonly percentage: 10;
        readonly description: "Restaurant Service Charge";
    }, {
        readonly name: "VAT";
        readonly percentage: 20;
        readonly description: "Value Added Tax";
    }, {
        readonly name: "Sales Tax";
        readonly percentage: 8;
        readonly description: "State Sales Tax";
    }];
    readonly SPLIT_TYPES: readonly ["EQUAL", "EXACT", "PERCENTAGE", "PROPORTIONAL"];
    readonly SETTLEMENT_STATUS: readonly ["PENDING", "COMPLETED", "CANCELLED", "FAILED"];
    readonly GROUP_ROLES: readonly ["ADMIN", "MEMBER", "VIEWER"];
    readonly NOTIFICATION_TYPES: readonly ["EXPENSE_ADDED", "EXPENSE_UPDATED", "EXPENSE_DELETED", "SETTLEMENT_REQUEST", "SETTLEMENT_COMPLETED", "GROUP_INVITATION", "GROUP_JOINED", "PAYMENT_REMINDER", "MONTHLY_REPORT"];
    readonly RATE_LIMITS: {
        readonly PUBLIC: {
            readonly windowMs: number;
            readonly max: 10000;
        };
        readonly AUTHENTICATED: {
            readonly windowMs: number;
            readonly max: 3000;
        };
        readonly EXPENSE_CREATE: {
            readonly windowMs: number;
            readonly max: 100;
        };
        readonly OCR_UPLOAD: {
            readonly windowMs: number;
            readonly max: 5;
        };
    };
    readonly UPLOAD_LIMITS: {
        readonly RECEIPT_IMAGE: {
            readonly maxSize: number;
            readonly allowedTypes: readonly ["image/jpeg", "image/png", "image/heic"];
        };
        readonly PROFILE_IMAGE: {
            readonly maxSize: number;
            readonly allowedTypes: readonly ["image/jpeg", "image/png"];
        };
        readonly GROUP_AVATAR: {
            readonly maxSize: number;
            readonly allowedTypes: readonly ["image/jpeg", "image/png"];
        };
    };
    readonly CACHE_TTL: {
        readonly USER_PROFILE: 3600;
        readonly GROUP_DETAILS: 1800;
        readonly EXCHANGE_RATES: 3600;
        readonly ANALYTICS: 7200;
        readonly DASHBOARD: 300;
    };
    readonly PAGINATION: {
        readonly DEFAULT_PAGE: 1;
        readonly DEFAULT_LIMIT: 20;
        readonly MAX_LIMIT: 100;
    };
};
//# sourceMappingURL=constants.d.ts.map