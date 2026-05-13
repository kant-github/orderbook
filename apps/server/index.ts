import express from "express";
import ApiService from "./src/services/init.services";
import user_router from "./src/router/user.router";
import { ENV, parse_env } from "./src/config/env.config";

parse_env();

export const services = new ApiService();
services.init_sub_services();

const app = express();

app.use(express.json());
app.use("/api/v1/users", user_router);

app.listen(ENV.SERVER_PORT, () => {
    services.log_server_boot();
});
