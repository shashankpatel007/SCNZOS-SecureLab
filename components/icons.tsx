type IconProps = { className?: string };

export function ShieldIcon({ className = "size-5" }: IconProps) {
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3 5 6v5c0 4.7 2.9 8.3 7 10 4.1-1.7 7-5.3 7-10V6l-7-3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="m9.5 12 1.7 1.7 3.6-3.6" /></svg>;
}

export function FileIcon({ className = "size-6" }: IconProps) {
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8l-5-5Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M8 13h8M8 17h5" /></svg>;
}

export function ImageIcon({ className = "size-6" }: IconProps) {
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><rect width="16" height="16" x="4" y="4" rx="2" /><circle cx="9" cy="9" r="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="m5 17 4-4 3 3 2-2 5 5" /></svg>;
}

export function RouteIcon({ className = "size-6" }: IconProps) {
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h3a4 4 0 0 1 4 4v4a4 4 0 0 0 4 4M16 18h-3a4 4 0 0 1-4-4v-4a4 4 0 0 0-4-4" /></svg>;
}

export function ArrowUpRightIcon({ className = "size-4" }: IconProps) {
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M8 7h9v9" /></svg>;
}
