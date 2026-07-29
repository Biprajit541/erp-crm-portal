import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const customerSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  mobile: z.string().regex(/^\d{10}$/, "Mobile must be a 10-digit number"),
  email: z.string().email().optional().or(z.literal("")),
  business_name: z.string().optional().or(z.literal("")),
  gst_number: z.string().optional().or(z.literal("")),
  customer_type: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]),
  address: z.string().optional().or(z.literal("")),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).default("LEAD"),
  follow_up_date: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const followupSchema = z.object({
  note: z.string().min(1, "Note cannot be empty"),
});

export const productSchema = z.object({
  product_name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().optional().or(z.literal("")),
  unit_price: z.number().nonnegative("Price cannot be negative"),
  current_stock: z.number().int().nonnegative().default(0),
  min_stock_alert: z.number().int().nonnegative().default(0),
  location: z.string().optional().or(z.literal("")),
});

export const stockMovementSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive("Quantity must be greater than zero"),
  movement_type: z.enum(["IN", "OUT"]),
  reason: z.string().min(1, "Reason is required"),
});

export const challanSchema = z.object({
  customer_id: z.number().int().positive("Select a customer"),
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, "Add at least one product"),
});