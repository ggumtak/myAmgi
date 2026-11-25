import { AppBar } from '../../ui/AppBar';
import { AboutSection } from './AboutSection';
import './Settings.css';

/** `#/settings/about`: version and diagnostics. */
export function AboutScreen() {
  return (
    <div className="screen">
      <AppBar title="정보" back />
      <div className="screen__body settings">
        <AboutSection />
      </div>
    </div>
  );
}
