// Next.js 16.3 Turbopack import.meta.glob module loader with HMR support
export function loadDocModules() {
  if (typeof import.meta !== 'undefined' && 'glob' in import.meta) {
    // Turbopack Vite-compatible glob import API (Next.js 16.3)
    return (import.meta as any).glob('./**/*.md', { eager: true });
  }
  return {};
}
