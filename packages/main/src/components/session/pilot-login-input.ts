export interface PilotLoginInput {
  readonly organisation: string;
  readonly email: string;
  readonly password: string;
}

export type PilotLoginInputResult =
  | { readonly ok: true; readonly input: PilotLoginInput }
  | { readonly ok: false; readonly message: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parsePilotLoginInput(input: {
  readonly organisation: unknown;
  readonly email: unknown;
  readonly password: unknown;
}): PilotLoginInputResult {
  const organisation =
    typeof input.organisation === "string" ? input.organisation.trim() : "";
  const email =
    typeof input.email === "string"
      ? input.email.trim().toLocaleLowerCase("en-AU")
      : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (organisation.length < 2 || organisation.length > 80) {
    return {
      ok: false,
      message: "Enter the organisation code supplied by your administrator.",
    };
  }
  if (email.length > 320 || !emailPattern.test(email)) {
    return { ok: false, message: "Enter a valid account email address." };
  }
  if (password.length < 10 || password.length > 200) {
    return {
      ok: false,
      message:
        "Enter your provisioned password. It must contain at least 10 characters.",
    };
  }
  return {
    ok: true,
    input: { organisation, email, password },
  };
}
