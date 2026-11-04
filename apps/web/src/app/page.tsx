import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <span className="bg-accent text-accent-foreground rounded-full px-3 py-1 font-mono text-xs font-medium">
          v0.1.0
        </span>
        <ThemeToggle />
      </div>
      <div className="flex max-w-xl flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Casefolio</h1>
        <p className="text-muted-foreground text-lg">
          Build polished UI case studies in minutes.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button>Get Started</Button>
        <Button variant="outline">Browse Templates</Button>
      </div>
    </main>
  );
}
