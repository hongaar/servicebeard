export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 12,
  });
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return Bun.password.verify(password, passwordHash);
}
