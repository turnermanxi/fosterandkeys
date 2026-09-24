import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "Foster & Keys — Property Matching",
  description:
    "Real estate lead scoring and property matching dashboard for Foster & Keys.",
};

export default function RootLayout({ children }) {
  const themeScript = `(() => {
    try {
      const saved = localStorage.getItem('fk-theme');
      const theme = saved === 'light' || saved === 'dark'
        ? saved
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = theme;
    } catch (_) {
      document.documentElement.dataset.theme = 'light';
    }
  })();`;

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <header className="app-header">
          <a href="/" className="app-header__brand">
            <span className="app-header__mark">F&amp;K</span>
            <span>
              <h1>Foster &amp; Keys</h1>
              <small>Lead intelligence</small>
            </span>
          </a>
          <ThemeToggle />
        </header>
        {children}
      </body>
    </html>
  );
}
