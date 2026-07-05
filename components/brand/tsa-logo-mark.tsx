type TsaLogoMarkProps = {
  className?: string;
  title?: string;
};

export function TsaLogoMark({ className, title = "The Study Architect" }: TsaLogoMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark.png"
      alt={title}
      className={className}
      width={48}
      height={48}
      decoding="async"
    />
  );
}
