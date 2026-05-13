import type { Request, Response } from "express";
import z from "zod";
import jwt from "jsonwebtoken";
import ResponseWriter from "../class/response_writer";
import chalk from "chalk";
import { prisma } from "@repo/database"
import { ENV } from "../config/env.config";

export interface UserType {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

export default class UserRegistrationController {

    static oauth_login_schema = z.object({
        email: z.email(),
        name: z.string(),
        image: z.url().optional(),
    })

    static async process_login(req: Request, res: Response) {
        try {
            const parsed_data = UserRegistrationController.oauth_login_schema.safeParse(req.body.user);
            console.log(chalk.blue("Received login data:"), parsed_data);
            if (!parsed_data.success) {
                ResponseWriter.invalid_data(res, "Invalid request data");
                return;
            }

            const new_user = await prisma.user.upsert({
                where: { email: parsed_data.data.email },
                update: { name: parsed_data.data.name, image: parsed_data.data.image },
                create: parsed_data.data,
            });
            const token_object: UserType = {
                id: new_user.id,
                name: new_user.name,
                email: new_user.email,
                image: new_user.image,
            }
            const token = jwt.sign(token_object, ENV.SERVER_JWT_SECRET, { expiresIn: "1h" });

            ResponseWriter.success(res, { user: new_user, token }, "Login successful");

        } catch (err) {
            console.error(chalk.red("Error in process_login:"), err);
            ResponseWriter.system_error(res);
        }
    }

}
