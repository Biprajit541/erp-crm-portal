import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireConnectApiKey } from "../middleware/apiKey";
import { HttpError } from "../middleware/errorHandler";

/**
 * Amazon Connect integration endpoints.
 *
 * Called by the AWS Lambda function in /contact-center/lambda, which is invoked
 * from the Amazon Connect contact flow (IVR). Authenticated with an API key,
 * not a user JWT.
 *
 * Privacy rule: a caller only ever hears about data linked to the phone number
 * they are calling from. Order lookups are checked against that number, and
 * "not yours" is answered exactly like "does not exist".
 */
const router = Router();
router.use(requireConnectApiKey);

/**
 * Normalises a caller number to the 10-digit format stored in customers.mobile.
 * Connect sends E.164 (e.g. "+919876543210"); people may also type "09876543210".
 * Returns null if it cannot be a valid 10-digit Indian mobile number.
 */
export function normalizePhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  // Indian mobile numbers start with 6-9
  return /^[6-9]\d{9}$/.test(last10) ? last10 : null;
}

/**
 * Converts keypad digits into a challan number.
 * Challans look like CH-20260728-0001, which a caller cannot type on a keypad,
 * so the IVR asks for the digits only: 202607280001 -> CH-20260728-0001.
 */
export function challanNumberFromDigits(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!/^\d{12,14}$/.test(digits)) return null;
  return `CH-${digits.slice(0, 8)}-${digits.slice(8)}`;
}

function requirePhone(raw: unknown): string {
  const phone = normalizePhone(raw);
  if (!phone) throw new HttpError(400, "phone must be a valid 10-digit mobile number (E.164 accepted)");
  return phone;
}

/** Finds the caller. If several customers share a number, prefer ACTIVE, then most recently updated. */
async function findCustomerByPhone(phone: string) {
  const result = await query(
    `SELECT id, customer_name, business_name, customer_type, status, follow_up_date
     FROM customers
     WHERE mobile = $1
     ORDER BY (status = 'ACTIVE') DESC, updated_at DESC`,
    [phone]
  );
  return { customer: result.rows[0] ?? null, matchCount: result.rowCount ?? 0 };
}

/**
 * GET /integrations/connect/customers/lookup?phone=+919876543210
 * Used at the start of every call: identifies the caller and gives the IVR
 * and the agent a short summary. Returns { found: false } rather than 404 so
 * the contact flow can branch on it.
 */
router.get("/customers/lookup", async (req, res, next) => {
  try {
    const phone = requirePhone(req.query.phone);
    const { customer, matchCount } = await findCustomerByPhone(phone);
    if (!customer) return res.json({ found: false });

    const stats = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'DRAFT')     AS open_challans,
         COUNT(*) FILTER (WHERE status = 'CONFIRMED') AS confirmed_challans
       FROM challans WHERE customer_id = $1`,
      [customer.id]
    );
    const latest = await query(
      `SELECT challan_number, status, total_quantity, created_at
       FROM challans WHERE customer_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [customer.id]
    );

    res.json({
      found: true,
      matchCount,
      customer: {
        id: customer.id,
        name: customer.customer_name,
        businessName: customer.business_name,
        type: customer.customer_type,
        status: customer.status,
        followUpDate: customer.follow_up_date,
      },
      openChallans: parseInt(stats.rows[0].open_challans),
      confirmedChallans: parseInt(stats.rows[0].confirmed_challans),
      latestChallan: latest.rows[0]
        ? {
            number: latest.rows[0].challan_number,
            status: latest.rows[0].status,
            totalQuantity: latest.rows[0].total_quantity,
            createdAt: latest.rows[0].created_at,
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /integrations/connect/challans/status?phone=...&digits=202607280001
 * Order status by challan number, entered on the keypad.
 * Only returns the challan if it belongs to the calling number.
 */
router.get("/challans/status", async (req, res, next) => {
  try {
    const phone = requirePhone(req.query.phone);
    const challanNumber = challanNumberFromDigits(req.query.digits);
    if (!challanNumber) {
      throw new HttpError(400, "digits must be the 12-14 numeric digits of the challan number");
    }

    const result = await query(
      `SELECT c.challan_number, c.status, c.total_quantity, c.created_at, c.updated_at
       FROM challans c
       JOIN customers cu ON cu.id = c.customer_id
       WHERE c.challan_number = $1 AND cu.mobile = $2`,
      [challanNumber, phone]
    );
    const c = result.rows[0];
    if (!c) return res.json({ found: false });

    res.json({
      found: true,
      challan: {
        number: c.challan_number,
        status: c.status,
        totalQuantity: c.total_quantity,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      },
    });
  } catch (e) {
    next(e);
  }
});

const callLogSchema = z.object({
  phone: z.string().min(10),
  // Connect contact IDs are UUIDs. Restricting the characters also keeps them
  // safe to use inside the LIKE pattern below (no % or _ wildcards).
  contactId: z.string().regex(/^[A-Za-z0-9-]{1,100}$/, "contactId must be a Connect contact ID"),
  outcome: z.enum(["SELF_SERVICE", "TRANSFERRED_TO_AGENT", "ABANDONED", "AGENT_HANDLED"]),
  menuPath: z.string().max(200).optional(),
  summary: z.string().max(2000).optional(),
});

/**
 * POST /integrations/connect/call-log
 * Writes the call into the customer's follow-up timeline, so Sales sees the
 * call in the CRM like any other interaction. Safe to retry: a second request
 * with the same Connect contactId is ignored.
 */
router.post("/call-log", async (req, res, next) => {
  try {
    const d = callLogSchema.parse(req.body);
    const phone = requirePhone(d.phone);
    const { customer } = await findCustomerByPhone(phone);
    if (!customer) return res.status(404).json({ error: "No customer with this phone number" });

    const tag = `[Amazon Connect ${d.contactId}]`;
    const existing = await query(
      `SELECT id FROM customer_followups WHERE customer_id = $1 AND note LIKE $2 || '%' LIMIT 1`,
      [customer.id, tag]
    );
    if (existing.rows[0]) {
      return res.status(200).json({ logged: false, duplicate: true, followupId: existing.rows[0].id });
    }

    const parts = [`${tag} Inbound call. Outcome: ${d.outcome}.`];
    if (d.menuPath) parts.push(`IVR path: ${d.menuPath}.`);
    if (d.summary) parts.push(`Summary: ${d.summary}`);

    const result = await query(
      `INSERT INTO customer_followups (customer_id, note, created_by) VALUES ($1, $2, NULL) RETURNING id`,
      [customer.id, parts.join(" ")]
    );
    res.status(201).json({ logged: true, followupId: result.rows[0].id });
  } catch (e) {
    next(e);
  }
});

export default router;
