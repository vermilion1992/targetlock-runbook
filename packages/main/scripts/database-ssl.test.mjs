import assert from "node:assert/strict";
import test from "node:test";

import { databaseSslOptions } from "./database-ssl.mjs";

test("database SSL modes are parsed consistently", () => {
  assert.equal(databaseSslOptions({}), undefined);
  assert.equal(databaseSslOptions({ DATABASE_SSL: "disable" }), undefined);
  assert.deepEqual(databaseSslOptions({ DATABASE_SSL: "require" }), {
    rejectUnauthorized: false,
  });
  assert.deepEqual(
    databaseSslOptions({
      DATABASE_SSL: "verify-ca",
      DATABASE_CA_CERT: "line one\\nline two",
    }),
    {
      rejectUnauthorized: true,
      ca: "line one\nline two",
    },
  );
  assert.throws(
    () => databaseSslOptions({ DATABASE_SSL: "verify-ca" }),
    /DATABASE_CA_CERT/,
  );
  assert.throws(
    () => databaseSslOptions({ DATABASE_SSL: "prefer" }),
    /disable, require, or verify-ca/,
  );
});
