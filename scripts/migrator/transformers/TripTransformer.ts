import { ITransformer } from '../core/interfaces';

export class TripTransformer implements ITransformer {
  name = 'TripTransformer';

  transform(data: any): any {
    // Example: MongoDB -> PostgreSQL mapping
    // We rename `_id` to `id` and stringify embedded members to JSON (or they would go to a separate relational table)
    
    return {
      id: data._id?.toString(),
      title: data.title,
      description: data.description || null,
      status: data.status,
      baseCurrency: data.baseCurrency,
      startDate: data.startDate,
      endDate: data.endDate,
      // In a real Postgres SQL setup, we would extract members and stops to their own tables
      // For this POC, we can store them as JSON or ignore them
      members: JSON.stringify(data.members || []),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}
