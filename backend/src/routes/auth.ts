import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db";
import { loginSchema } from "../schemas";
import { authenticate } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";

const router = Router();

/** POST /auth/login - returns a JWT + user profile */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) throw new HttpError(401, "Invalid email or password");

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new HttpError(401, "Invalid email or password");

    const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    } as jwt.SignOptions);

    res.json({ token, user: payload });
  } catch (e) {
    next(e);
  }
});

/** GET /auth/me - current user from token */
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;