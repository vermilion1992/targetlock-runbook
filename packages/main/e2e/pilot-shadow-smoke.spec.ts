import { expect, test } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";

const organisation = process.env.PILOT_E2E_ORGANISATION;
const email = process.env.PILOT_E2E_ADMIN_EMAIL;
const password = process.env.PILOT_E2E_ADMIN_PASSWORD;
const configured = Boolean(organisation && email && password);

test.describe("Stage 7C live pilot smoke", () => {
  test.skip(
    !configured,
    "Set PILOT_E2E_ORGANISATION, PILOT_E2E_ADMIN_EMAIL and PILOT_E2E_ADMIN_PASSWORD.",
  );

  test("signs in, starts empty, registers a device, and exposes admin diagnostics", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Organisation").fill(organisation!);
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in securely" }).click();

    await expect(page.getByTestId("pilot-context")).toBeVisible();
    await expect(page.getByText("DDH041", { exact: true })).toHaveCount(0);

    await page.goto("/pilot-admin");
    await expect(page.getByTestId("pilot-admin")).toBeVisible();
    await expect(
      page.getByText(/authorised replacement tablet/i).first(),
    ).toBeVisible();

    const deviceName = `E2E rig tablet ${Date.now()}`;
    await page.getByLabel("Device name").fill(deviceName);
    await page.getByRole("button", { name: "Register device" }).click();
    await expect(page.getByText(deviceName).first()).toBeVisible();
    await expect(page.getByText(/schema/i).first()).toBeVisible();

    await page.goto("/holes/DDH041/current");
    await expect(page.getByText(/was not found/i)).toBeVisible();
    await expect(page.getByText(/Briggs|M\. Hoffman/i)).toHaveCount(0);

    const session = await page.request.get("/api/pilot/session");
    const sessionBody = (await session.json()) as {
      user: { id: string; organisationId: string };
      device: { id: string };
    };
    const suffix = Date.now();
    const projectRef = `e2e-project-${suffix}`;
    const rigRef = `e2e-rig-${suffix}`;
    const holeRef = `E2E-CORE-${suffix}`;
    const occurredAt = new Date().toISOString();
    const metadata = (localId: string) => ({
      localId,
      serverId: null,
      syncStatus: "queued",
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deviceId: sessionBody.device.id,
      version: 1,
    });
    const project = {
      ...metadata(projectRef),
      organisationId: sessionBody.user.organisationId,
      code: `E2E-${String(suffix).slice(-8)}`,
      name: "E2E authoritative project",
      clientName: "E2E client",
      location: "Pilot test site",
      status: "active",
    };
    const rig = {
      ...metadata(rigRef),
      organisationId: sessionBody.user.organisationId,
      projectId: projectRef,
      name: "E2E authoritative rig",
      serialNumber: `E2E-RIG-${suffix}`,
      model: "E2E model",
      status: "operating",
    };
    const projectPayload = {
      repository: "projects",
      method: "createProjectWithInitialRig",
      arguments: [{ projectId: projectRef, rigId: rigRef }],
      clientMutationId: `e2e-project-${suffix}`,
      result: { project, rig },
    };
    const projectOperation = await page.request.post(
      "/api/pilot/sync/operations",
      {
        data: {
          operationId: randomUUID(),
          schemaVersion: 1,
          organisationId: sessionBody.user.organisationId,
          deviceId: sessionBody.device.id,
          operatorId: sessionBody.user.id,
          operationType: "projects.createProjectWithInitialRig.v1",
          projectRef,
          rigRef,
          holeRef: null,
          shiftRef: null,
          expectedVersion: null,
          revisionRef: `projects:${projectRef}`,
          clientTime: occurredAt,
          payloadHash: createHash("sha256")
            .update(JSON.stringify(projectPayload))
            .digest("hex"),
          payload: projectPayload,
          leaseEvidence: null,
        },
      },
    );
    expect(projectOperation.ok()).toBe(true);
    await expect(projectOperation.json()).resolves.toMatchObject({
      receipt: {
        status: "ACCEPTED",
        materializationStatus: "MATERIALIZED",
      },
    });

    const acquired = await page.request.post("/api/pilot/leases/acquire", {
      data: {
        resourceType: "HOLE",
        resourceRef: holeRef,
        projectRef,
        holeRef,
        shiftRef: null,
        ttlSeconds: 300,
      },
    });
    expect(acquired.ok()).toBe(true);
    const lease = (await acquired.json()) as {
      lease: {
        id: string;
        version: number;
        heartbeatAt: string;
      };
    };
    const hole = {
      ...metadata(holeRef),
      projectId: projectRef,
      rigId: rigRef,
      name: holeRef,
      holeSize: "HQ",
      plannedDepth: 5_000,
      currentDepth: 0,
      status: "ACTIVE",
    };
    const payload = {
      repository: "completion",
      method: "createHole",
      arguments: [{ holeId: holeRef }],
      clientMutationId: `e2e-hole-${holeRef}`,
      result: hole,
    };
    const journal = await page.request.post("/api/pilot/sync/operations", {
      data: {
        operationId: randomUUID(),
        schemaVersion: 1,
        organisationId: sessionBody.user.organisationId,
        deviceId: sessionBody.device.id,
        operatorId: sessionBody.user.id,
        operationType: "completion.createHole.v1",
        projectRef,
        rigRef,
        holeRef,
        shiftRef: null,
        expectedVersion: null,
        revisionRef: `completion:${holeRef}`,
        clientTime: new Date().toISOString(),
        payloadHash: createHash("sha256")
          .update(JSON.stringify(payload))
          .digest("hex"),
        payload,
        leaseEvidence: {
          state: "PRIMARY_WRITER",
          leaseId: lease.lease.id,
          leaseVersion: lease.lease.version,
          lastVerifiedAt: lease.lease.heartbeatAt,
          graceExpiresAt: null,
        },
      },
    });
    expect(journal.ok()).toBe(true);
    await expect(journal.json()).resolves.toMatchObject({
      receipt: {
        status: "ACCEPTED",
        materializationStatus: "MATERIALIZED",
      },
    });
    const directory = await page.request.get("/api/pilot/core/directory");
    expect(directory.ok()).toBe(true);
    await expect(directory.json()).resolves.toMatchObject({
      directory: {
        source: "AUTHORITATIVE_SERVER",
        holes: expect.arrayContaining([
          expect.objectContaining({ localId: holeRef }),
        ]),
      },
    });
  });

  test("enforces one primary writer across two registered browser contexts", async ({
    browser,
    baseURL,
  }) => {
    const origin = new URL(baseURL!).origin;
    const first = await browser.newContext({ baseURL });
    const second = await browser.newContext({ baseURL });
    try {
      for (const [index, context] of [first, second].entries()) {
        const request = context.request;
        const login = await request.post("/api/pilot/auth/login", {
          headers: { origin },
          data: { organisation, email, password },
        });
        expect(login.ok()).toBe(true);
        const registration = await request.post(
          "/api/pilot/devices/register",
          {
            headers: { origin },
            data: { displayName: `E2E contention tablet ${index}-${Date.now()}` },
          },
        );
        expect(registration.ok()).toBe(true);
      }
      const holeRef = `E2E-SHADOW-HOLE-${Date.now()}`;
      const target = {
        resourceType: "HOLE",
        resourceRef: holeRef,
        projectRef: null,
        holeRef,
        shiftRef: null,
        ttlSeconds: 300,
      };
      const owner = await first.request.post("/api/pilot/leases/acquire", {
        headers: { origin },
        data: target,
      });
      expect(owner.ok()).toBe(true);
      const contender = await second.request.post("/api/pilot/leases/acquire", {
        headers: { origin },
        data: target,
      });
      expect(contender.status()).toBe(409);
      await expect(contender.json()).resolves.toMatchObject({
        error: { code: "LEASE_OWNED_BY_ANOTHER_DEVICE" },
      });
    } finally {
      await first.close();
      await second.close();
    }
  });

  test("enforces Driller denial and temporary-password lifecycle", async ({
    page,
    browser,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Organisation").fill(organisation!);
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in securely" }).click();
    const unique = Date.now();
    const drillerEmail = `pilot-e2e-driller-${unique}@example.test`;
    const temporaryPassword = `Temporary-${unique}!`;
    const replacementPassword = `Replacement-${unique}!`;
    const provisioned = await page.request.post("/api/pilot/users/provision", {
      data: {
        email: drillerEmail,
        displayName: `Pilot E2E Driller ${unique}`,
        role: "DRILLER",
        temporaryPassword,
      },
    });
    expect(provisioned.ok()).toBe(true);
    const provisionedBody = (await provisioned.json()) as {
      user: { id: string };
    };

    const drillerContext = await browser.newContext();
    const drillerPage = await drillerContext.newPage();
    try {
      await drillerPage.goto("/sign-in");
      await drillerPage.getByLabel("Organisation").fill(organisation!);
      await drillerPage.getByLabel("Email").fill(drillerEmail);
      await drillerPage.getByLabel("Password").fill(temporaryPassword);
      await drillerPage
        .getByRole("button", { name: "Sign in securely" })
        .click();
      await expect(drillerPage).toHaveURL(/\/pilot-account/);
      await drillerPage.getByLabel("Current password").fill(temporaryPassword);
      await drillerPage.getByLabel("New password").fill(replacementPassword);
      await drillerPage
        .getByLabel("Confirm new password")
        .fill(replacementPassword);
      await drillerPage
        .getByRole("button", { name: "Change password and sign out" })
        .click();
      await expect(drillerPage).toHaveURL(/\/sign-in/);
      await drillerPage.getByLabel("Organisation").fill(organisation!);
      await drillerPage.getByLabel("Email").fill(drillerEmail);
      await drillerPage.getByLabel("Password").fill(replacementPassword);
      await drillerPage
        .getByRole("button", { name: "Sign in securely" })
        .click();
      await drillerPage.goto("/pilot-admin");
      await expect(drillerPage).toHaveURL(/access=denied/);
    } finally {
      await drillerContext.close();
      const cleanup = await page.request.post("/api/pilot/users/status", {
        data: {
          userId: provisionedBody.user.id,
          status: "REVOKED",
          reason: "Automated pilot acceptance cleanup",
        },
      });
      expect(cleanup.ok()).toBe(true);
    }
  });
});
