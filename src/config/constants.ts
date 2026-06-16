export const CONSTANTS = {
    // Categories
    EXPENSE_CATEGORIES: [
      'Food & Dining',
      'Transportation',
      'Accommodation',
      'Entertainment',
      'Shopping',
      'Groceries',
      'Utilities',
      'Healthcare',
      'Education',
      'Travel',
      'Personal Care',
      'Gifts',
      'Business',
      'Other'
    ] as const,
  
    // Payment Methods
    PAYMENT_METHODS: [
      'Cash',
      'Credit Card',
      'Debit Card',
      'UPI',
      'Net Banking',
      'Wallet',
      'Other'
    ] as const,
  
    // Currencies with symbols
    CURRENCIES: {
      INR: { symbol: '₹', name: 'Indian Rupee', decimalPlaces: 2 },
      USD: { symbol: '$', name: 'US Dollar', decimalPlaces: 2 },
      EUR: { symbol: '€', name: 'Euro', decimalPlaces: 2 },
      GBP: { symbol: '£', name: 'British Pound', decimalPlaces: 2 },
      JPY: { symbol: '¥', name: 'Japanese Yen', decimalPlaces: 0 },
      AUD: { symbol: 'A$', name: 'Australian Dollar', decimalPlaces: 2 },
      CAD: { symbol: 'C$', name: 'Canadian Dollar', decimalPlaces: 2 },
      SGD: { symbol: 'S$', name: 'Singapore Dollar', decimalPlaces: 2 },
      AED: { symbol: 'د.إ', name: 'UAE Dirham', decimalPlaces: 2 },
      SAR: { symbol: '﷼', name: 'Saudi Riyal', decimalPlaces: 2 },
    } as const,
  
    // Tax types
    TAX_TYPES: [
      { name: 'GST', percentage: 18, description: 'Goods and Services Tax' },
      { name: 'Service Charge', percentage: 10, description: 'Restaurant Service Charge' },
      { name: 'VAT', percentage: 20, description: 'Value Added Tax' },
      { name: 'Sales Tax', percentage: 8, description: 'State Sales Tax' },
    ] as const,
  
    SPLIT_TYPES: ['EQUAL', 'EXACT', 'PERCENTAGE', 'PROPORTIONAL'] as const,
    SETTLEMENT_STATUS: ['PENDING', 'COMPLETED', 'CANCELLED', 'FAILED'] as const,
    GROUP_ROLES: ['ADMIN', 'MEMBER', 'VIEWER'] as const,
    NOTIFICATION_TYPES: [
      'EXPENSE_ADDED',
      'EXPENSE_UPDATED',
      'EXPENSE_DELETED',
      'SETTLEMENT_REQUEST',
      'SETTLEMENT_COMPLETED',
      'GROUP_INVITATION',
      'GROUP_JOINED',
      'PAYMENT_REMINDER',
      'MONTHLY_REPORT',
    ] as const,
    RATE_LIMITS: {
      PUBLIC: { windowMs: 15 * 60 * 1000, max: 100 },
      AUTHENTICATED: { windowMs: 15 * 60 * 1000, max: 300 },
      EXPENSE_CREATE: { windowMs: 60 * 1000, max: 10 },
      OCR_UPLOAD: { windowMs: 60 * 1000, max: 5 },
    },
    UPLOAD_LIMITS: {
      RECEIPT_IMAGE: { maxSize: 10 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png', 'image/heic'] },
      PROFILE_IMAGE: { maxSize: 5 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png'] },
      GROUP_AVATAR: { maxSize: 2 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png'] },
    },
    CACHE_TTL: {
      USER_PROFILE: 3600,
      GROUP_DETAILS: 1800,
      EXCHANGE_RATES: 3600,
      ANALYTICS: 7200,
      DASHBOARD: 300,
    },
    PAGINATION: {
      DEFAULT_PAGE: 1,
      DEFAULT_LIMIT: 20,
      MAX_LIMIT: 100,
    },
  } as const;