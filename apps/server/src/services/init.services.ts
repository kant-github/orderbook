import chalk from "chalk";
import { ENV } from "../config/env.config";
import KafkaService from "./kafka.services";

export default class ApiService {
    public kafka_service: KafkaService;

    constructor() {
        this.kafka_service = new KafkaService();
    }

    public async start() {
        await this.kafka_service.connect();
    }

    public async shutdown() {
        await this.kafka_service.disconnect();
    }

    public async log_server_boot() {
        const url = `http://localhost:${ENV.SERVER_PORT}`;
        const started_at = new Date().toLocaleTimeString();

        const lines = [
            `${chalk.bold.green('●')} ${chalk.bold.white('Curenza Server')}      ${chalk.dim('status')}  ${chalk.green('online')}`,
            `${chalk.dim('│')} ${chalk.dim('url   ')}  ${chalk.cyan.underline(url)}`,
            `${chalk.dim('│')} ${chalk.dim('env   ')}  ${chalk.yellow(ENV.SERVER_DEV_TYPE)}`,
            `${chalk.dim('│')} ${chalk.dim('time  ')}  ${chalk.white(started_at)}`,
        ];

        const width = 56;
        const top = chalk.green('┏' + '━'.repeat(width) + '┓');
        const bottom = chalk.green('┗' + '━'.repeat(width) + '┛');
        const side = chalk.green('┃');

        const pad = (s: string) => {
            const visible = s.replace(/\x1b\[[0-9;]*m/g, '');
            const space = Math.max(0, width - 2 - visible.length);
            return `${side}  ${s}${' '.repeat(space)}${side}`;
        };

        console.log();
        console.log(top);
        console.log(pad(''));
        for (const line of lines) console.log(pad(line));
        console.log(pad(''));
        console.log(bottom);
        console.log();
    }
}