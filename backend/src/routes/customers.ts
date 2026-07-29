import { Router } from "express";
import { query } from "../db";
import { customerSchema, followupSchema } from "../schemas";
import { authenticate, requireRole } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

/** GET /customers?search=&status=&type=&page=&limit=  (all roles can view) */
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "10"))));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (req.query.search) {
      params.push(`%${String(req.query.search).toLowerCase()}%`);
      conditions.push(
        `(LOWER(customer_name) LIKE $${params.length} OR mobile LIKE $${params.length} OR LOWER(business_name) LIKE $${params.length})`
      );
    }
    if (req.query.status) {
      params.push(String(req.query.status).toUpperCase());
      conditions.push(`status = $${params.length}`);
    }
    if (req.query.type) {
      params.push(String(req.query.type).toUpperCase());
      conditions.push(`customer_type = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const count = await query(`SELECT COUNT(*) FROM customers ${where}`, params);
    const data = await query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({
      data: data.rows,
      pagination: { page, limit, total: parseInt(count.rows[0].count), pages: Math.ceil(parseInt(count.rows[0].count) / limit) },
    });
  } catch (e) {
    next(e);
  }
});

/** GET /customers/:id - detail page incl. follow-ups */
router.get("/:id", async (req, res, next) => {
  try {
    const c = await query("SELECT * FROM customers WHERE id = $1", [req.params.id]);
    if (!c.rows[0]) throw new HttpError(404, "Customer not found");
    const followups = await query(
      `SELECT f.*, u.name AS created_by_name
       FROM customer_followups f LEFT JOIN users u ON u.id = f.created_by
       WHERE f.customer_id = $1 ORDER BY f.created_at DESC`,
      [req.params.id]
    );
    res.json({ ...c.rows[0], followups: followups.rows });
  } catch (e) {
    next(e);
  }
});

/** POST /customers (SALES or ADMIN) */
router.post("/", requireRole("SALES"), async (req, res, next) => {
  try {
    const d = customerSchema.parse(req.body);
    const result = await query(
      `INSERT INTO customers (customer_name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [d.customer_name, d.mobile, d.email || null, d.business_name || null, d.gst_number || null,
       d.customer_type, d.address || null, d.status, d.follow_up_date || null, d.notes || null, req.user!.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    next(e);
  }
});

/** PUT /customers/:id (SALES or ADMIN) */
router.put("/:id", requireRole("SALES"), async (req, res, next) => {
  try {
    const d = customerSchema.parse(req.body);
    const result = await query(
      `UPDATE customers SET customer_name=$1, mobile=$2, email=$3, business_name=$4, gst_number=$5,
       customer_type=$6, address=$7, status=$8, follow_up_date=$9, notes=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [d.customer_name, d.mobile, d.email || null, d.business_name || null, d.gst_number || null,
       d.customer_type, d.address || null, d.status, d.follow_up_date || null, d.notes || null, req.params.id]
    );
    if (!result.rows[0]) throw new HttpError(404, "Customer not found");
    res.json(result.rows[0]);
  } catch (e) {
    next(e);
  }
});

/** POST /customers/:id/followups (SALES or ADMIN) */
router.post("/:id/followups", requireRole("SALES"), async (req, res, next) => {
  try {
    const { note } = followupSchema.parse(req.body);
    const exists = await query("SELECT id FROM customers WHERE id = $1", [req.params.id]);
    if (!exists.rows[0]) throw new HttpError(404, "Customer not found");
    const result = await query(
      `INSERT INTO customer_followups (customer_id, note, created_by) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, note, req.user!.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;