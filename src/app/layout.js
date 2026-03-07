import "./globals.css";

export const metadata = {
  title: "Foster & Keys — Property Matching",
  description:
    "Real estate lead scoring and property matching dashboard for Foster & Keys.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <a href="/" style={{ color: "#fff", textDecoration: "none" }}>
            <h1>Foster &amp; Keys</h1>
          </a>
        </header>
        {children}
      </body>
    </html>
  );
}
