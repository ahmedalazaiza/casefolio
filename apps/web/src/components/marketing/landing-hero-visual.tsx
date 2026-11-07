export function LandingHeroVisual() {
  return (
    <figure
      id="hero-playground"
      aria-label="Casefolio editor preview showing narrative sections, live Cinema case study canvas, and ratio-locked screenshot slots"
      className="bg-elevated relative m-0 block w-full overflow-hidden select-none"
    >
      <img
        src="/landing/hero-editor-light.png"
        alt="Casefolio Studio Editor in light mode editing the Cinema case study with section controls, live mobile device preview, and screenshot slots"
        width={2880}
        height={1800}
        fetchPriority="high"
        decoding="async"
        className="block aspect-16/10 h-auto w-full object-cover object-top dark:hidden"
      />
      <img
        src="/landing/hero-editor-dark.png"
        alt="Casefolio Studio Editor in dark mode editing the Cinema case study with section controls, live mobile device preview, and screenshot slots"
        width={2880}
        height={1800}
        decoding="async"
        className="hidden aspect-16/10 h-auto w-full object-cover object-top dark:block"
      />
    </figure>
  );
}
