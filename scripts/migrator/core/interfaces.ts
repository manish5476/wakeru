export interface IConnectorConfig {
  uri: string;
  options?: any;
}

export interface ISourceConnector {
  name: string;
  connect(config: IConnectorConfig): Promise<void>;
  disconnect(): Promise<void>;
  /**
   * Extract data in batches to prevent memory overload.
   */
  extract(collectionName: string, batchSize: number, onBatch: (data: any[]) => Promise<void>): Promise<void>;
}

export interface IDestinationConnector {
  name: string;
  connect(config: IConnectorConfig): Promise<void>;
  disconnect(): Promise<void>;
  /**
   * Load a batch of data into the destination.
   */
  load(tableName: string, data: any[]): Promise<void>;
}

export interface ITransformer {
  name: string;
  /**
   * Transform the data from the source shape to the destination shape.
   */
  transform(data: any): any;
}
