'use client';
export default function LabError({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  return <main style={{padding: 32, maxWidth: 560}}><h1>Planet Lab could not load</h1><p>Your local draft remains in browser storage. Reload the workbench to try again.</p><button onClick={reset}>Retry workbench</button></main>;
}
