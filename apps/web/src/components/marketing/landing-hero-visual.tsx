export function LandingHeroVisual() {
  return (
    <figure
      id="hero-playground"
      aria-label="Interactive preview of the Casefolio UI/UX case study builder showing storytelling sections, device mockups, and live publishing controls"
      className="bg-elevated relative m-0 block w-full overflow-hidden select-none"
    >
      <img
        src="/landing/hero-editor-light.png"
        alt="Casefolio editor in light mode displaying the Cinema case study with section controls, realistic iPhone mockups, and drop-in screen slots"
        width={2880}
        height={1800}
        fetchPriority="high"
        decoding="async"
        className="block aspect-16/10 h-auto w-full object-cover object-top dark:hidden"
      />
      <img
        src="/landing/hero-editor-dark.png"
        alt="Casefolio editor in dark mode displaying the Cinema case study with section controls, realistic iPhone mockups, and drop-in screen slots"
        width={2880}
        height={1800}
        decoding="async"
        className="hidden aspect-16/10 h-auto w-full object-cover object-top dark:block"
      />
    </figure>
  );
}
