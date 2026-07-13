import Link from "next/link";
import { signUp } from "@/lib/auth-actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-bold">Buddy Cup</h1>
      <p className="mb-6 text-sm text-neutral-500">Create your account</p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form action={signUp} className="flex flex-col gap-3">
        <input
          name="name"
          type="text"
          required
          placeholder="Full name"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Password"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          className="mt-2 rounded-md bg-green-700 px-3 py-2 font-medium text-white hover:bg-green-800"
        >
          Sign up
        </button>
      </form>

      <p className="mt-4 text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="text-green-700 underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
