"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function authenticate(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  try {
    await signIn("credentials", { password: formData.get("password"), redirectTo: "/" });
  } catch (error) {
    // next-auth's signIn() throws a special redirect error internally on
    // success — only AuthError (a genuine failed sign-in) should be caught
    // and turned into a message; anything else must be re-thrown so the
    // redirect actually happens.
    if (error instanceof AuthError) {
      return "Incorrect password.";
    }
    throw error;
  }
}
