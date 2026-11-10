/**
 * AWS Lambda for the Amazon Connect contact flow (IVR) of the ERP + CRM Portal.
 *
 * Runtime: Node.js 20.x (uses the built-in fetch, no dependencies to bundle).
 *
 * The contact flow calls this function through "Invoke AWS Lambda function"
 * blocks, passing an `action` parameter:
 *   - lookupCustomer : identify the caller by their phone number
 *   - challanStatus  : read out an order's status (needs `digits` from the keypad)
 *   - logCall        : write the call into the CRM follow-up timeline (needs `outcome`)
 *
 * Amazon Connect requires the response to be a FLAT object of string values;
 * the flow reads them as $.External.<key>. Every response has `status`
 * (OK | NOT_FOUND | INVALID_INPUT | ERROR) so the flow can branch with
 * "Check contact attributes" and route to an agent if anything goes wrong.
 *
 * Environment variables:
 *   ERP_API_BASE_URL  e.g. https://erp-crm-portal-va0y.onrender.com
 *   CONNECT_API_KEY   same value as the backend's CONNECT_API_KEY
 *   API_TIMEOUT_MS    optional, default 6000. Connect waits at most 8s for a Lambda.
 *   DEMO_CALLER_PHONE optional, DEMO ONLY. If set, every call is treated as coming from
 *                     this number (e.g. +919876543210). Useful when testing from the
 *                     agent softphone or a non-Indian number. Remove it for real use.
 */

const BASE_URL = (process.env.ERP_API_BASE_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.CONNECT_API_KEY || "";
const TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 6000);

const STATUS_SPEECH = {
  DRAFT: "is being prepared and has not been dispatched yet",
  CONFIRMED: "is confirmed and the goods have been allocated",
  CANCELLED: "has been cancelled",
};

export async function handler(event) {
  const contact = event?.Details?.ContactData ?? {};
  const params = event?.Details?.Parameters ?? {};
  const phone = process.env.DEMO_CALLER_PHONE || contact.CustomerEndpoint?.Address || "";
  const contactId = contact.ContactId || "";
  const action = params.action;

  // Log only what is needed to debug: never the full event (it holds the phone number).
  console.log(JSON.stringify({ action, contactId }));

  try {
    switch (action) {
      case "lookupCustomer":
        return await lookupCustomer(phone);
      case "challanStatus":
        return await challanStatus(phone, params.digits);
      case "logCall":
        return await logCall(phone, contactId, params);
      default:
        return { status: "INVALID_INPUT", message: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(JSON.stringify({ action, contactId, error: err.message }));
    return {
      status: "ERROR",
      message: "Sorry, we could not retrieve your details right now. Let me connect you to our team.",
    };
  }
}

async function lookupCustomer(phone) {
  const data = await api(`/integrations/connect/customers/lookup?phone=${encodeURIComponent(phone)}`);
  if (!data.found) {
    return {
      status: "NOT_FOUND",
      message: "Welcome to the sales helpline. We could not find an account for this number.",
    };
  }

  const c = data.customer;
  const latest = data.latestChallan;
  return {
    status: "OK",
    // For the agent (shown in the Contact Control Panel as contact attributes)
    customerId: String(c.id),
    customerName: c.name,
    businessName: c.businessName || "",
    customerType: c.type,
    customerStatus: c.status,
    openChallans: String(data.openChallans),
    confirmedChallans: String(data.confirmedChallans),
    latestChallanNumber: latest ? latest.number : "",
    latestChallanStatus: latest ? latest.status : "",
    // For the caller
    message: `Welcome back, ${firstName(c.name)}.`,
    latestOrderMessage: latest
      ? `Your latest order, ending in ${speakDigits(latest.number.slice(-4))}, ${STATUS_SPEECH[latest.status] || latest.status}.`
      : "You do not have any orders with us yet.",
  };
}

async function challanStatus(phone, digits) {
  const clean = String(digits || "").replace(/\D/g, "");
  if (clean.length < 12) {
    return { status: "INVALID_INPUT", message: "That challan number was too short. Please try again." };
  }
  const data = await api(
    `/integrations/connect/challans/status?phone=${encodeURIComponent(phone)}&digits=${clean}`
  );
  if (!data.found) {
    return { status: "NOT_FOUND", message: "We could not find that order on your account." };
  }
  const ch = data.challan;
  return {
    status: "OK",
    challanNumber: ch.number,
    challanStatus: ch.status,
    message: `Order ending in ${speakDigits(ch.number.slice(-4))}, with ${ch.totalQuantity} items, ${STATUS_SPEECH[ch.status] || ch.status}.`,
  };
}

async function logCall(phone, contactId, params) {
  const body = {
    phone,
    contactId,
    outcome: params.outcome || "SELF_SERVICE",
    ...(params.menuPath ? { menuPath: params.menuPath } : {}),
  };
  try {
    const data = await api("/integrations/connect/call-log", { method: "POST", body });
    return { status: "OK", logged: String(Boolean(data.logged)) };
  } catch (err) {
    // Unknown callers have no CRM record to log against; that is not a failure for the caller.
    if (err.httpStatus === 404) return { status: "NOT_FOUND", logged: "false" };
    throw err;
  }
}

/** Calls the ERP API with the API key and a hard timeout (Render free tier can cold-start slowly). */
async function api(path, { method = "GET", body } = {}) {
  if (!BASE_URL || !API_KEY) throw new Error("ERP_API_BASE_URL or CONNECT_API_KEY not set");

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "x-api-key": API_KEY, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`ERP API ${method} ${path.split("?")[0]} returned ${res.status}`);
    err.httpStatus = res.status;
    throw err;
  }
  return res.json();
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

/** "0012" -> "0 0 1 2" so text-to-speech reads digits one by one instead of "twelve". */
function speakDigits(s) {
  return String(s).split("").join(" ");
}
