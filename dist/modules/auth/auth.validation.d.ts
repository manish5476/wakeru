import { z } from 'zod';
export declare const verifyFirebaseTokenSchema: z.ZodObject<{
    idToken: z.ZodString;
    metadata: z.ZodOptional<z.ZodObject<{
        displayName: z.ZodOptional<z.ZodString>;
        phoneNumber: z.ZodOptional<z.ZodString>;
        photoURL: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        displayName?: string | undefined;
        photoURL?: string | undefined;
        phoneNumber?: string | undefined;
    }, {
        displayName?: string | undefined;
        photoURL?: string | undefined;
        phoneNumber?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    idToken: string;
    metadata?: {
        displayName?: string | undefined;
        photoURL?: string | undefined;
        phoneNumber?: string | undefined;
    } | undefined;
}, {
    idToken: string;
    metadata?: {
        displayName?: string | undefined;
        photoURL?: string | undefined;
        phoneNumber?: string | undefined;
    } | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    idToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    idToken: string;
}, {
    idToken: string;
}>;
export declare const refreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const logoutSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const updateProfileSchema: z.ZodEffects<z.ZodObject<{
    displayName: z.ZodOptional<z.ZodString>;
    photoURL: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    phoneNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    displayName?: string | undefined;
    photoURL?: string | undefined;
    phoneNumber?: string | undefined;
    bio?: string | undefined;
}, {
    displayName?: string | undefined;
    photoURL?: string | undefined;
    phoneNumber?: string | undefined;
    bio?: string | undefined;
}>, {
    displayName?: string | undefined;
    photoURL?: string | undefined;
    phoneNumber?: string | undefined;
    bio?: string | undefined;
}, {
    displayName?: string | undefined;
    photoURL?: string | undefined;
    phoneNumber?: string | undefined;
    bio?: string | undefined;
}>;
export declare const updatePreferencesSchema: z.ZodEffects<z.ZodObject<{
    defaultCurrency: z.ZodOptional<z.ZodEnum<["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED", "SAR"]>>;
    language: z.ZodOptional<z.ZodEnum<["en", "hi", "es", "fr", "de", "ja", "zh"]>>;
    theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
    timezone: z.ZodOptional<z.ZodString>;
    notifications: z.ZodOptional<z.ZodObject<{
        push: z.ZodOptional<z.ZodBoolean>;
        email: z.ZodOptional<z.ZodBoolean>;
        sms: z.ZodOptional<z.ZodBoolean>;
        expenseAdded: z.ZodOptional<z.ZodBoolean>;
        settlementReminder: z.ZodOptional<z.ZodBoolean>;
        monthlyReport: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        email?: boolean | undefined;
        push?: boolean | undefined;
        sms?: boolean | undefined;
        expenseAdded?: boolean | undefined;
        settlementReminder?: boolean | undefined;
        monthlyReport?: boolean | undefined;
    }, {
        email?: boolean | undefined;
        push?: boolean | undefined;
        sms?: boolean | undefined;
        expenseAdded?: boolean | undefined;
        settlementReminder?: boolean | undefined;
        monthlyReport?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    defaultCurrency?: "INR" | "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "SGD" | "AED" | "SAR" | undefined;
    language?: "en" | "hi" | "es" | "fr" | "de" | "ja" | "zh" | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    timezone?: string | undefined;
    notifications?: {
        email?: boolean | undefined;
        push?: boolean | undefined;
        sms?: boolean | undefined;
        expenseAdded?: boolean | undefined;
        settlementReminder?: boolean | undefined;
        monthlyReport?: boolean | undefined;
    } | undefined;
}, {
    defaultCurrency?: "INR" | "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "SGD" | "AED" | "SAR" | undefined;
    language?: "en" | "hi" | "es" | "fr" | "de" | "ja" | "zh" | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    timezone?: string | undefined;
    notifications?: {
        email?: boolean | undefined;
        push?: boolean | undefined;
        sms?: boolean | undefined;
        expenseAdded?: boolean | undefined;
        settlementReminder?: boolean | undefined;
        monthlyReport?: boolean | undefined;
    } | undefined;
}>, {
    defaultCurrency?: "INR" | "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "SGD" | "AED" | "SAR" | undefined;
    language?: "en" | "hi" | "es" | "fr" | "de" | "ja" | "zh" | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    timezone?: string | undefined;
    notifications?: {
        email?: boolean | undefined;
        push?: boolean | undefined;
        sms?: boolean | undefined;
        expenseAdded?: boolean | undefined;
        settlementReminder?: boolean | undefined;
        monthlyReport?: boolean | undefined;
    } | undefined;
}, {
    defaultCurrency?: "INR" | "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "SGD" | "AED" | "SAR" | undefined;
    language?: "en" | "hi" | "es" | "fr" | "de" | "ja" | "zh" | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    timezone?: string | undefined;
    notifications?: {
        email?: boolean | undefined;
        push?: boolean | undefined;
        sms?: boolean | undefined;
        expenseAdded?: boolean | undefined;
        settlementReminder?: boolean | undefined;
        monthlyReport?: boolean | undefined;
    } | undefined;
}>;
export declare const updateBankingDetailsSchema: z.ZodEffects<z.ZodObject<{
    upiId: z.ZodOptional<z.ZodString>;
    bankAccount: z.ZodOptional<z.ZodObject<{
        accountNumber: z.ZodString;
        ifscCode: z.ZodString;
        bankName: z.ZodString;
        accountHolderName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        accountNumber: string;
        ifscCode: string;
        bankName: string;
        accountHolderName: string;
    }, {
        accountNumber: string;
        ifscCode: string;
        bankName: string;
        accountHolderName: string;
    }>>;
    walletDetails: z.ZodOptional<z.ZodObject<{
        provider: z.ZodEnum<["paytm", "phonepe", "googlepay", "amazonpay"]>;
        walletId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        provider: "paytm" | "phonepe" | "googlepay" | "amazonpay";
        walletId: string;
    }, {
        provider: "paytm" | "phonepe" | "googlepay" | "amazonpay";
        walletId: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    upiId?: string | undefined;
    bankAccount?: {
        accountNumber: string;
        ifscCode: string;
        bankName: string;
        accountHolderName: string;
    } | undefined;
    walletDetails?: {
        provider: "paytm" | "phonepe" | "googlepay" | "amazonpay";
        walletId: string;
    } | undefined;
}, {
    upiId?: string | undefined;
    bankAccount?: {
        accountNumber: string;
        ifscCode: string;
        bankName: string;
        accountHolderName: string;
    } | undefined;
    walletDetails?: {
        provider: "paytm" | "phonepe" | "googlepay" | "amazonpay";
        walletId: string;
    } | undefined;
}>, {
    upiId?: string | undefined;
    bankAccount?: {
        accountNumber: string;
        ifscCode: string;
        bankName: string;
        accountHolderName: string;
    } | undefined;
    walletDetails?: {
        provider: "paytm" | "phonepe" | "googlepay" | "amazonpay";
        walletId: string;
    } | undefined;
}, {
    upiId?: string | undefined;
    bankAccount?: {
        accountNumber: string;
        ifscCode: string;
        bankName: string;
        accountHolderName: string;
    } | undefined;
    walletDetails?: {
        provider: "paytm" | "phonepe" | "googlepay" | "amazonpay";
        walletId: string;
    } | undefined;
}>;
export declare const setUpiSchema: z.ZodObject<{
    upiId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    upiId: string;
}, {
    upiId: string;
}>;
export declare const verifyUpiSchema: z.ZodObject<{
    upiId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    upiId: string;
}, {
    upiId: string;
}>;
export declare const updateFcmTokenSchema: z.ZodObject<{
    fcmToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fcmToken: string;
}, {
    fcmToken: string;
}>;
export declare const searchUsersSchema: z.ZodObject<{
    query: z.ZodString;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    query: string;
    page: number;
}, {
    query: string;
    limit?: number | undefined;
    page?: number | undefined;
}>;
export declare const upgradeRoleSchema: z.ZodObject<{
    role: z.ZodEnum<["user", "premium", "business", "admin"]>;
}, "strip", z.ZodTypeAny, {
    role: "user" | "premium" | "business" | "admin";
}, {
    role: "user" | "premium" | "business" | "admin";
}>;
//# sourceMappingURL=auth.validation.d.ts.map