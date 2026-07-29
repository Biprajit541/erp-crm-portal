import { Router } from "express";
import { query } from "../db";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

/** GET /dashboard/summary - counts for the dashboard cards */
router.get("/summary", async (_req, res, next) => {
  try {
    const [customers, products, lowStock, challans, drafts] = await Promise.all([
      query("SELECT COUNT(*) FROM customers"),
      query("SELECT COUNT(*) FROM products"),
      query("SELECT COUNT(*) FROM products WHERE current_stock <= min_stock_alert"),
      query("SELECT COUNT(*) FROM challans WHERE status = 'CONFIRMED'"),
      query("SELECT COUNT(*) FROM challans WHERE status = 'DRAFT'"),
    ]);
    res.json({
      customers: parseInt(customers.rows[0].count),
      products: parseInt(products.rows[0].count),
      low_stock: parseInt(lowStock.rows[0].count),
      confirmed_challans: parseInt(challans.rows[0].count),
      draft_challans: parseInt(drafts.rows[0].count),
    });
  } catch (e) {
    next(e);
  }
});

export default router;