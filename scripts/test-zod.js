const { z } = require('zod');

const updateTripSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(1000).optional(),
  coverImage: z.union([z.string().url(), z.literal('')]).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  totalBudget: z.number().nonnegative().optional(),
  defaultSplitMethod: z
    .enum(['equal', 'percentage', 'exact', 'shares', 'personal'])
    .optional(),
  allowAnyPayer: z.boolean().optional(),
  allowOthersToArchiveTrip: z.boolean().optional(),
  status: z
    .enum(['planning', 'active', 'completed', 'archived'])
    .optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

const payload = {
  title: "My Trip",
  description: undefined,
  coverImage: "",
  startDate: new Date().toISOString(),
  endDate: new Date().toISOString(),
  status: "planning",
  allowAnyPayer: false,
  allowOthersToArchiveTrip: false,
};

try {
  updateTripSchema.parse(payload);
  console.log("Success");
} catch(e) {
  console.log(e.errors);
}
