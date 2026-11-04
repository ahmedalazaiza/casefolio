import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster, toast } from "@/components/ui/toast";

function mockMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function collectComponentFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectComponentFiles(full));
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

describe("shadcn/ui primitives & theme class strategy (C-002)", () => {
  it("renders Button, Input, and Tabs with interactive tab switching", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Button>Create Case Study</Button>
        <Input placeholder="Project title" aria-label="Project title" />
        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
          </TabsList>
          <TabsContent value="content">Content editor panel</TabsContent>
          <TabsContent value="style">Style tokens panel</TabsContent>
        </Tabs>
      </div>,
    );

    expect(screen.getByRole("button", { name: "Create Case Study" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project title")).toBeInTheDocument();
    expect(screen.getByText("Content editor panel")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Style" }));
    expect(screen.getByText("Style tokens panel")).toBeInTheDocument();
  });

  it("opens Dialog, Sheet, DropdownMenu, and triggers toast", async () => {
    mockMatchMedia();
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish Case Study</DialogTitle>
              <DialogDescription>Share your case study via a public URL.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Open Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Section Fields</SheetTitle>
              <SheetDescription>Edit constrained section fields.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">Actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Duplicate project</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={() => toast("Draft saved")}>Trigger Toast</Button>
        <Toaster />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open Dialog" }));
    expect(await screen.findByText("Publish Case Study")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Open Sheet" }));
    expect(await screen.findByText("Section Fields")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(await screen.findByText("Duplicate project")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Trigger Toast" }));
    expect(await screen.findByText("Draft saved")).toBeInTheDocument();
  });

  it("toggles .dark and .light classes on documentElement via ThemeProvider", async () => {
    mockMatchMedia();
    const user = userEvent.setup();
    document.documentElement.className = "";

    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains("light")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Toggle color theme" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("contains zero raw hex colors, px font sizes, or hardcoded font names in apps/web/src/components", () => {
    const componentsDir = join(process.cwd(), "apps/web/src/components");
    const files = collectComponentFiles(componentsDir).filter(
      (file) => !file.endsWith(".test.tsx") && !file.endsWith(".test.ts"),
    );
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/;
    const pxFontPattern = /text-\[\d+px\]|font-size:\s*\d+px/;
    const fontNamePattern = /Geist|JetBrains/i;

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      expect(content, `Unexpected raw hex color in ${file}`).not.toMatch(hexPattern);
      expect(content, `Unexpected px font size in ${file}`).not.toMatch(pxFontPattern);
      expect(content, `Unexpected hardcoded font name in ${file}`).not.toMatch(fontNamePattern);
    }
  });
});

