import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-6 px-4 py-20 text-center sm:px-6 lg:py-28">
      <Badge tone="accent">Case Study Builder · v0.1</Badge>
      <div className="flex max-w-2xl flex-col items-center gap-4">
        <h1 className="type-display-l text-foreground">Casefolio</h1>
        <p className="text-muted-foreground type-body-l">
          Build polished UI case studies in minutes.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button size="lg">Get Started</Button>
        <Button variant="secondary" size="lg">
          Browse Templates
        </Button>
      </div>
    </section>
  );
}
