import type { Metadata } from "next";
import { UrlRedirectVisualizer } from "@/components/url-redirect-visualizer";
import { ToolWorkspace } from "@/components/tool-workspace";
import { getTool } from "@/lib/tools";

export const metadata: Metadata = { title: "URL Redirect Visualizer" };

export default function UrlRedirectVisualizerPage() {
  return <ToolWorkspace tool={getTool("url-redirect-visualizer")!} interactiveContent={<UrlRedirectVisualizer />} />;
}
