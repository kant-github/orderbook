import { Kafka, type Producer } from "kafkajs";
import { EventType, type CancelOrderInEvent, type NewOrderInEvent } from "@repo/types"
import { ENV } from "../config/env.config";

export default class KafkaService {
    private kafka: Kafka;
    private producer: Producer;
    private connected: boolean = false;

    constructor() {
        this.kafka = new Kafka({
            clientId: 'server',
            brokers: ENV.SERVER_KAFKA_BROKERS.split(',').map(b => b.trim()),
        });
        this.producer = this.kafka.producer({
            idempotent: true,
        });
    }

    public async connect() {
        if (this.connected) return;
        await this.producer.connect();
        this.connected = true;
    }

    public async disconnect() {
        if (!this.connected) return;
        await this.producer.disconnect();
        this.connected = false;
    }

    public async send_message(envelope: NewOrderInEvent | CancelOrderInEvent) {
        try {
            if (!this.connected) {
                throw new Error("Kafka producer is not connected");
            }
            await this.producer.send({
                topic: EventType.ORDERS_IN,
                messages: [{
                    key: envelope.payload.market,
                    value: JSON.stringify(envelope)
                }]
            })
        } catch (err) {
            console.error("Error sending message to Kafka:", err);
        }
    }
}
