import bcrypt from "bcryptjs";
import { pool } from "./db";

async function seed() {
  const password = "Password@123";
  const hash = await bcrypt.hash(password, 10);

  const users = [
    { name: "Admin User", email: "admin@erp.com", role: "ADMIN" },
    { name: "Sales User", email: "sales@erp.com", role: "SALES" },
    { name: "Warehouse User", email: "warehouse@erp.com", role: "WAREHOUSE" },
    { name: "Accounts User", email: "accounts@erp.com", role: "ACCOUNTS" },
  ];

  for (const u of users) {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, hash, u.role]
    );
  }

  // Sample customers
  const adminId = (await pool.query(`SELECT id FROM users WHERE email='admin@erp.com'`)).rows[0].id;

  await pool.query(
    `INSERT INTO customers (customer_name, mobile, email, business_name, customer_type, status, created_by)
     VALUES
      ('Rajesh Kumar', '9876543210', 'rajesh@sharmastores.com', 'Sharma Stores', 'RETAIL', 'ACTIVE', $1),
      ('Priya Traders', '9812345678', 'contact@priyatraders.com', 'Priya Traders', 'WHOLESALE', 'ACTIVE', $1),
      ('Metro Distributors', '9900112233', 'sales@metrodist.com', 'Metro Distributors', 'DISTRIBUTOR', 'LEAD', $1)
     ON CONFLICT DO NOTHING`,
    [adminId]
  );

  // Sample products
  await pool.query(
    `INSERT INTO products (product_name, sku, category, unit_price, current_stock, min_stock_alert, location)
     VALUES
      ('Basmati Rice 25kg', 'RICE-BAS-25', 'Grains', 1850.00, 120, 20, 'Rack A1'),
      ('Sunflower Oil 15L', 'OIL-SUN-15', 'Edible Oil', 1650.00, 8, 15, 'Rack B2'),
      ('Wheat Flour 50kg', 'FLOUR-WHT-50', 'Grains', 1450.00, 60, 10, 'Rack A2'),
      ('Sugar 50kg', 'SUGAR-50', 'Essentials', 2200.00, 40, 10, 'Rack C1')
     ON CONFLICT (sku) DO NOTHING`
  );

  console.log("Seed complete.");
  console.log("Login with any of these (password: Password@123):");
  users.forEach((u) => console.log(`  ${u.email}  [${u.role}]`));

  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});