import { db } from "../db";

interface RefreshRow {
  id: number;
  user_id: number;
  token: string;
  expires_at: number;
  revoked: number;
}

export const refreshTokenRepo = {
  save(userId: number, token: string, expiresAt: number): void {
    db.prepare(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
    ).run(userId, token, expiresAt);
  },

  find(token: string): RefreshRow | undefined {
    return db.prepare("SELECT * FROM refresh_tokens WHERE token = ?").get(token) as
      | RefreshRow
      | undefined;
  },

  revoke(token: string): void {
    db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?").run(token);
  },
};
