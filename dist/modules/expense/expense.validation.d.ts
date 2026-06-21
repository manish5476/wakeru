import { z } from 'zod';
export declare const equalSplitInputSchema: z.ZodObject<{
    method: z.ZodLiteral<"equal">;
    memberIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    memberIds: string[];
    method: "equal";
}, {
    memberIds: string[];
    method: "equal";
}>;
export declare const percentageSplitInputSchema: z.ZodObject<{
    method: z.ZodLiteral<"percentage">;
    members: z.ZodEffects<z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
        userId: z.ZodString;
        displayName: z.ZodString;
    }, {
        percentage: z.ZodNumber;
    }>, "strip", z.ZodTypeAny, {
        displayName: string;
        userId: string;
        percentage: number;
    }, {
        displayName: string;
        userId: string;
        percentage: number;
    }>, "many">, {
        displayName: string;
        userId: string;
        percentage: number;
    }[], {
        displayName: string;
        userId: string;
        percentage: number;
    }[]>;
}, "strip", z.ZodTypeAny, {
    members: {
        displayName: string;
        userId: string;
        percentage: number;
    }[];
    method: "percentage";
}, {
    members: {
        displayName: string;
        userId: string;
        percentage: number;
    }[];
    method: "percentage";
}>;
export declare const exactSplitInputSchema: z.ZodObject<{
    method: z.ZodLiteral<"exact">;
    members: z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
        userId: z.ZodString;
        displayName: z.ZodString;
    }, {
        amountLocal: z.ZodNumber;
    }>, "strip", z.ZodTypeAny, {
        displayName: string;
        userId: string;
        amountLocal: number;
    }, {
        displayName: string;
        userId: string;
        amountLocal: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    members: {
        displayName: string;
        userId: string;
        amountLocal: number;
    }[];
    method: "exact";
}, {
    members: {
        displayName: string;
        userId: string;
        amountLocal: number;
    }[];
    method: "exact";
}>;
export declare const sharesSplitInputSchema: z.ZodObject<{
    method: z.ZodLiteral<"shares">;
    members: z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
        userId: z.ZodString;
        displayName: z.ZodString;
    }, {
        shares: z.ZodNumber;
    }>, "strip", z.ZodTypeAny, {
        displayName: string;
        userId: string;
        shares: number;
    }, {
        displayName: string;
        userId: string;
        shares: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    members: {
        displayName: string;
        userId: string;
        shares: number;
    }[];
    method: "shares";
}, {
    members: {
        displayName: string;
        userId: string;
        shares: number;
    }[];
    method: "shares";
}>;
export declare const personalSplitInputSchema: z.ZodObject<{
    method: z.ZodLiteral<"personal">;
}, "strip", z.ZodTypeAny, {
    method: "personal";
}, {
    method: "personal";
}>;
export declare const splitInputSchema: z.ZodDiscriminatedUnion<"method", [z.ZodObject<{
    method: z.ZodLiteral<"equal">;
    memberIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    memberIds: string[];
    method: "equal";
}, {
    memberIds: string[];
    method: "equal";
}>, z.ZodObject<{
    method: z.ZodLiteral<"percentage">;
    members: z.ZodEffects<z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
        userId: z.ZodString;
        displayName: z.ZodString;
    }, {
        percentage: z.ZodNumber;
    }>, "strip", z.ZodTypeAny, {
        displayName: string;
        userId: string;
        percentage: number;
    }, {
        displayName: string;
        userId: string;
        percentage: number;
    }>, "many">, {
        displayName: string;
        userId: string;
        percentage: number;
    }[], {
        displayName: string;
        userId: string;
        percentage: number;
    }[]>;
}, "strip", z.ZodTypeAny, {
    members: {
        displayName: string;
        userId: string;
        percentage: number;
    }[];
    method: "percentage";
}, {
    members: {
        displayName: string;
        userId: string;
        percentage: number;
    }[];
    method: "percentage";
}>, z.ZodObject<{
    method: z.ZodLiteral<"exact">;
    members: z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
        userId: z.ZodString;
        displayName: z.ZodString;
    }, {
        amountLocal: z.ZodNumber;
    }>, "strip", z.ZodTypeAny, {
        displayName: string;
        userId: string;
        amountLocal: number;
    }, {
        displayName: string;
        userId: string;
        amountLocal: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    members: {
        displayName: string;
        userId: string;
        amountLocal: number;
    }[];
    method: "exact";
}, {
    members: {
        displayName: string;
        userId: string;
        amountLocal: number;
    }[];
    method: "exact";
}>, z.ZodObject<{
    method: z.ZodLiteral<"shares">;
    members: z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
        userId: z.ZodString;
        displayName: z.ZodString;
    }, {
        shares: z.ZodNumber;
    }>, "strip", z.ZodTypeAny, {
        displayName: string;
        userId: string;
        shares: number;
    }, {
        displayName: string;
        userId: string;
        shares: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    members: {
        displayName: string;
        userId: string;
        shares: number;
    }[];
    method: "shares";
}, {
    members: {
        displayName: string;
        userId: string;
        shares: number;
    }[];
    method: "shares";
}>, z.ZodObject<{
    method: z.ZodLiteral<"personal">;
}, "strip", z.ZodTypeAny, {
    method: "personal";
}, {
    method: "personal";
}>]>;
export declare const createExpenseSchema: z.ZodObject<{
    stopId: z.ZodString;
    title: z.ZodString;
    category: z.ZodDefault<z.ZodEnum<["food", "stay", "transport", "activity", "shopping", "health", "other"]>>;
    amountLocal: z.ZodNumber;
    paidBy: z.ZodString;
    date: z.ZodDefault<z.ZodDate>;
    notes: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodObject<{
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        latitude: number;
        longitude: number;
        name?: string | undefined;
    }, {
        latitude: number;
        longitude: number;
        name?: string | undefined;
    }>>;
    split: z.ZodDiscriminatedUnion<"method", [z.ZodObject<{
        method: z.ZodLiteral<"equal">;
        memberIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        memberIds: string[];
        method: "equal";
    }, {
        memberIds: string[];
        method: "equal";
    }>, z.ZodObject<{
        method: z.ZodLiteral<"percentage">;
        members: z.ZodEffects<z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
            userId: z.ZodString;
            displayName: z.ZodString;
        }, {
            percentage: z.ZodNumber;
        }>, "strip", z.ZodTypeAny, {
            displayName: string;
            userId: string;
            percentage: number;
        }, {
            displayName: string;
            userId: string;
            percentage: number;
        }>, "many">, {
            displayName: string;
            userId: string;
            percentage: number;
        }[], {
            displayName: string;
            userId: string;
            percentage: number;
        }[]>;
    }, "strip", z.ZodTypeAny, {
        members: {
            displayName: string;
            userId: string;
            percentage: number;
        }[];
        method: "percentage";
    }, {
        members: {
            displayName: string;
            userId: string;
            percentage: number;
        }[];
        method: "percentage";
    }>, z.ZodObject<{
        method: z.ZodLiteral<"exact">;
        members: z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
            userId: z.ZodString;
            displayName: z.ZodString;
        }, {
            amountLocal: z.ZodNumber;
        }>, "strip", z.ZodTypeAny, {
            displayName: string;
            userId: string;
            amountLocal: number;
        }, {
            displayName: string;
            userId: string;
            amountLocal: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        members: {
            displayName: string;
            userId: string;
            amountLocal: number;
        }[];
        method: "exact";
    }, {
        members: {
            displayName: string;
            userId: string;
            amountLocal: number;
        }[];
        method: "exact";
    }>, z.ZodObject<{
        method: z.ZodLiteral<"shares">;
        members: z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
            userId: z.ZodString;
            displayName: z.ZodString;
        }, {
            shares: z.ZodNumber;
        }>, "strip", z.ZodTypeAny, {
            displayName: string;
            userId: string;
            shares: number;
        }, {
            displayName: string;
            userId: string;
            shares: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        members: {
            displayName: string;
            userId: string;
            shares: number;
        }[];
        method: "shares";
    }, {
        members: {
            displayName: string;
            userId: string;
            shares: number;
        }[];
        method: "shares";
    }>, z.ZodObject<{
        method: z.ZodLiteral<"personal">;
    }, "strip", z.ZodTypeAny, {
        method: "personal";
    }, {
        method: "personal";
    }>]>;
}, "strip", z.ZodTypeAny, {
    date: Date;
    split: {
        memberIds: string[];
        method: "equal";
    } | {
        members: {
            displayName: string;
            userId: string;
            percentage: number;
        }[];
        method: "percentage";
    } | {
        members: {
            displayName: string;
            userId: string;
            amountLocal: number;
        }[];
        method: "exact";
    } | {
        members: {
            displayName: string;
            userId: string;
            shares: number;
        }[];
        method: "shares";
    } | {
        method: "personal";
    };
    title: string;
    stopId: string;
    amountLocal: number;
    category: "food" | "stay" | "transport" | "activity" | "shopping" | "health" | "other";
    paidBy: string;
    location?: {
        latitude: number;
        longitude: number;
        name?: string | undefined;
    } | undefined;
    notes?: string | undefined;
}, {
    split: {
        memberIds: string[];
        method: "equal";
    } | {
        members: {
            displayName: string;
            userId: string;
            percentage: number;
        }[];
        method: "percentage";
    } | {
        members: {
            displayName: string;
            userId: string;
            amountLocal: number;
        }[];
        method: "exact";
    } | {
        members: {
            displayName: string;
            userId: string;
            shares: number;
        }[];
        method: "shares";
    } | {
        method: "personal";
    };
    title: string;
    stopId: string;
    amountLocal: number;
    paidBy: string;
    date?: Date | undefined;
    location?: {
        latitude: number;
        longitude: number;
        name?: string | undefined;
    } | undefined;
    notes?: string | undefined;
    category?: "food" | "stay" | "transport" | "activity" | "shopping" | "health" | "other" | undefined;
}>;
export declare const updateExpenseSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["food", "stay", "transport", "activity", "shopping", "health", "other"]>>;
    notes: z.ZodOptional<z.ZodString>;
    date: z.ZodOptional<z.ZodDate>;
    amountLocal: z.ZodOptional<z.ZodNumber>;
    paidBy: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodObject<{
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        latitude: number;
        longitude: number;
        name?: string | undefined;
    }, {
        latitude: number;
        longitude: number;
        name?: string | undefined;
    }>>;
    split: z.ZodOptional<z.ZodDiscriminatedUnion<"method", [z.ZodObject<{
        method: z.ZodLiteral<"equal">;
        memberIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        memberIds: string[];
        method: "equal";
    }, {
        memberIds: string[];
        method: "equal";
    }>, z.ZodObject<{
        method: z.ZodLiteral<"percentage">;
        members: z.ZodEffects<z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
            userId: z.ZodString;
            displayName: z.ZodString;
        }, {
            percentage: z.ZodNumber;
        }>, "strip", z.ZodTypeAny, {
            displayName: string;
            userId: string;
            percentage: number;
        }, {
            displayName: string;
            userId: string;
            percentage: number;
        }>, "many">, {
            displayName: string;
            userId: string;
            percentage: number;
        }[], {
            displayName: string;
            userId: string;
            percentage: number;
        }[]>;
    }, "strip", z.ZodTypeAny, {
        members: {
            displayName: string;
            userId: string;
            percentage: number;
        }[];
        method: "percentage";
    }, {
        members: {
            displayName: string;
            userId: string;
            percentage: number;
        }[];
        method: "percentage";
    }>, z.ZodObject<{
        method: z.ZodLiteral<"exact">;
        members: z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
            userId: z.ZodString;
            displayName: z.ZodString;
        }, {
            amountLocal: z.ZodNumber;
        }>, "strip", z.ZodTypeAny, {
            displayName: string;
            userId: string;
            amountLocal: number;
        }, {
            displayName: string;
            userId: string;
            amountLocal: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        members: {
            displayName: string;
            userId: string;
            amountLocal: number;
        }[];
        method: "exact";
    }, {
        members: {
            displayName: string;
            userId: string;
            amountLocal: number;
        }[];
        method: "exact";
    }>, z.ZodObject<{
        method: z.ZodLiteral<"shares">;
        members: z.ZodArray<z.ZodObject<z.objectUtil.extendShape<{
            userId: z.ZodString;
            displayName: z.ZodString;
        }, {
            shares: z.ZodNumber;
        }>, "strip", z.ZodTypeAny, {
            displayName: string;
            userId: string;
            shares: number;
        }, {
            displayName: string;
            userId: string;
            shares: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        members: {
            displayName: string;
            userId: string;
            shares: number;
        }[];
        method: "shares";
    }, {
        members: {
            displayName: string;
            userId: string;
            shares: number;
        }[];
        method: "shares";
    }>, z.ZodObject<{
        method: z.ZodLiteral<"personal">;
    }, "strip", z.ZodTypeAny, {
        method: "personal";
    }, {
        method: "personal";
    }>]>>;
}, "strip", z.ZodTypeAny, {
    date?: Date | undefined;
    split?: {
        memberIds: string[];
        method: "equal";
    } | {
        members: {
            displayName: string;
            userId: string;
            percentage: number;
        }[];
        method: "percentage";
    } | {
        members: {
            displayName: string;
            userId: string;
            amountLocal: number;
        }[];
        method: "exact";
    } | {
        members: {
            displayName: string;
            userId: string;
            shares: number;
        }[];
        method: "shares";
    } | {
        method: "personal";
    } | undefined;
    location?: {
        latitude: number;
        longitude: number;
        name?: string | undefined;
    } | undefined;
    notes?: string | undefined;
    title?: string | undefined;
    amountLocal?: number | undefined;
    category?: "food" | "stay" | "transport" | "activity" | "shopping" | "health" | "other" | undefined;
    paidBy?: string | undefined;
}, {
    date?: Date | undefined;
    split?: {
        memberIds: string[];
        method: "equal";
    } | {
        members: {
            displayName: string;
            userId: string;
            percentage: number;
        }[];
        method: "percentage";
    } | {
        members: {
            displayName: string;
            userId: string;
            amountLocal: number;
        }[];
        method: "exact";
    } | {
        members: {
            displayName: string;
            userId: string;
            shares: number;
        }[];
        method: "shares";
    } | {
        method: "personal";
    } | undefined;
    location?: {
        latitude: number;
        longitude: number;
        name?: string | undefined;
    } | undefined;
    notes?: string | undefined;
    title?: string | undefined;
    amountLocal?: number | undefined;
    category?: "food" | "stay" | "transport" | "activity" | "shopping" | "health" | "other" | undefined;
    paidBy?: string | undefined;
}>;
export declare const expenseListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    category: z.ZodOptional<z.ZodEnum<["food", "stay", "transport", "activity", "shopping", "health", "other"]>>;
    paidBy: z.ZodOptional<z.ZodString>;
    isSettled: z.ZodOptional<z.ZodEffects<z.ZodEnum<["true", "false"]>, boolean, "true" | "false">>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
    sortBy: z.ZodDefault<z.ZodEnum<["date", "amountBase", "amountLocal", "createdAt"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    sortBy: "createdAt" | "date" | "amountBase" | "amountLocal";
    sortOrder: "asc" | "desc";
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    category?: "food" | "stay" | "transport" | "activity" | "shopping" | "health" | "other" | undefined;
    paidBy?: string | undefined;
    isSettled?: boolean | undefined;
}, {
    limit?: number | undefined;
    page?: number | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    category?: "food" | "stay" | "transport" | "activity" | "shopping" | "health" | "other" | undefined;
    paidBy?: string | undefined;
    isSettled?: "true" | "false" | undefined;
    sortBy?: "createdAt" | "date" | "amountBase" | "amountLocal" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const expenseParamSchema: z.ZodObject<{
    expenseId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    expenseId: string;
}, {
    expenseId: string;
}>;
export declare const stopExpenseParamSchema: z.ZodObject<{
    stopId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    stopId: string;
}, {
    stopId: string;
}>;
export declare const tripExpenseParamSchema: z.ZodObject<{
    tripId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tripId: string;
}, {
    tripId: string;
}>;
export declare const markSplitPaidParamSchema: z.ZodObject<{
    expenseId: z.ZodString;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userId: string;
    expenseId: string;
}, {
    userId: string;
    expenseId: string;
}>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
export type SplitInput = z.infer<typeof splitInputSchema>;
//# sourceMappingURL=expense.validation.d.ts.map