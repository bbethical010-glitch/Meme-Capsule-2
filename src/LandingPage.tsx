import "./landing.css";

type PortalOption = {
  label: string;
  description: string;
  href: string;
  className: string;
};

const portals: PortalOption[] = [
  {
    label: "SUPERADMIN",
    description: "Curate, review, and resolve the meme corpus.",
    href: "/curate",
    className: "landing-option-superadmin",
  },
  {
    label: "ADMIN",
    description: "Manage storage, schedules, notifications, and analytics.",
    href: "/admin",
    className: "landing-option-admin",
  },
  {
    label: "REPORTS",
    description: "Review user reports and moderate flagged content.",
    href: "/reports",
    className: "landing-option-reports",
  },
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <div className="landing-grid" aria-hidden="true" />
      <section className="landing-card" aria-labelledby="landing-title">
        <div className="landing-brand">
          <span className="landing-brand-mark">MC</span>
          <span>MEME CAPSULE</span>
        </div>
        <p className="landing-kicker">INTERNAL OPERATIONS PORTAL</p>
        <h1 id="landing-title">
          Pick your
          <br />
          <span>workbench.</span>
        </h1>
        <p className="landing-intro">
          Choose a workspace to keep the capsule curated, managed, and safe.
        </p>
        <nav className="landing-options" aria-label="Internal workbenches">
          {portals.map((portal) => (
            <a className={`landing-option ${portal.className}`} href={portal.href} key={portal.href}>
              <span className="landing-option-copy">
                <strong>{portal.label}</strong>
                <small>{portal.description}</small>
              </span>
              <span className="landing-option-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
        <p className="landing-footer">AUTHORIZED ACCESS ONLY · MEME CAPSULE EDGE</p>
      </section>
    </main>
  );
}
