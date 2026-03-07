export default function Home() {
  return (
    <div className="page-wrapper" style={{ textAlign: "center", paddingTop: 80 }}>
      <h1 style={{ fontSize: "2rem", marginBottom: 8, color: "var(--color-primary)" }}>
        Foster &amp; Keys
      </h1>
      <p className="text-muted" style={{ marginBottom: 32 }}>
        Real Estate Lead Scoring &amp; Property Matching
      </p>
      <a className="btn btn-primary" href="/login">
        Sign In &rarr;
      </a>
    </div>
  );
}
