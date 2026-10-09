import { createServer } from "node:http";
import { loadConfig } from "./config.ts";
import { createHandler } from "./server.ts";
import { ShopifyDiscountGateway } from "./shopify.ts";
import { SpinService } from "./spin.ts";
import { SpinStore } from "./store.ts";

const config = loadConfig();
const store = new SpinStore(config.databaseUrl);
await store.migrate();

const service = new SpinService({
  store,
  settings: config.spin,
  gateway: new ShopifyDiscountGateway({
    shop: config.shop,
    apiVersion: config.apiVersion,
    accessToken: config.accessToken,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    combinesWithShipping: config.combinesWithShipping,
  }),
});

const server = createServer(
  createHandler({
    service,
    proxySecret: config.proxySecret,
    visitorSecret: config.visitorSecret,
    shop: config.shop,
    signatureMaxAgeSeconds: config.signatureMaxAgeSeconds,
    allowUnsigned: config.allowUnsigned,
    trustedProxyHops: Number(process.env.SPIN_TRUSTED_PROXY_HOPS ?? 1),
    healthCheck: async () => {
      await store.pool.query("select 1");
    },
  }),
);
server.requestTimeout = 30_000;
server.listen(config.port, () => {
  console.log(JSON.stringify({ level: "info", msg: "spin-service listening", port: config.port, shop: config.shop }));
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => store.close().then(() => process.exit(0)));
  });
}
