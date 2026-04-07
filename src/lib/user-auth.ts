import "server-only";

import { dbQuery } from "@/lib/db";

type UserRow = {
  id: number;
  username: string;
  hcode: string;
  hname: string;
};

export async function verifyUserPassword(
  username: string,
  password: string,
): Promise<UserRow | null> {
  const result = await dbQuery<UserRow>(
    `SELECT id, username, hcode, hname
     FROM public.users
     WHERE username = $1
       AND password_hash = crypt($2, password_hash)
       AND is_active = true`,
    [username, password],
  );

  return result.rows[0] ?? null;
}
