import { ISourceConnector, IDestinationConnector, ITransformer } from './interfaces';

export class Migrator {
  private source: ISourceConnector;
  private dest: IDestinationConnector;
  private transformer: ITransformer;
  private dryRun: boolean;

  constructor(
    source: ISourceConnector,
    dest: IDestinationConnector,
    transformer: ITransformer,
    dryRun: boolean = false
  ) {
    this.source = source;
    this.dest = dest;
    this.transformer = transformer;
    this.dryRun = dryRun;
  }

  async run(sourceCollection: string, destTable: string) {
    console.log(`🚀 Starting Migration from [${this.source.name}] to [${this.dest.name}]`);
    console.log(`📦 Collection: ${sourceCollection} -> Table: ${destTable}`);
    if (this.dryRun) {
      console.log(`⚠️  DRY RUN ENABLED - No data will be written to destination.`);
    }

    let processedCount = 0;

    await this.source.extract(sourceCollection, 100, async (batch) => {
      // Transform batch
      const transformedBatch = batch.map((item) => {
        try {
          return this.transformer.transform(item);
        } catch (e: any) {
          console.error(`Error transforming item:`, item);
          console.error(e.message);
          return null;
        }
      }).filter(Boolean); // Remove failed transforms

      if (this.dryRun) {
        console.log(`[DRY RUN] Would load ${transformedBatch.length} records...`);
        // Example output of first transformed item
        if (transformedBatch.length > 0 && processedCount === 0) {
          console.log(`[DRY RUN] Example Transformed Item:\n`, JSON.stringify(transformedBatch[0], null, 2));
        }
      } else {
        // Load into destination
        await this.dest.load(destTable, transformedBatch);
      }

      processedCount += batch.length;
      console.log(`✅ Processed ${processedCount} records...`);
    });

    console.log(`🎉 Migration Completed Successfully! Total Records Processed: ${processedCount}`);
  }
}
