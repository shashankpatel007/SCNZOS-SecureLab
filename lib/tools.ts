import type { ComponentType } from "react";
import { FileIcon, ImageIcon, RouteIcon } from "@/components/icons";

export type ToolAccent = "cyan" | "violet" | "emerald";

export type Tool = {
  slug: string;
  name: string;
  description: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  accent: ToolAccent;
  plannedSteps: string[];
};

export const tools: Tool[] = [
  {
    slug: "file-privacy-inspector",
    name: "File Privacy Inspector",
    description: "Understand what metadata a file may reveal before you share it.",
    detail: "A clear, client-side-first workspace for reviewing common document and media metadata.",
    icon: FileIcon,
    accent: "cyan",
    plannedSteps: ["Choose a local file", "Inspect available metadata", "Review before sharing"],
  },
  {
    slug: "screenshot-privacy-cleaner",
    name: "Screenshot Privacy Cleaner",
    description: "Prepare screenshots for sharing by spotting sensitive details.",
    detail: "A focused review surface for identifying private content in screenshots before export.",
    icon: ImageIcon,
    accent: "violet",
    plannedSteps: ["Add a screenshot", "Mark sensitive areas", "Export a cleaned copy"],
  },
  {
    slug: "url-redirect-visualizer",
    name: "URL Redirect Visualizer",
    description: "Make a link’s redirect path easier to understand at a glance.",
    detail: "A readable visualization for checking each step in a URL’s redirect chain.",
    icon: RouteIcon,
    accent: "emerald",
    plannedSteps: ["Enter a URL", "Trace each hop", "Review the destination"],
  },
];

export function getTool(slug: string) {
  return tools.find((tool) => tool.slug === slug);
}
