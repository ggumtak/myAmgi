// Tells the Android shell what the reviewer needs: keep the screen on and
// capture hardware keys (volume / media) as DOM keydown events. Host function
// `ui.state`; hosts without it (desktop) answer with an error, which is ignored.
import { hostCall } from '../../host';

export function setReviewerUiState(active: boolean): void {
  hostCall('ui.state', { keepScreenOn: active, captureKeys: active }).catch(() => {});
}
