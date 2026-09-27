import type { Metadata } from "next";
import { FilePrivacyInspector } from "@/components/file-privacy-inspector";
import { ToolWorkspace } from "@/components/tool-workspace";
import { getTool } from "@/lib/tools";

export const metadata: Metadata = { title: "File Privacy Inspector" };

export default function FilePrivacyInspectorPage() {
  return <ToolWorkspace tool={getTool("file-privacy-inspector")!} interactiveContent={<FilePrivacyInspector />} />;
}
