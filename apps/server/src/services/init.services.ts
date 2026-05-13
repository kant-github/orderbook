import chalk from "chalk";
import RedisService from "./cache.services";
import { ENV } from "../config/env.config";

export default class ApiService {
    public redis_cache!: RedisService;

    constructor() { }

    public init_sub_services() {
        this.redis_cache = new RedisService();
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