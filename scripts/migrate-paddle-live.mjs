#!/usr/bin/env node
/**
 * Idempotent, strictly ADDITIVE Paddle Sandbox -> Live catalog & credentials migration script.
 *
 * Guardrails enforced:
 * - NEVER deletes, archives, deactivates, or recreates any Live or Sandbox entity.
 * - Reuses existing Live products, prices, client-side tokens, and notification destinations
 *   whenever a match already exists; only creates what is missing.
 *
 * Usage:
 *   PADDLE_LIVE_API_KEY=pdl_live_apikey_... \
 *   LIVE_APP_URL=https://your-production-domain.com \
 *   node scripts/migrate-paddle-live.mjs [--dry-run]
 */

const LIVE_API_BASE = "https://api.paddle.com";
const isDryRun = process.argv.includes("--dry-run");

const apiKey =
  process.env.PADDLE_LIVE_API_KEY ||
  (process.env.PADDLE_API_KEY?.startsWith("pdl_live_apikey_")
    ? process.env.PADDLE_API_KEY
    : "");

if (!apiKey || !apiKey.startsWith("pdl_live_apikey_")) {
  console.error(
    "Missing PADDLE_LIVE_API_KEY (must start with `pdl_live_apikey_`).\n" +
      "Create a live API key in Paddle Dashboard (Live) -> Developer Tools -> Authentication -> API keys,\n" +
      "then run:\n" +
      "  PADDLE_LIVE_API_KEY=pdl_live_apikey_... LIVE_APP_URL=https://your-live-domain.com node scripts/migrate-paddle-live.mjs",
  );
  process.exit(1);
}

const liveAppUrl = (
  process.env.LIVE_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://casefolio.vercel.app"
).replace(/\/+$/, "");

const SANDBOX_CATALOG = {
  products: [
    {
      key: "pro",
      sandboxId: "pro_01m7sq5r9zw662ne4eyrxsmz8d",
      name: "Casefolio Pro",
      tax_category: "saas",
      description:
        "Casefolio Pro subscription for individual product designers and engineers — 20 active case studies, 10 published links, 5 GB asset storage, and 50 HD exports/month.",
    },
    {
      key: "team",
      sandboxId: "pro_01m7sq5rwjqeh6t9qggb0fv8dk",
      name: "Casefolio Teams",
      tax_category: "saas",
      description:
        "Collaborative team workspace with shared asset libraries, seat-based permissions, unlimited active and published case studies, 30 GB team storage, and 300 HD exports/month.",
    },
  ],
  prices: [
    {
      envVar: "PADDLE_PRICE_PRO_MONTHLY",
      productKey: "pro",
      sandboxId: "pri_01m7t0gab2jcw0d66tbprqby43",
      name: "Pro Monthly",
      description: "Casefolio Pro — Monthly subscription ($7.99/month)",
      amount: "799",
      currency_code: "USD",
      interval: "month",
      frequency: 1,
      tax_mode: "location",
      quantity: { minimum: 1, maximum: 1 },
    },
    {
      envVar: "PADDLE_PRICE_PRO_YEARLY",
      productKey: "pro",
      sandboxId: "pri_01m7t0gagw9y3t4zk3qc78grhb",
      name: "Pro Yearly (2 Months Free)",
      description: "Casefolio Pro — Annual subscription ($79.90/year, 2 months free)",
      amount: "7990",
      currency_code: "USD",
      interval: "year",
      frequency: 1,
      tax_mode: "location",
      quantity: { minimum: 1, maximum: 1 },
    },
    {
      envVar: "PADDLE_PRICE_TEAM_MONTHLY",
      productKey: "team",
      sandboxId: "pri_01m7t0gapbtfj3v7a2e32t60ky",
      name: "Teams Monthly",
      description: "Casefolio Teams — Monthly per-seat subscription ($5.99/seat/month, 2–25 seats)",
      amount: "599",
      currency_code: "USD",
      interval: "month",
      frequency: 1,
      tax_mode: "location",
      quantity: { minimum: 2, maximum: 25 },
    },
    {
      envVar: "PADDLE_PRICE_TEAM_YEARLY",
      productKey: "team",
      sandboxId: "pri_01m7t0gavv92jatgw5g20jf6c1",
      name: "Teams Yearly (2 Months Free)",
      description:
        "Casefolio Teams — Annual per-seat subscription ($59.90/seat/year, 2 months free, 2–25 seats)",
      amount: "5990",
      currency_code: "USD",
      interval: "year",
      frequency: 1,
      tax_mode: "location",
      quantity: { minimum: 2, maximum: 25 },
    },
  ],
};

const WEBHOOK_SUBSCRIBED_EVENTS = [
  "transaction.completed",
  "transaction.paid",
  "transaction.payment_failed",
  "subscription.created",
  "subscription.activated",
  "subscription.updated",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.canceled",
];

