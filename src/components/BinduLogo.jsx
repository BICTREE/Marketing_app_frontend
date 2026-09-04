import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const BINDU_LOGO = '/logo-gold.png';

/** Gold BJ monogram on navy — same mark used in staff emails. */
export function BinduMark({ size = 40, className = '' }) {
  const box = typeof size === 'number' ? `${size}px` : size;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-xl bg-[#0F172A] border border-[#C9972A]/45 shadow-sm shrink-0 overflow-hidden',
        className,
      )}
      style={{ width: box, height: box }}
      aria-hidden="true"
    >
      <img
        src={BINDU_LOGO}
        alt=""
        className="object-contain"
        style={{ width: '78%', height: '78%' }}
      />
    </span>
  );
}

export function BinduWordmark({ subtitle, className = '', to, markSize = 40 }) {
  const inner = (
    <>
      <BinduMark size={markSize} />
      <span className="min-w-0">
        <span
          className="block font-bold text-foreground leading-tight tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Bindu Jewellery
        </span>
        {subtitle ? (
          <span className="block text-[10px] uppercase tracking-[0.16em] font-semibold text-[#C9972A] mt-0.5">
            {subtitle}
          </span>
        ) : null}
      </span>
    </>
  );
  const cls = cn('flex items-center gap-3 min-w-0', className);
  if (to) {
    return (
      <Link to={to} className={cls} aria-label="Bindu Jewellery home">
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export default BinduWordmark;
