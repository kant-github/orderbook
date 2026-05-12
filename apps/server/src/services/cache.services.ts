import Redis from "ioredis";
import { ENV } from "../config/env.config";
export default class RedisService {
    public redis: Redis;

    constructor() {
        this.redis = new Redis({
            host: ENV.SERVER_REDIS_HOST,
            port: ENV.SERVER_REDIS_PORT,
            password: ENV.SERVER_REDIS_PASSWORD,
        });
    }
}