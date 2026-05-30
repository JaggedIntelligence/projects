import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <SignIn appearance={{ elements: { rootBox: "w-full", cardBox: "mx-auto" } }} />
    </main>
  );
}
