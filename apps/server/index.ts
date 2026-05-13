import express from "express";
import ApiService from "./src/services/init.services";
import user_router from "./src/router/user.router";
import { ENV, parse_env } from "./src/config/env.config";

parse_env();

export const services = new ApiService();
const app = express();

app.use(express.json());
app.use("/api/v1/users", user_router);

await services.start();

const server = app.listen(ENV.SERVER_PORT, () => {
    services.log_server_boot();
});

const shutdown = () => {
    server.close(async () => {
        await services.shutdown();
        process.exit(0);
    });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
