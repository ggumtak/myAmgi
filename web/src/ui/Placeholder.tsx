import { AppBar } from './AppBar';
import { IconTool } from './icons';
import './Placeholder.css';

/** Neutral stand-in for screens that are not built yet. Names the screen. */
export function Placeholder({ title, detail, back = true }: { title: string; detail?: string; back?: boolean }) {
  return (
    <div className="screen">
      <AppBar title={title} back={back} />
      <div className="placeholder" data-testid="placeholder">
        <IconTool size={36} />
        <h2 className="placeholder__title">{title}</h2>
        <p className="placeholder__text">준비 중입니다.</p>
        {detail && <p className="placeholder__detail">{detail}</p>}
      </div>
    </div>
  );
}
