import type { Request, Response } from "express";
import z, { email } from "zod";
import ResponseWriter from "../class/response_writer";
import chalk from "chalk";
import { prisma } from "@repo/database"

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

            ResponseWriter.success(res, { user: new_user }, "Login successful");

        } catch (err) {
            console.error(chalk.red("Error in process_login:"), err);
            ResponseWriter.system_error(res);
        }
    }

}
