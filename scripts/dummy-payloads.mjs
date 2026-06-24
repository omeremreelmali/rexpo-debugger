// Shared dummy-data payloads used by both the standalone seed script and the
// screenshot orchestrator. Exports a single `sendInitialBurst(send)` where
// `send` is a function that accepts a message object and transmits it (e.g. via
// a WebSocket connected to the desktop debugger).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 11);

export async function sendCall(
  send,
  {
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
  }
) {
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

  await sleep(Math.min(durationMs, 120));

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

export function sendLog(send, level, args, stack) {
  send({
    type: "console",
    id: uid(),
    level,
    args,
    timestamp: now(),
    stack,
  });
}

export async function sendInitialBurst(send) {
  // 1. App boot logs
  sendLog(send, "log", ["🚀 App started", { env: "development", version: "2.4.1" }]);
  await sleep(60);
  sendLog(send, "info", ["[Auth] Restoring session from secure storage"]);
  await sleep(40);

  // 2. Login flow
  await sendCall(send, {
    method: "POST",
    url: "https://api.rexpo-demo.dev/v1/auth/login",
    requestHeaders: { "content-type": "application/json" },
    requestBody: { email: "demo@rexpo.dev", password: "***" },
    status: 200,
    statusText: "OK",
    responseBody: {
      token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0MiIsImlhdCI6MTcwOTAwMDAwMH0.fake-signature",
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
  sendLog(send, "info", [
    "[Auth] Login successful",
    { userId: 42, email: "demo@rexpo.dev" },
  ]);
  await sleep(80);

  // 3. Initial data fetches
  await sendCall(send, {
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

  await sendCall(send, {
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

  sendLog(send, "log", ["Rendering ProductList", { count: 5, source: "cache" }]);
  await sleep(30);

  // 4. Debug log dump
  sendLog(send, "debug", [
    "[Redux] State updated",
    {
      auth: { isAuthenticated: true, userId: 42 },
      products: { items: 5, loading: false },
      cart: { items: 0, total: 0 },
      ui: { theme: "dark", sidebarOpen: false },
    },
  ]);
  await sleep(50);

  // 5. Image fetch
  await sendCall(send, {
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

  // 6. Slow request + warning
  sendLog(send, "warn", [
    "[Perf] /api/recommendations is slow — consider caching",
  ]);
  await sleep(50);
  await sendCall(send, {
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

  // 7. 401 + token refresh
  sendLog(send, "info", ["[Cart] Loading saved cart"]);
  await sleep(30);
  await sendCall(send, {
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
    send,
    "error",
    [
      "Cart fetch failed: 401 Unauthorized",
      { code: "token_expired", retryable: true },
    ],
    "Error: Token expired — should trigger refresh flow\n    at CartScreen.tsx:48:13\n    at fetchCart (apiClient.ts:114:9)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)"
  );
  await sleep(60);

  await sendCall(send, {
    method: "POST",
    url: "https://api.rexpo-demo.dev/v1/auth/refresh",
    requestBody: { refreshToken: "rt_8f9a2c1b4e6d8a0b2c4e6f8a" },
    status: 200,
    responseBody: { token: "eyJhbGciOi...new-token", expiresIn: 3600 },
    durationMs: 198,
  });
  sendLog(send, "log", ["[Auth] Token refreshed"]);
  await sleep(40);

  await sendCall(send, {
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

  // 8. Add to cart
  await sendCall(send, {
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

  // 9. Checkout — server error
  sendLog(send, "log", ["[Checkout] Starting payment flow"]);
  await sleep(40);
  await sendCall(send, {
    method: "POST",
    url: "https://api.rexpo-demo.dev/v1/checkout",
    requestHeaders: { "content-type": "application/json" },
    requestBody: {
      paymentMethod: "card_xyz",
      shippingAddress: {
        street: "1 Infinite Loop",
        city: "Cupertino",
        zip: "95014",
      },
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
    send,
    "error",
    [
      "[Checkout] Payment failed",
      { requestId: "req_8a3f2e1d", retryable: true },
    ],
    "Error: payment_provider_unavailable\n    at CheckoutScreen.tsx:142:11\n    at submitOrder (checkoutSlice.ts:78:5)"
  );
  await sleep(80);

  // 10. GraphQL POST
  await sendCall(send, {
    method: "POST",
    url: "https://api.rexpo-demo.dev/graphql",
    requestHeaders: { "content-type": "application/json" },
    requestBody: {
      query:
        "query GetOrders($userId: ID!) { orders(userId: $userId) { id total status createdAt } }",
      variables: { userId: "42" },
    },
    status: 200,
    responseBody: {
      data: {
        orders: [
          {
            id: "ord_1",
            total: 482.76,
            status: "shipped",
            createdAt: "2026-05-18T10:30:00Z",
          },
          {
            id: "ord_2",
            total: 1299.0,
            status: "processing",
            createdAt: "2026-05-20T14:22:00Z",
          },
        ],
      },
    },
    durationMs: 187,
  });

  // 11. DELETE / PATCH / 304
  await sendCall(send, {
    method: "DELETE",
    url: "https://api.rexpo-demo.dev/v1/cart/items/5",
    status: 204,
    statusText: "No Content",
    responseHeaders: {},
    durationMs: 78,
  });

  await sendCall(send, {
    method: "PATCH",
    url: "https://api.rexpo-demo.dev/v1/users/me",
    requestHeaders: { "content-type": "application/json" },
    requestBody: { preferences: { theme: "light" } },
    status: 200,
    responseBody: {
      id: 42,
      preferences: { theme: "light", language: "en", notifications: true },
    },
    durationMs: 145,
  });

  await sendCall(send, {
    method: "GET",
    url: "https://api.rexpo-demo.dev/v1/products?category=electronics&limit=20",
    requestHeaders: { "if-none-match": '"abc123"' },
    status: 304,
    statusText: "Not Modified",
    responseHeaders: { etag: '"abc123"' },
    durationMs: 34,
  });

  // 12. CDN asset
  await sendCall(send, {
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

  // 13. Mixed final logs
  sendLog(send, "debug", [
    "[Render] Tree update",
    ["ProductList", "ProductCard×5", "CartBadge", "Header"],
  ]);
  sendLog(send, "info", [
    "Performance mark",
    { metric: "TTI", value: 1247, unit: "ms", target: 1500 },
  ]);

  // 14. State stores — populate the State tab (Redux / Zustand / custom).
  await sleep(60);
  sendStateSnapshots(send);
}

/** Demo store snapshots for the State tab screenshot. */
export function sendStateSnapshots(send) {
  const at = new Date().toISOString();
  const snap = (storeId, name, lib, state, canSet = true) =>
    send({ type: "state", storeId, name, lib, state, canSet, at });

  snap("auth", "auth", "zustand", {
    user: {
      id: 42,
      name: "Ada Lovelace",
      email: "demo@rexpo.dev",
      role: "admin",
      avatar: "https://i.pravatar.cc/150?u=42",
    },
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
    isAuthenticated: true,
    expiresAt: "2026-06-25T13:45:00.000Z",
    login: { __rexpo: "function", name: "login" },
    logout: { __rexpo: "function", name: "logout" },
  });

  snap("cart", "cart", "zustand", {
    items: [
      { id: "sku_204", title: "Mechanical Keyboard", qty: 1, price: 129.0 },
      { id: "sku_881", title: "USB-C Hub", qty: 2, price: 39.5 },
    ],
    count: 3,
    subtotal: 208.0,
    currency: "USD",
    coupon: null,
    addItem: { __rexpo: "function", name: "addItem" },
  });

  snap(
    "app",
    "app",
    "redux",
    {
      ui: { theme: "system", sidebarOpen: true, activeTab: "home" },
      flags: { betaCheckout: true, newPricing: false },
      network: { online: true, lastSyncAt: "2026-06-25T13:02:11.000Z" },
    },
    false
  );
}

// A small, hand-crafted set of saved requests so the Collections tab looks
// populated in screenshots. Same field shape as renderer/state/CollectionsContext.
export function buildCollectionsSeed() {
  const t = new Date().toISOString();
  return {
    savedRequests: [
      {
        id: "sr_auth_login",
        name: "Login (admin)",
        collectionName: "Auth flow",
        tags: ["auth", "smoke"],
        description: "Happy-path login for the demo admin user.",
        method: "POST",
        url: "https://api.rexpo-demo.dev/v1/auth/login",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          { email: "demo@rexpo.dev", password: "***" },
          null,
          2
        ),
        createdAt: t,
      },
      {
        id: "sr_auth_refresh",
        name: "Refresh token",
        collectionName: "Auth flow",
        tags: ["auth"],
        method: "POST",
        url: "https://api.rexpo-demo.dev/v1/auth/refresh",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          { refreshToken: "rt_8f9a2c1b4e6d8a0b2c4e6f8a" },
          null,
          2
        ),
        createdAt: t,
      },
      {
        id: "sr_products_list",
        name: "List electronics",
        collectionName: "Catalog",
        tags: ["catalog", "read"],
        description: "First 20 electronics — used to verify pagination.",
        method: "GET",
        url: "https://api.rexpo-demo.dev/v1/products?category=electronics&limit=20",
        createdAt: t,
      },
      {
        id: "sr_cart_add",
        name: "Add MacBook to cart",
        collectionName: "Catalog",
        tags: ["catalog", "write"],
        method: "POST",
        url: "https://api.rexpo-demo.dev/v1/cart/items",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: 2, quantity: 1 }, null, 2),
        createdAt: t,
      },
      {
        id: "sr_checkout",
        name: "Checkout (Stripe)",
        collectionName: "Checkout",
        tags: ["checkout", "regression"],
        description:
          "Reproduces the 500 we saw on 2026-05-18 — keep until Stripe ticket is closed.",
        method: "POST",
        url: "https://api.rexpo-demo.dev/v1/checkout",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          {
            paymentMethod: "card_xyz",
            shippingAddress: {
              street: "1 Infinite Loop",
              city: "Cupertino",
              zip: "95014",
            },
          },
          null,
          2
        ),
        createdAt: t,
      },
      {
        id: "sr_graphql_orders",
        name: "Orders (GraphQL)",
        tags: ["graphql"],
        method: "POST",
        url: "https://api.rexpo-demo.dev/graphql",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          {
            query:
              "query GetOrders($userId: ID!) { orders(userId: $userId) { id total status createdAt } }",
            variables: { userId: "42" },
          },
          null,
          2
        ),
        createdAt: t,
      },
    ],
  };
}
