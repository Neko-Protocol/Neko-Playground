export class LeaseNotAcquiredError extends Error {
  readonly clientSafe = true as const;
  readonly status = 409;

  constructor(jobType: string, externalRef: string) {
    super(
      `Could not acquire lease for ${jobType}:${externalRef} — another worker holds it`
    );
    this.name = "LeaseNotAcquiredError";
  }
}

export class JobNotFoundError extends Error {
  readonly clientSafe = true as const;
  readonly status = 404;

  constructor(reference: string) {
    super(`No job run found for ${reference}`);
    this.name = "JobNotFoundError";
  }
}

export class JobOwnershipError extends Error {
  readonly clientSafe = true as const;
  readonly status = 403;

  constructor() {
    super("This wallet does not own the requested job run");
    this.name = "JobOwnershipError";
  }
}
