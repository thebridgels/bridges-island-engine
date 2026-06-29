import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  // Returning testers skip the splash. Same server-side session pattern the
  // authenticated pages use; anonymous visitors fall through to the splash.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Bridges</h1>
      <p className="text-lg text-gray-700 dark:text-gray-300">
        Build your island. Choose your bridges.
      </p>
      <p className="max-w-md text-center text-gray-600 dark:text-gray-400">
        A human-centered digital environment for owned, permissioned digital
        spaces.
      </p>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-500">
        Private Alpha — currently under construction.
      </p>
      <Link
        href="/login"
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        Alpha Login
      </Link>
    </main>
  );
}
