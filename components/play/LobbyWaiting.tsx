export function LobbyWaiting({ workshopName }: { workshopName: string }) {
  return (
    <section className="m-auto flex max-w-[480px] flex-col items-center gap-3 px-6 text-center">
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        WAITING IN THE LOBBY
      </div>
      <h1 className="t-display text-3xl">{workshopName}</h1>
      <p className="text-[15px] text-[var(--color-ink-2)]">
        Your facilitator will assign you a role any moment. This page updates
        automatically.
      </p>
      <div className="t-card mt-2 flex items-center gap-3 px-4 py-3">
        <span
          aria-hidden="true"
          className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white"
          style={{ background: "var(--color-t-orange)" }}
        >
          ◌
        </span>
        <span className="text-[13px]">Hold tight — polling every 2s</span>
      </div>
    </section>
  );
}
