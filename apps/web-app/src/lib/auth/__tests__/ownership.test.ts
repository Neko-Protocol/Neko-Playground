import { describe, expect, it } from "vitest";
import {
  assertOwnsCustomer,
  bindCustomer,
  getCustomerOwner,
} from "@/lib/auth/ownership";
import { ForbiddenError } from "@/lib/auth/errors";

describe("ownership", () => {
  const owner = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const other = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

  it("binds and verifies customer ownership", async () => {
    await bindCustomer("etherfuse", "cust-1", owner);
    await expect(
      assertOwnsCustomer({ publicKey: owner }, "etherfuse", "cust-1")
    ).resolves.toBeUndefined();
  });

  it("denies non-owners", async () => {
    await bindCustomer("etherfuse", "cust-2", owner);
    await expect(
      assertOwnsCustomer({ publicKey: other }, "etherfuse", "cust-2")
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("fails closed for unknown bindings", async () => {
    await expect(
      assertOwnsCustomer({ publicKey: owner }, "etherfuse", "unknown-cust")
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getCustomerOwner("etherfuse", "unknown-cust")).toBeNull();
  });
});
