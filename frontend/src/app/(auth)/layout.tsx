export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.12_195/0.12),transparent_60%)]"
      />
      <div className="relative w-full flex justify-center">{children}</div>
      <p className="absolute bottom-4 px-4 text-center text-xs text-muted-foreground">
        For education and professional learning only. Not for diagnosis or treatment.
      </p>
    </main>
  );
}
