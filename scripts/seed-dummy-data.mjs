#!/usr/bin/env node
/**
 * Fake agent that streams realistic dummy data to a running desktop debugger.
 *
 *   1. `npm run dev` (in another shell — starts the inspector + WS server)
 *   2. `node scripts/seed-dummy-data.mjs`
 *
 * Sends a mix of network requests (varied methods/statuses) and console logs
 * (varied levels with stack traces where relevant). Stays connected after the
 * initial burst so the UI looks alive — Ctrl+C to stop.
 */
import { WebSocket } from "ws";

const WS_URL = process.env.WS_URL ?? "ws://localhost:5051";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 11);

const ws = new WebSocket(WS_URL);

ws.on("open", async () => {
  console.log(`[seed] connected to ${WS_URL}`);
  await sleep(400);
  await initialBurst();
  console.log("[seed] initial burst sent — keeping connection alive");
  // Drip-feed a slower stream so the UI keeps moving while screenshotting
  while (ws.readyState === WebSocket.OPEN) {
    await sleep(5000 + Math.random() * 4000);
    await randomTrickle();
  }
});

ws.on("error", (err) => {
  console.error(`[seed] WS error: ${err.message}`);
  process.exit(1);
});

ws.on("close", () => {
  console.log("[seed] connection closed");
  process.exit(0);
});

function send(msg) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function sendCall({
  method,
  url,
  requestHeaders = {},
  requestBody,
  status,
  statusText,
  responseHeaders = { "content-type": "application/json" },
  responseBody,
  durationMs = 80 + Math.floor(Math.random() * 300),
  isError = false,
  errorMessage,
}) {
  const id = uid();
  const startedAt = now();

  send({
    type: "request",
    id,
    url,
    method,
    requestHeaders: {
      accept: "application/json",
      "user-agent": "RexpoDemoApp/1.0 (iOS 17.4; iPhone 15 Pro)",
      ...requestHeaders,
    },
    requestBodySnippet:
      typeof requestBody === "string"
        ? requestBody
        : requestBody
          ? JSON.stringify(requestBody)
          : undefined,
    startedAt,
  });

  await sleep(Math.min(durationMs, 400));

  send({
    type: "response",
    id,
    url,
    status,
    statusText,
    responseHeaders,
    responseBodySnippet:
      typeof responseBody === "string"
        ? responseBody
        : responseBody
          ? JSON.stringify(responseBody, null, 2)
          : undefined,
    durationMs,
    finishedAt: now(),
    isError,
    errorMessage,
  });
}

function sendLog(level, args, stack) {
  send({
    type: "console",
    id: uid(),
    level,
    args,
    timestamp: now(),
    stack,
  });
}

