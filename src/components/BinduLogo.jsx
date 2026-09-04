import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const BINDU_LOGO = '/logo-gold.png';

/** Gold BJ monogram, no box — it is already a finished mark. */
export function BinduMark({ size = 40, className = '' }) {
  const box = typeof size === 'number' ? `${size}px` : size;
  return (
    <img
      src={BINDU_LOGO}
      alt="Bindu Jewellery"
      className={cn('object-contain shrink-0', className)}
      style={{ width: box, height: box }}
    />
  );
}

export function BinduWordmark({ subtitle, className = '', to, markSize = 44 }) {
  const inner = (
    <>
      <BinduMark size={markSize} />
      <span className="min-w-0">
        <span
          className="block font-semibold text-foreground leading-tight tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Bindu Jewellery
        </span>
        {subtitle ? (
          <span className="block text-[10px] uppercase tracking-[0.14em] font-medium text-muted-foreground mt-0.5">
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
