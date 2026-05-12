import { Router } from "express";
import UserRegistrationController from "../controllers/signin.controller";

const router: Router = Router();

router.post("/signin", UserRegistrationController.process_login);

export default router;
