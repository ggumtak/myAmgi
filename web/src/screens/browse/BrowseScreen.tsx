import { Placeholder } from '../../ui/Placeholder';

/** Card browser (`#/browse?q=`) — built in the next round. */
export function BrowseScreen({ query }: { query: string }) {
  return <Placeholder title="찾아보기" detail={query ? `검색: ${query}` : undefined} back={false} />;
}
