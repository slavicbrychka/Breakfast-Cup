import Link from "next/link";
import { signIn } from "@/lib/auth-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-bold">The Breakfast Cup</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">Log in to your account</p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {message && !error && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {message}
        </p>
      )}

      <form action={signIn} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          className="mt-2 rounded-md bg-green-700 px-3 py-2 font-medium text-white hover:bg-green-800"
        >
          Log in
        </button>
      </form>

      <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
        No account yet?{" "}
        <Link href="/signup" className="text-green-700 underline dark:text-green-400">
          Sign up
        </Link>
      </p>
    </div>
  );
}
