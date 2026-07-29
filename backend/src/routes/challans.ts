import { Router } from "express";
import { PoolClient } from "pg";
import { pool, query } from "../db";
import { challanSchema } from "../schemas";
import { authenticate, requireRole } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

/** Generates a challan number like CH-20260728-0001 */
async function nextChallanNumber(client: PoolClient): Promise<string> {
  const seq = await client.query("SELECT nextval('challan_number_seq') AS n");
  const n = String(seq.rows[0].n).padStart(4, "0");
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `CH-${date}-${n}`;
}

/**
 * Confirms a challan inside an open transaction:
 * - locks product rows (FOR UPDATE) to prevent race conditions
 * - validates stock never goes negative (400 error if insufficient)
 * - reduces stock and writes OUT movements
 */
async function confirmChallanStock(client: PoolClient, challanId: number, userId: number) {
  const items = await client.query("SELECT * FROM challan_items WHERE challan_id = $1", [challanId]);
  for (const item of items.rows) {
    const p = await client.query("SELECT * FROM products WHERE id = $1 FOR UPDATE", [item.product_id]);
    if (!p.rows[0]) throw new HttpError(400, `Product ${item.product_name} no longer exists`);
    if (p.rows[0].current_stock < item.quantity) {
      throw new HttpError(
        400,
        `Insufficient stock for ${item.product_name} (${item.sku}). Available: ${p.rows[0].current_stock}, required: ${item.quantity}`
      );
    }
    await client.query("UPDATE products SET current_stock = current_stock - $1, updated_at = NOW() WHERE id = $2", [
      item.quantity,
      item.product_id,
    ]);
    await client.query(
      `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by)
       VALUES ($1,$2,'OUT',$3,$4)`,
      [item.product_id, item.quantity, `Sales challan confirmed`, userId]
    );
  }
}

/** GET /challans?status=&search=&page=&limit= */
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "10"))));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (req.query.status) {
      params.push(String(req.query.status).toUpperCase());
      conditions.push(`c.status = $${params.length}`);
    }
    if (req.query.search) {
      params.push(`%${String(req.query.search).toLowerCase()}%`);
      conditions.push(`(LOWER(c.challan_number) LIKE $${params.length} OR LOWER(cu.customer_name) LIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const count = await query(
      `SELECT COUNT(*) FROM challans c JOIN customers cu ON cu.id = c.customer_id ${where}`,
      params
    );
    const data = await query(
      `SELECT c.*, cu.customer_name, u.name AS created_by_name
       FROM challans c
       JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN users u ON u.id = c.created_by
       ${where} ORDER BY c.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
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

/** GET /challans/:id - detail with snapshot items */
router.get("/:id", async (req, res, next) => {
  try {
    const c = await query(
      `SELECT c.*, cu.customer_name, cu.mobile, cu.business_name, u.name AS created_by_name
       FROM challans c
       JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!c.rows[0]) throw new HttpError(404, "Challan not found");
    const items = await query("SELECT * FROM challan_items WHERE challan_id = $1 ORDER BY id", [req.params.id]);
    res.json({ ...c.rows[0], items: items.rows });
  } catch (e) {
    next(e);
  }
});

/** POST /challans (SALES or ADMIN) - creates DRAFT or directly CONFIRMED */
router.post("/", requireRole("SALES"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const d = challanSchema.parse(req.body);
    await client.query("BEGIN");

    const cust = await client.query("SELECT id FROM customers WHERE id = $1", [d.customer_id]);
    if (!cust.rows[0]) throw new HttpError(404, "Customer not found");

    const challanNumber = await nextChallanNumber(client);
    const totalQty = d.items.reduce((s, i) => s + i.quantity, 0);

    const challan = await client.query(
      `INSERT INTO challans (challan_number, customer_id, total_quantity, status, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [challanNumber, d.customer_id, totalQty, d.status, req.user!.id]
    );

    // Store PRODUCT SNAPSHOT data (name, sku, price at this moment), not only the id
    for (const item of d.items) {
      const p = await client.query("SELECT * FROM products WHERE id = $1", [item.product_id]);
      if (!p.rows[0]) throw new HttpError(404, `Product id ${item.product_id} not found`);
      await client.query(
        `INSERT INTO challan_items (challan_id, product_id, product_name, sku, unit_price, quantity)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [challan.rows[0].id, p.rows[0].id, p.rows[0].product_name, p.rows[0].sku, p.rows[0].unit_price, item.quantity]
      );
    }

    if (d.status === "CONFIRMED") {
      await confirmChallanStock(client, challan.rows[0].id, req.user!.id);
    }

    await client.query("COMMIT");
    res.status(201).json(challan.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

/** PATCH /challans/:id/status (SALES or ADMIN) - DRAFT -> CONFIRMED / CANCELLED */
router.patch("/:id/status", requireRole("SALES"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const target = String(req.body.status || "").toUpperCase();
    if (!["CONFIRMED", "CANCELLED"].includes(target)) {
      throw new HttpError(400, "status must be CONFIRMED or CANCELLED");
    }
    await client.query("BEGIN");
    const c = await client.query("SELECT * FROM challans WHERE id = $1 FOR UPDATE", [req.params.id]);
    if (!c.rows[0]) throw new HttpError(404, "Challan not found");
    if (c.rows[0].status !== "DRAFT") {
      throw new HttpError(400, `Only DRAFT challans can be updated. Current status: ${c.rows[0].status}`);
    }
    if (target === "CONFIRMED") {
      await confirmChallanStock(client, c.rows[0].id, req.user!.id);
    }
    const updated = await client.query(
      "UPDATE challans SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [target, req.params.id]
    );
    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

export default router;