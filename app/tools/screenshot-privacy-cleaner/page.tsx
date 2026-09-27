import type { Metadata } from "next";
import { ToolWorkspace } from "@/components/tool-workspace";
import { getTool } from "@/lib/tools";

export const metadata: Metadata = { title: "Screenshot Privacy Cleaner" };

export default function ScreenshotPrivacyCleanerPage() {
  return <ToolWorkspace tool={getTool("screenshot-privacy-cleaner")!} />;
}
