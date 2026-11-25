import { OfficialPage } from '../../ui/OfficialPage';

/** Statistics: the official graphs page embedded. */
export function StatsScreen() {
  return <OfficialPage title="통계" src="/graphs" back={false} />;
}
