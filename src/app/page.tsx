export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>Silver App API</h1>
      <p>
        상태 확인: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
