import { describe, expect, it } from "vitest";

import { databaseSslOptions } from "./database";

describe("pilot database TLS configuration", () => {
  it("uses Railway private networking without forcing TLS", () => {
    expect(databaseSslOptions({ DATABASE_SSL: "disable" })).toBeUndefined();
  });

  it("supports encrypted external connections with explicit CA verification", () => {
    expect(
      databaseSslOptions({
        DATABASE_SSL: "verify-ca",
        DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\\nTEST\\n-----END CERTIFICATE-----",
      }),
    ).toEqual({
      rejectUnauthorized: true,
      ca: "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----",
    });
  });

  it("fails closed when CA verification is selected without a CA", () => {
    expect(() =>
      databaseSslOptions({ DATABASE_SSL: "verify-ca" }),
    ).toThrow(/DATABASE_CA_CERT/);
  });
});
