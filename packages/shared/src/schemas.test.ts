import { describe, expect, test } from "bun:test";

describe("validation errors", () => {
  test("formatValidationError maps zod issues to field errors", async () => {
    const { formatValidationError } = await import("@servicebeard/shared");
    const { createProjectSchema } = await import("@servicebeard/shared");
    try {
      createProjectSchema.parse({ name: "", providerToken: "" });
    } catch (err) {
      const formatted = formatValidationError(err as import("zod").ZodError);
      expect(formatted.error).toContain("Validation failed");
      expect(formatted.fieldErrors.name).toBeDefined();
    }
  });

  test("updateProjectSchema strips empty secret fields", async () => {
    const { updateProjectSchema } = await import("@servicebeard/shared");
    const parsed = updateProjectSchema.parse({
      name: "Updated",
      providerToken: "",
      imapPassword: "",
    });
    expect(parsed.name).toBe("Updated");
    expect(parsed).not.toHaveProperty("providerToken");
    expect(parsed).not.toHaveProperty("imapPassword");
  });
});
