import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const customerSchema = z.object({
  customer_name: z.string().min(2).max(150),
  mobile: z.string().regex(/^[0-9]{10}$/, "Mobile must be a 10 digit number"),
  email: z.string().email().optional().or(z.literal("")),
  business_name: z.string().max(150).optional().or(z.literal("")),
  gst_number: z.string().max(20).optional().or(z.literal("")),
  customer_type: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]),
  address: z.string().optional().or(z.literal("")),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).default("LEAD"),
  follow_up_date: z.string().optional().nullable().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const followupSchema = z.object({
  note: z.string().min(1, "Note cannot be empty"),
});

export const productSchema = z.object({
  product_name: z.string().min(2).max(150),
  sku: z.string().min(1).max(50),
  category: z.string().max(100).optional().or(z.literal("")),
  unit_price: z.coerce.number().min(0),
  current_stock: z.coerce.number().int().min(0).default(0),
  min_stock_alert: z.coerce.number().int().min(0).default(0),
  location: z.string().max(100).optional().or(z.literal("")),
});

export const stockMovementSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
  movement_type: z.enum(["IN", "OUT"]),
  reason: z.string().min(1, "Reason is required").max(200),
});

export const challanSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
  items: z
    .array(
      z.object({
        product_id: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
      })
    )
    .min(1, "At least one product is required"),
});