async function initialBurst() {
  // 1. App boot logs
  sendLog("log", ["🚀 App started", { env: "development", version: "2.4.1" }]);
  await sleep(80);
  sendLog("info", ["[Auth] Restoring session from secure storage"]);
  await sleep(60);

  // 2. Login flow
  await sendCall({
    method: "POST",
    url: "https://api.rexpo-demo.dev/v1/auth/login",
    requestHeaders: { "content-type": "application/json" },
    requestBody: { email: "demo@rexpo.dev", password: "***" },
    status: 200,
    statusText: "OK",
    responseBody: {
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0MiIsImlhdCI6MTcwOTAwMDAwMH0.fake-signature-here",
      refreshToken: "rt_8f9a2c1b4e6d8a0b2c4e6f8a",
      user: {
        id: 42,
        email: "demo@rexpo.dev",
        name: "Ada Lovelace",
        avatar: "https://i.pravatar.cc/150?u=42",
        role: "admin",
      },
      expiresIn: 3600,
    },
    durationMs: 234,
  });
  sendLog("info", ["[Auth] Login successful", { userId: 42, email: "demo@rexpo.dev" }]);
  await sleep(120);

  // 3. Initial data fetches
  await sendCall({
    method: "GET",
    url: "https://api.rexpo-demo.dev/v1/users/me",
    requestHeaders: { authorization: "Bearer eyJhbGciOiJIUzI1NiI...fake" },
    status: 200,
    responseBody: {
      id: 42,
      email: "demo@rexpo.dev",
      name: "Ada Lovelace",
      preferences: { theme: "dark", language: "en", notifications: true },
      stats: { ordersCount: 17, totalSpent: 1248.5 },
    },
    durationMs: 89,
  });

  await sendCall({
    method: "GET",
    url: "https://api.rexpo-demo.dev/v1/products?category=electronics&limit=20",
    status: 200,
    responseBody: {
      items: [
        { id: 1, name: "AirPods Pro", price: 249, stock: 42 },
        { id: 2, name: "MacBook Air M3", price: 1299, stock: 8 },
        { id: 3, name: "iPad Mini", price: 499, stock: 23 },
        { id: 4, name: "Apple Watch Ultra", price: 799, stock: 15 },
        { id: 5, name: "Magic Keyboard", price: 99, stock: 67 },
      ],
      total: 142,
      page: 1,
      hasMore: true,
    },
    durationMs: 156,
  });

  sendLog("log", ["Rendering ProductList", { count: 5, source: "cache" }]);
  await sleep(40);

  // 4. Debug log dump (object)
  sendLog("debug", [
    "[Redux] State updated",
    {
      auth: { isAuthenticated: true, userId: 42 },
      products: { items: 5, loading: false },
      cart: { items: 0, total: 0 },
      ui: { theme: "dark", sidebarOpen: false },
    },
  ]);
  await sleep(80);

  // 5. Image fetch
  await sendCall({
    method: "GET",
    url: "https://images.rexpo-demo.dev/products/airpods-pro@2x.webp",
    status: 200,
    responseHeaders: {
      "content-type": "image/webp",
      "content-length": "84320",
      "cache-control": "public, max-age=31536000",
    },
    responseBody: "(binary — 84320 bytes)",
    durationMs: 312,
  });

  // 6. Slow request with warning
  sendLog("warn", ["[Perf] /api/recommendations is slow — consider caching"]);
  await sleep(60);
  await sendCall({
    method: "GET",
    url: "https://api.rexpo-demo.dev/v1/recommendations?userId=42",
    status: 200,
    responseBody: {
      recommended: [
        { id: 12, score: 0.94, reason: "Often bought together" },
        { id: 8, score: 0.87, reason: "Similar customers also viewed" },
        { id: 22, score: 0.81, reason: "Based on browsing history" },
      ],
    },
    durationMs: 2347,
  });

  // 7. Failed request — 401
  sendLog("info", ["[Cart] Loading saved cart"]);
  await sleep(40);
  await sendCall({
    method: "GET",
    url: "https://api.rexpo-demo.dev/v1/cart",
    requestHeaders: { authorization: "Bearer expired-token-here" },
    status: 401,
    statusText: "Unauthorized",
    responseBody: {
      error: "token_expired",
      message: "JWT token has expired. Refresh the token and try again.",
    },
    durationMs: 67,
  });
  sendLog(
    "error",
    [
      "Cart fetch failed: 401 Unauthorized",
      new Error("Token expired — should trigger refresh flow"),
    ],
    "Error: Token expired — should trigger refresh flow\n    at CartScreen.tsx:48:13\n    at fetchCart (apiClient.ts:114:9)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)",
  );
  await sleep(80);

  // 8. Token refresh
  await sendCall({
    method: "POST",
    url: "https://api.rexpo-demo.dev/v1/auth/refresh",
    requestBody: { refreshToken: "rt_8f9a2c1b4e6d8a0b2c4e6f8a" },
    status: 200,
    responseBody: { token: "eyJhbGciOi...new-token", expiresIn: 3600 },
    durationMs: 198,
  });
  sendLog("log", ["[Auth] Token refreshed"]);
  await sleep(60);

  // 9. Successful cart fetch
  await sendCall({
    method: "GET",
    url: "https://api.rexpo-demo.dev/v1/cart",
    status: 200,
    responseBody: {
      items: [
        { productId: 1, name: "AirPods Pro", quantity: 1, price: 249 },
        { productId: 5, name: "Magic Keyboard", quantity: 2, price: 99 },
      ],
      subtotal: 447,
      tax: 35.76,
      total: 482.76,
    },
    durationMs: 102,
  });

  // 10. Add to cart
  await sendCall({
    method: "POST",
    url: "https://api.rexpo-demo.dev/v1/cart/items",
    requestHeaders: { "content-type": "application/json" },
    requestBody: { productId: 2, quantity: 1 },
    status: 201,
    statusText: "Created",
    responseBody: {
      productId: 2,
      name: "MacBook Air M3",
      quantity: 1,
      price: 1299,
      addedAt: now(),
    },
    durationMs: 134,
  });

  // 11. Checkout — server error
  sendLog("log", ["[Checkout] Starting payment flow"]);
  await sleep(60);
  await sendCall({
    method: "POST",
    url: "https://api.rexpo-demo.dev/v1/checkout",
    requestHeaders: { "content-type": "application/json" },
    requestBody: {
      paymentMethod: "card_xyz",
      shippingAddress: { street: "1 Infinite Loop", city: "Cupertino", zip: "95014" },
    },
    status: 500,
    statusText: "Internal Server Error",
    responseBody: {
      error: "payment_provider_unavailable",
      message: "Stripe API returned 503. Please retry in a few seconds.",
      requestId: "req_8a3f2e1d",
    },
    durationMs: 1843,
  });
  sendLog(
    "error",
    ["[Checkout] Payment failed", { requestId: "req_8a3f2e1d", retryable: true }],
    "Error: payment_provider_unavailable\n    at CheckoutScreen.tsx:142:11\n    at submitOrder (checkoutSlice.ts:78:5)",
  );
  await sleep(120);

  // 12. Network error
  await sendCall({
    method: "GET",
    url: "https://api.rexpo-demo.dev/v1/analytics/events",
    status: 0,
    isError: true,
    errorMessage: "Network request failed",
    durationMs: 3000,
  });
  sendLog("warn", ["[Analytics] Failed to flush 4 events — will retry on next launch"]);
  await sleep(80);

  // 13. GraphQL-ish POST
  await sendCall({
    method: "POST",
    url: "https://api.rexpo-demo.dev/graphql",
    requestHeaders: { "content-type": "application/json" },
    requestBody: {
      query: "query GetOrders($userId: ID!) { orders(userId: $userId) { id total status createdAt } }",
      variables: { userId: "42" },
    },
    status: 200,
    responseBody: {
      data: {
        orders: [
          { id: "ord_1", total: 482.76, status: "shipped", createdAt: "2026-05-18T10:30:00Z" },
          { id: "ord_2", total: 1299.0, status: "processing", createdAt: "2026-05-20T14:22:00Z" },
        ],
      },
    },
    durationMs: 187,
  });

  // 14. DELETE
  await sendCall({
    method: "DELETE",
    url: "https://api.rexpo-demo.dev/v1/cart/items/5",
    status: 204,
    statusText: "No Content",
    responseHeaders: {},
    durationMs: 78,
  });

  // 15. PATCH
  await sendCall({
    method: "PATCH",
    url: "https://api.rexpo-demo.dev/v1/users/me",
    requestHeaders: { "content-type": "application/json" },
    requestBody: { preferences: { theme: "light" } },
    status: 200,
    responseBody: { id: 42, preferences: { theme: "light", language: "en", notifications: true } },
    durationMs: 145,
  });

  // 16. 304 Not Modified
  await sendCall({
    method: "GET",
    url: "https://api.rexpo-demo.dev/v1/products?category=electronics&limit=20",
    requestHeaders: { "if-none-match": '"abc123"' },
    status: 304,
    statusText: "Not Modified",
    responseHeaders: { etag: '"abc123"' },
    durationMs: 34,
  });

  // 17. External CDN
  await sendCall({
    method: "GET",
    url: "https://cdn.rexpo-demo.dev/assets/fonts/Inter-Variable.woff2",
    status: 200,
    responseHeaders: {
      "content-type": "font/woff2",
      "content-length": "248192",
    },
    responseBody: "(binary — 248192 bytes)",
    durationMs: 412,
  });

  // 18. Mixed console output
  sendLog("debug", [
    "[Render] Tree update",
    ["ProductList", "ProductCard×5", "CartBadge", "Header"],
  ]);
  sendLog("info", [
    "Performance mark",
    { metric: "TTI", value: 1247, unit: "ms", target: 1500 },
  ]);
}

async function randomTrickle() {
  const r = Math.random();
  if (r < 0.45) {
    // ping endpoint
    await sendCall({
      method: "GET",
      url: "https://api.rexpo-demo.dev/v1/health",
      status: 200,
      responseBody: { status: "ok", uptime: Math.floor(Date.now() / 1000) },
      durationMs: 30 + Math.floor(Math.random() * 60),
    });
  } else if (r < 0.7) {
    sendLog("log", [`[Tick] ${new Date().toLocaleTimeString()}`, { random: Math.random().toFixed(3) }]);
  } else if (r < 0.85) {
    // analytics event
    await sendCall({
      method: "POST",
      url: "https://api.rexpo-demo.dev/v1/analytics/events",
      requestBody: { event: "screen_view", screen: "ProductDetail", productId: Math.floor(Math.random() * 50) },
      status: 202,
      statusText: "Accepted",
      responseBody: { accepted: true },
      durationMs: 50 + Math.floor(Math.random() * 80),
    });
  } else {
    sendLog("warn", [
      `[Cache] Eviction — freed ${Math.floor(Math.random() * 200)}KB`,
    ]);
  }
}
