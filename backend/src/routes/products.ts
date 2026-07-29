import { Router } from "express";
import { pool, query } from "../db";
import { productSchema, stockMovementSchema } from "../schemas";
import { authenticate, requireRole } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

/** GET /products?search=&category=&lowStock=true&page=&limit= */
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "10"))));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (req.query.search) {
      params.push(`%${String(req.query.search).toLowerCase()}%`);
      conditions.push(`(LOWER(product_name) LIKE $${params.length} OR LOWER(sku) LIKE $${params.length})`);
    }
    if (req.query.category) {
      params.push(String(req.query.category));
      conditions.push(`category = $${params.length}`);
    }
    if (req.query.lowStock === "true") {
      conditions.push(`current_stock <= min_stock_alert`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const count = await query(`SELECT COUNT(*) FROM products ${where}`, params);
    const data = await query(
      `SELECT * FROM products ${where} ORDER BY product_name ASC LIMIT ${limit} OFFSET ${offset}`,
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

/** GET /products/:id - detail + recent stock movements */
router.get("/:id", async (req, res, next) => {
  try {
    const p = await query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!p.rows[0]) throw new HttpError(404, "Product not found");
    const movements = await query(
      `SELECT m.*, u.name AS created_by_name
       FROM stock_movements m LEFT JOIN users u ON u.id = m.created_by
       WHERE m.product_id = $1 ORDER BY m.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ ...p.rows[0], movements: movements.rows });
  } catch (e) {
    next(e);
  }
});

/** POST /products (WAREHOUSE or ADMIN). Initial stock creates an IN movement. */
router.post("/", requireRole("WAREHOUSE"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const d = productSchema.parse(req.body);
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO products (product_name, sku, category, unit_price, current_stock, min_stock_alert, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.product_name, d.sku, d.category || null, d.unit_price, d.current_stock, d.min_stock_alert, d.location || null]
    );
    if (d.current_stock > 0) {
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by)
         VALUES ($1,$2,'IN','Initial stock on product creation',$3)`,
        [result.rows[0].id, d.current_stock, req.user!.id]
      );
    }
    await client.query("COMMIT");
    res.status(201).json(result.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

/** PUT /products/:id (WAREHOUSE or ADMIN) - edits details, NOT stock (use movements) */
router.put("/:id", requireRole("WAREHOUSE"), async (req, res, next) => {
  try {
    const d = productSchema.parse(req.body);
    const result = await query(
      `UPDATE products SET product_name=$1, sku=$2, category=$3, unit_price=$4, min_stock_alert=$5, location=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [d.product_name, d.sku, d.category || null, d.unit_price, d.min_stock_alert, d.location || null, req.params.id]
    );
    if (!result.rows[0]) throw new HttpError(404, "Product not found");
    res.json(result.rows[0]);
  } catch (e) {
    next(e);
  }
});

/** POST /products/movements (WAREHOUSE or ADMIN) - manual stock IN/OUT with log */
router.post("/movements", requireRole("WAREHOUSE"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const d = stockMovementSchema.parse(req.body);
    await client.query("BEGIN");
    const p = await client.query("SELECT * FROM products WHERE id = $1 FOR UPDATE", [d.product_id]);
    if (!p.rows[0]) throw new HttpError(404, "Product not found");

    const delta = d.movement_type === "IN" ? d.quantity : -d.quantity;
    const newStock = p.rows[0].current_stock + delta;
    if (newStock < 0) {
      throw new HttpError(400, `Insufficient stock. Available: ${p.rows[0].current_stock}, requested OUT: ${d.quantity}`);
    }
    await client.query("UPDATE products SET current_stock = $1, updated_at = NOW() WHERE id = $2", [newStock, d.product_id]);
    const mv = await client.query(
      `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [d.product_id, d.quantity, d.movement_type, d.reason, req.user!.id]
    );
    await client.query("COMMIT");
    res.status(201).json({ movement: mv.rows[0], new_stock: newStock });
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

export default router;