import chalk from "chalk";
import z from "zod";

const env_schema = z.object({
    SERVER_PORT: z.coerce.number().min(1000).max(9999),
    SERVER_DEV_TYPE: z.enum(['development', 'production', 'test']).default('development'),
    SERVER_REDIS_HOST: z.string().default('localhost'),
    SERVER_REDIS_PORT: z.coerce.number().min(1).max(65535).default(6379),
    SERVER_REDIS_PASSWORD: z.string().optional(),
    SERVER_DATABASE_URL: z.string(),
});

export let ENV: z.infer<typeof env_schema>;


export function parse_env() {
    try {
        ENV = env_schema.parse(process.env);
    } catch (err) {
        console.error(chalk.red("error while parsing the api env configs"));
        process.exit(1);
    }
}
