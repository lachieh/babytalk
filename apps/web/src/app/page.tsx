export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Babytalk</h1>
      <p className="mt-4 text-lg text-gray-600">Welcome to Babytalk</p>
      <a
        href="/auth/login"
        className="mt-8 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
      >
        Sign In
      </a>
    </main>
  );
}
