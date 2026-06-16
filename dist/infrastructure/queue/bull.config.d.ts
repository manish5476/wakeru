import Bull from 'bull';
export declare class QueueManager {
    private static queues;
    static getQueue(queueName: string): Bull.Queue;
    static closeAll(): Promise<void>;
}
//# sourceMappingURL=bull.config.d.ts.map