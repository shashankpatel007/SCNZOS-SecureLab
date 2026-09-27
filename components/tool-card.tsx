import Link from "next/link";
import { ArrowUpRightIcon } from "@/components/icons";
import type { Tool } from "@/lib/tools";

const accentStyles = { cyan: "border-cyan-400/20 bg-cyan-400/8 text-cyan-300", violet: "border-violet-400/20 bg-violet-400/8 text-violet-300", emerald: "border-emerald-400/20 bg-emerald-400/8 text-emerald-300" } as const;

export function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  return <Link href={`/tools/${tool.slug}`} className="group flex min-h-64 flex-col rounded-2xl border border-slate-800 bg-slate-900/65 p-6 transition duration-200 hover:-translate-y-1 hover:border-slate-600 hover:bg-slate-900"><div className={`mb-8 grid size-11 place-items-center rounded-xl border ${accentStyles[tool.accent]}`}><Icon className="size-5" /></div><div className="mt-auto"><div className="mb-2 flex items-start justify-between gap-3"><h3 className="text-lg font-semibold text-slate-100">{tool.name}</h3><ArrowUpRightIcon className="mt-1 size-4 shrink-0 text-slate-500 transition group-hover:text-cyan-300" /></div><p className="text-sm leading-6 text-slate-400">{tool.description}</p></div></Link>;
}
