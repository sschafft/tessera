import Link from "next/link";

const REPO_URL = "https://github.com/sschafft/tessera";

/**
 * Open-source / free-tier note + GitHub link, used at the foot of the
 * landing and content pages.
 */
export function OssFooter() {
  return (
    <footer className="relative z-10 mx-auto mt-12 max-w-[680px] border-t border-[var(--color-line)] px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[12px] text-[var(--color-ink-3)]">
          Open source · runs on free-tier infra · fork to self-host.
        </p>
        <Link
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-ink-2)] underline-offset-2 hover:underline"
        >
          <GithubIcon />
          GitHub
        </Link>
      </div>
    </footer>
  );
}

export function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2 .37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.43 7.43 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
