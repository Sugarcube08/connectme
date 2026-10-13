import { describe, expect, it } from "vitest";
import { isValidMySqlUrl } from "../config/mysql-url";

describe("isValidMySqlUrl", () => {
  it("accepts a standard MySQL connection URL", () => {
    expect(isValidMySqlUrl("mysql://connectme_user:randomhexpassword@127.0.0.1:3306/connectme")).toBe(true);
  });

  it("accepts percent-encoded reserved characters in credentials", () => {
    expect(isValidMySqlUrl("mysql://connectme_user:p%40ss%3Aword%25@db.example.test:3306/connectme")).toBe(true);
  });

  it("accepts valid MySQL connector query options", () => {
    expect(isValidMySqlUrl("mysql://user:pass@db.example.test:3306/connectme?sslaccept=strict&connection_limit=5")).toBe(true);
  });

  it("accepts a provider URL that omits the default port", () => {
    expect(isValidMySqlUrl("mysql://user:pass@db.example.test/connectme")).toBe(true);
  });

  it("rejects non-MySQL schemes", () => {
    expect(isValidMySqlUrl("postgresql://user:pass@db.example.test:5432/connectme")).toBe(false);
  });

  it("rejects missing credentials or host", () => {
    expect(isValidMySqlUrl("mysql://db.example.test:3306/connectme")).toBe(false);
    expect(isValidMySqlUrl("mysql://user:pass@:3306/connectme")).toBe(false);
  });

  it("rejects a missing database name", () => {
    expect(isValidMySqlUrl("mysql://user:pass@db.example.test:3306")).toBe(false);
  });

  it("rejects raw reserved characters in credentials", () => {
    expect(isValidMySqlUrl("mysql://user:p@ss:word@db.example.test:3306/connectme")).toBe(false);
  });

  it("rejects invalid percent escapes and fragments", () => {
    expect(isValidMySqlUrl("mysql://user:p%ZZss@db.example.test:3306/connectme")).toBe(false);
    expect(isValidMySqlUrl("mysql://user:pass@db.example.test:3306/connectme#fragment")).toBe(false);
  });

  it("rejects invalid ports and multi-segment database paths", () => {
    expect(isValidMySqlUrl("mysql://user:pass@db.example.test:99999/connectme")).toBe(false);
    expect(isValidMySqlUrl("mysql://user:pass@db.example.test:3306/connectme/other")).toBe(false);
  });
});
