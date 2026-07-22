import { Document, Model, FilterQuery, UpdateQuery } from 'mongoose';

/**
 * Base Repository Pattern
 * 
 * WHY THIS EXISTS:
 * This acts as a bridge between our business logic (Services) and our database (Mongoose).
 * If we ever want to switch from MongoDB (Mongoose) to PostgreSQL (Prisma), we ONLY 
 * have to rewrite this file. The rest of the application (hundreds of service functions) 
 * will not need to change because they all call these standard methods.
 */
export class BaseRepository<T extends Document> {
  protected readonly model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  /**
   * Find a single document by ID
   */
  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).lean().exec() as Promise<T | null>;
  }

  /**
   * Find a single document matching a filter
   */
  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne(filter).lean().exec() as Promise<T | null>;
  }

  /**
   * Find all documents matching a filter
   */
  async find(filter: FilterQuery<T> = {}): Promise<T[]> {
    return this.model.find(filter).lean().exec() as unknown as Promise<T[]>;
  }

  /**
   * Create a new document
   */
  async create(data: Partial<T>): Promise<T> {
    const document = new this.model(data);
    return document.save() as unknown as Promise<T>;
  }

  /**
   * Update an existing document
   */
  async update(id: string, updateData: UpdateQuery<T>): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(id, updateData, { new: true })
      .lean()
      .exec() as Promise<T | null>;
  }

  /**
   * Delete a document
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return result !== null;
  }

  /**
   * Count documents matching a filter
   */
  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }
}
