# TripSplit Data Migrator

This module is responsible for migrating data from the legacy MongoDB database to the new PostgreSQL database (managed via Prisma). It uses a modular architecture comprising Connectors, Transformers, and a core Migrator to process data efficiently in batches.

## Architecture

The migrator is built on three main concepts:

1. **Connectors** (`connectors/`)
   - **`MongoConnector`**: Acts as the `ISourceConnector`. It connects to MongoDB and extracts records from a given collection in batches to prevent memory overload.
   - **`PostgresConnector`**: Acts as the `IDestinationConnector`. It connects to PostgreSQL using the Prisma Client and loads the transformed batches into the respective tables using `upsert` operations.

2. **Transformers** (`transformers/`)
   - Transformers (implementing `ITransformer`) are responsible for mapping the legacy MongoDB document structure to the new PostgreSQL schema. 
   - Example: `FinanceTransformer` handles mapping fields like `_id` to `id`, restructuring embedded arrays or objects, and ensuring types match the new Prisma schema.

3. **Core Migrator** (`core/Migrator.ts`)
   - The orchestrator that ties it all together. It takes a source connector, a destination connector, and a transformer.
   - It extracts a batch from the source, applies the transformation to each item, filters out any transformation failures, and then loads the batch into the destination.

## How It Works (End-to-End Flow)

When you execute the migrator (via `index.ts`), the following steps occur in sequence:

1. **Initialization:**
   - The script loads environment variables (like `MONGO_URI` and `DATABASE_URL`).
   - It instantiates the `MongoConnector` and `PostgresConnector` and establishes connections to both databases.

2. **Migration Pipeline Setup:**
   - For each entity type (e.g., Transactions, Budgets, Bills), it instantiates a corresponding `Transformer` (e.g., `FinanceTransformer`).
   - It creates a `Migrator` instance by passing the source, destination, the specific transformer, and a dry-run flag.
   
3. **Data Processing (Per Entity):**
   - The `Migrator` calls the source's `extract` method, which fetches records from MongoDB in manageable batches (defaulting to chunks of 100).
   - **Transformation Phase:** For every batch, each record is passed through the `Transformer`. The transformer maps fields, fixes data types (e.g., mapping MongoDB ObjectIds to string `id`s, or mapping dates), and ensures the shape matches the target Prisma schema. If a record fails to transform, the error is logged, and that specific record is skipped (filtering out `null`s).
   - **Loading Phase:** The transformed batch is handed over to the destination connector's `load` method. The `PostgresConnector` uses Prisma's `upsert` functionality to insert new records or update existing ones (based on the `id`). This ensures the script is idempotent and can be run multiple times without duplicating data.
   - The migrator logs the progress (e.g., `✅ Processed 100 records...`) as batches complete.

4. **Completion:**
   - Once all batches for an entity are processed, it moves to the next entity.
   - Finally, it safely disconnects from both databases and exits.

## Environment Variables

The migrator relies on the root `.env` file of the `wakeru` project. Ensure the following are set:

- `MONGO_URI`: The connection string for the legacy MongoDB database (defaults to `mongodb://localhost:27017/tripsplit`).
- `DATABASE_URL`: The connection string for the new PostgreSQL database used by Prisma. **(Required)**

## Usage

To run the migration, you can execute the `index.ts` script.

### Standard Run

This will extract, transform, and insert/update all configured collections into the PostgreSQL database.

```bash
npx ts-node scripts/migrator/index.ts
```

### Dry Run

If you want to test the transformation logic without actually writing data to PostgreSQL, use the `--dry-run` flag. This will print the first transformed item of each collection to the console and skip the load step.

```bash
npx ts-node scripts/migrator/index.ts --dry-run
```

## Adding a New Migration

1. **Create/Update a Transformer**: If the new entity has a different schema, create a new transformer in the `transformers/` directory (e.g., `UserTransformer.ts`).
2. **Add to `index.ts`**: Instantiate your transformer and create a new `Migrator` instance in the `main` function of `index.ts`.
3. **Execute**: Call `.run('source_collection_name', 'DestinationModelName')` on your new migrator instance.

```typescript
// Example for migrating Users
const userTransformer = new UserTransformer();
const userMigrator = new Migrator(source, dest, userTransformer, dryRun);
await userMigrator.run('users', 'User');
```
