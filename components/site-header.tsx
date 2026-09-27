import Link from "next/link";
import { ShieldIcon } from "@/components/icons";

export function SiteHeader() {
  return <header className="border-b border-slate-800/80 bg-slate-950/75 backdrop-blur"><div className="shell flex h-16 items-center justify-between"><Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-wide text-slate-100"><span className="grid size-8 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"><ShieldIcon className="size-4" /></span><span>SCNZOS <span className="text-slate-400">SecureLab</span></span></Link><nav aria-label="Main navigation" className="flex items-center gap-5 text-sm text-slate-400"><Link href="/#tools" className="transition hover:text-cyan-300">Tools</Link><Link href="/#about" className="hidden transition hover:text-cyan-300 sm:block">About</Link></nav></div></header>;
}
