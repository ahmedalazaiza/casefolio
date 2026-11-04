"use client";

import { ChevronDown, Copy, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";

export function DevUiInteractive() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="border-border bg-card flex flex-col gap-4 rounded-xl border p-6">
        <div className="flex flex-col gap-1">
          <span className="text-tertiary type-overline">Segment · 2:143</span>
          <h3 className="text-foreground type-heading-s">Segmented control (Tabs)</h3>
        </div>
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All projects</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="text-muted-foreground type-body-s pt-2">
            Showing all 6 case studies across Mobile and Web templates.
          </TabsContent>
          <TabsContent value="published" className="text-muted-foreground type-body-s pt-2">
            Showing published case studies live at /p/[slug].
          </TabsContent>
          <TabsContent value="drafts" className="text-muted-foreground type-body-s pt-2">
            Showing work-in-progress drafts with autosave enabled.
          </TabsContent>
        </Tabs>
      </div>

      <div className="border-border bg-card flex flex-col gap-4 rounded-xl border p-6">
        <div className="flex flex-col gap-1">
          <span className="text-tertiary type-overline">Overlays & Feedback</span>
          <h3 className="text-foreground type-heading-s">Dialog, Sheet, Menu & Toast</h3>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish case study</DialogTitle>
                <DialogDescription>
                  Make Orbit Fintech live at a shareable public URL with generated OG metadata.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="default">Publish now</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">Open drawer</Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Section inspector</SheetTitle>
                <SheetDescription>
                  Constrained fields-only editor panel for Mobile & tablet breakpoints.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                Actions
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Case study</DropdownMenuLabel>
              <DropdownMenuItem>
                <Copy className="size-4" />
                Duplicate project
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Sparkles className="size-4" />
                Export PNG / PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2 className="size-4" />
                Delete draft
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            onClick={() => toast("Autosaved changes to Orbit Case Study")}
          >
            Trigger toast
          </Button>
        </div>
      </div>
    </div>
  );
}