async function paddleRequest(path, options = {}) {
  const response = await fetch(`${LIVE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Paddle Live API ${options.method || "GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function run() {
  console.log(`Auditing Paddle Live account (${isDryRun ? "DRY RUN" : "ADDITIVE MODE"})...`);

  const existingProductsRes = await paddleRequest("/products?status=active&per_page=100");
  const existingPricesRes = await paddleRequest("/prices?status=active&per_page=100");
  const existingTokensRes = await paddleRequest("/client-tokens?status=active&per_page=50").catch(
    () => ({ data: [] }),
  );
  const existingWebhooksRes = await paddleRequest("/notification-settings?per_page=50").catch(
    () => ({ data: [] }),
  );

  const existingProducts = existingProductsRes.data || [];
  const existingPrices = existingPricesRes.data || [];
  const existingTokens = existingTokensRes.data || [];
  const existingWebhooks = existingWebhooksRes.data || [];

  const liveProductIdsByKey = {};
  const mappingReport = [];

  for (const spec of SANDBOX_CATALOG.products) {
    const found = existingProducts.find(
      (p) => p.name?.trim().toLowerCase() === spec.name.toLowerCase(),
    );
    if (found) {
      liveProductIdsByKey[spec.key] = found.id;
      mappingReport.push({
        type: "Product",
        name: spec.name,
        sandboxId: spec.sandboxId,
        liveId: found.id,
        action: "reused_existing",
      });
    } else if (isDryRun) {
      liveProductIdsByKey[spec.key] = `<would_create_${spec.key}>`;
      mappingReport.push({
        type: "Product",
        name: spec.name,
        sandboxId: spec.sandboxId,
        liveId: "(missing — dry-run)",
        action: "would_create",
      });
    } else {
      const created = await paddleRequest("/products", {
        method: "POST",
        body: JSON.stringify({
          name: spec.name,
          tax_category: spec.tax_category,
          description: spec.description,
        }),
      });
      liveProductIdsByKey[spec.key] = created.data.id;
      mappingReport.push({
        type: "Product",
        name: spec.name,
        sandboxId: spec.sandboxId,
        liveId: created.data.id,
        action: "created",
      });
    }
  }

  const livePriceIdsByEnvVar = {};

  for (const spec of SANDBOX_CATALOG.prices) {
    const productId = liveProductIdsByKey[spec.productKey];
    const found = existingPrices.find(
      (pri) =>
        pri.product_id === productId &&
        pri.unit_price?.amount === spec.amount &&
        pri.unit_price?.currency_code === spec.currency_code &&
        pri.billing_cycle?.interval === spec.interval &&
        pri.billing_cycle?.frequency === spec.frequency &&
        pri.quantity?.minimum === spec.quantity.minimum &&
        pri.quantity?.maximum === spec.quantity.maximum,
    );

    if (found) {
      livePriceIdsByEnvVar[spec.envVar] = found.id;
      mappingReport.push({
        type: "Price",
        name: spec.name,
        sandboxId: spec.sandboxId,
        liveId: found.id,
        action: "reused_existing",
      });
    } else if (isDryRun) {
      livePriceIdsByEnvVar[spec.envVar] = `<would_create_${spec.envVar}>`;
      mappingReport.push({
        type: "Price",
        name: spec.name,
        sandboxId: spec.sandboxId,
        liveId: "(missing — dry-run)",
        action: "would_create",
      });
    } else {
      const created = await paddleRequest("/prices", {
        method: "POST",
        body: JSON.stringify({
          product_id: productId,
          name: spec.name,
          description: spec.description,
          unit_price: {
            amount: spec.amount,
            currency_code: spec.currency_code,
          },
          billing_cycle: {
            interval: spec.interval,
            frequency: spec.frequency,
          },
          tax_mode: spec.tax_mode,
          quantity: spec.quantity,
        }),
      });
      livePriceIdsByEnvVar[spec.envVar] = created.data.id;
      mappingReport.push({
        type: "Price",
        name: spec.name,
        sandboxId: spec.sandboxId,
        liveId: created.data.id,
        action: "created",
      });
    }
  }

  let liveClientToken =
    existingTokens.find((t) => t.status === "active" && t.token?.startsWith("live_"))?.token || "";

  if (!liveClientToken && !isDryRun) {
    const createdToken = await paddleRequest("/client-tokens", {
      method: "POST",
      body: JSON.stringify({
        name: "Casefolio Live Web Client Token",
        description: "Paddle.js client-side token for Casefolio production checkout",
      }),
    });
    liveClientToken = createdToken.data?.token || "";
  }

  const targetWebhookUrl = `${liveAppUrl}/api/paddle/webhook`;
  let webhookDestination = existingWebhooks.find(
    (w) => w.destination === targetWebhookUrl && w.active !== false,
  );

  if (!webhookDestination && !isDryRun) {
    const createdHook = await paddleRequest("/notification-settings", {
      method: "POST",
      body: JSON.stringify({
        description: "Casefolio Production Webhook",
        destination: targetWebhookUrl,
        type: "url",
        include_sensitive_fields: false,
        subscribed_events: WEBHOOK_SUBSCRIBED_EVENTS,
      }),
    });
    webhookDestination = createdHook.data;
  }

  console.log("\n=== Sandbox -> Live Catalog Mapping ===");
  console.table(mappingReport);

  console.log("\n=== Live Environment Variables Block ===");
  console.log(`PADDLE_ENV=production`);
  console.log(`ALLOW_SIMULATED_BILLING=0`);
  console.log(`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=${liveClientToken || "<create_or_read_in_dashboard>"}`);
  console.log(
    `PADDLE_WEBHOOK_SECRET=${webhookDestination?.endpoint_secret_key || "<read_existing_endpoint_secret_in_dashboard>"}`,
  );
  for (const spec of SANDBOX_CATALOG.prices) {
    console.log(`${spec.envVar}=${livePriceIdsByEnvVar[spec.envVar]}`);
  }
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
