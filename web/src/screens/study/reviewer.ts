// The reviewer's controller: queue handling, showing question/answer, answering,
// actions, audio, auto-advance. Mirrors aqt/reviewer.py; every scheduling
// decision comes from the engine (getQueuedCards / SchedulingStates /
// describeNextStates / answerCard).
import { setCurrentDeck } from '../../anki/decks';
import { invoke } from '../../anki/rpc';
import { hostCall } from '../../host';
import { describeError } from '../../lib/errors';
import type { Theme } from '../../lib/theme';
import { toast } from '../../ui/Toast';
import { AvPlayer, type AvTag } from './avPlayer';
import { cardBodyClass, parsePlayCommand, typeAnsAnswerFilter } from './cardText';
import { FrameBridge, type FrameEvent } from './frameBridge';
import type { StudyAction } from './keymap';
import * as api from './studyApi';
import { activeQueueIndex, answerButtons, RATING_VALUE, timeTakenMs, type AnswerButton, type RatingName, type StudyPrefs } from './studyLogic';

export type Phase = 'loading' | 'question' | 'answer' | 'congrats' | 'error';

export interface CardSummary {
  id: number;
  noteId: number;
  deckId: number;
  originalDeckId: number;
  /** Deck whose options apply (original deck for filtered decks). */
  homeDeckId: number;
  flag: number;
  marked: boolean;
  queue: number;
}

export interface ReviewerView {
  phase: Phase;
  busy: boolean;
  error: unknown;
  deckName: string;
  card: CardSummary | null;
  counts: [number, number, number];
  activeIdx: 0 | 1 | 2;
  showRemaining: boolean;
  buttons: AnswerButton[];
  intervalsReady: boolean;
  undoLabel: string;
  redoLabel: string;
  /** Visible timer (deck option "show answer timer"); null when hidden. */
  timer: { startedAt: number; capMs: number; stoppedAt: number | null } | null;
  scriptErrors: string[];
  autoAdvance: boolean;
  /** Side whose render finished in the frame (for tests and focus handling). */
  rendered: 'question' | 'answer' | null;
  hasAudio: boolean;
  timebox: { cards: number; minutes: number } | null;
}

const INITIAL: ReviewerView = {
  phase: 'loading',
  busy: false,
  error: null,
  deckName: '',
  card: null,
  counts: [0, 0, 0],
  activeIdx: 0,
  showRemaining: true,
  buttons: [],
  intervalsReady: false,
  undoLabel: '',
  redoLabel: '',
  timer: null,
  scriptErrors: [],
  autoAdvance: false,
  rendered: null,
  hasAudio: false,
  timebox: null,
};

interface Resume {
  deckId: number;
  cardId: number;
  side: 'question' | 'answer';
  startedAt: number;
  at: number;
}

/** Survives the screen being unmounted (edit note, card info, deck options) so we come back to the same card and side. */
let lastSession: Resume | null = null;

export interface ReviewerOptions {
  prefs: StudyPrefs;
  theme: Theme;
  platform: string;
}

type EngineReviewing = { hideAudioPlayButtons: boolean; interruptAudio: boolean; showRemaining: boolean; showIntervals: boolean; timeLimitSecs: number };

export class Reviewer {
  readonly frame = new FrameBridge();
  readonly player = new AvPlayer();
  private view: ReviewerView = INITIAL;
  private listeners = new Set<() => void>();
  private opts: ReviewerOptions;
  private engine: EngineReviewing = { hideAudioPlayButtons: false, interruptAudio: true, showRemaining: true, showIntervals: true, timeLimitSecs: 0 };
  private customizer = '';
  private inject: string | null = null;
  private top: api.QueuedCard | null = null;
  private prepared: api.PreparedCard | null = null;
  private conf: api.DeckConfig | null = null;
  private states: api.States | null = null;
  private labels: string[] = [];
  private statesReady: Promise<void> = Promise.resolve();
  private cache = new Map<number, Promise<api.PreparedCard>>();
  private startedAt = 0;
  private gen = 0;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionStart = Date.now();
  private sessionReps = 0;
  private disposed = false;
  private offFrame: () => void;
  private lastAnswerHtml = '';

  constructor(
    readonly deckId: number,
    opts: ReviewerOptions,
    private readonly hooks: { navigate: (path: string) => void; confirmDelete: () => void; openMenu: () => void; openSetDue: () => void; openForget: () => void } = {
      navigate: () => {},
      confirmDelete: () => {},
      openMenu: () => {},
      openSetDue: () => {},
      openForget: () => {},
    },
  ) {
    this.opts = opts;
    this.offFrame = this.frame.on(this.onFrameEvent);
  }

  // --- store -------------------------------------------------------------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.view;

  private set(patch: Partial<ReviewerView>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((l) => l());
  }

  // --- lifecycle -----------------------------------------------------------

  async start(): Promise<void> {
    this.set({ ...INITIAL, autoAdvance: this.opts.prefs.autoAdvance });
    try {
      await setCurrentDeck(this.deckId);
      const [deck, reviewing, customizer] = await Promise.all([
        invoke('getDeck', { did: this.deckId }),
        api.reviewingPrefs().catch(() => null),
        api.cardStateCustomizer(),
        this.refreshUndo(),
      ]);
      this.customizer = customizer.trim();
      if (reviewing) {
        this.engine = {
          hideAudioPlayButtons: !!reviewing.hideAudioPlayButtons,
          interruptAudio: !!reviewing.interruptAudioWhenAnswering,
          showRemaining: reviewing.showRemainingDueCounts ?? true,
          showIntervals: reviewing.showIntervalsOnButtons ?? true,
          timeLimitSecs: reviewing.timeLimitSecs ?? 0,
        };
      }
      this.set({ deckName: deck.name, showRemaining: this.opts.prefs.showRemaining ?? this.engine.showRemaining });
      if (this.opts.prefs.hanja) {
        // Host function from the Android shell; absent elsewhere (then the feature is off).
        const script = hostCall<{ version?: string; js?: string }>('hanja.script').then(
          (r) => (this.inject = typeof r?.js === 'string' && r.js ? r.js : null),
          () => (this.inject = null),
        );
        await Promise.race([script, new Promise((r) => setTimeout(r, 1500))]);
      }
      this.applyFrameConfig();
    } catch (error) {
      this.set({ phase: 'error', error });
      return;
    }
    const resume = lastSession && lastSession.deckId === this.deckId && Date.now() - lastSession.at < 3600_000 ? lastSession : null;
    lastSession = null;
    await this.loadNext(resume);
  }

  dispose(): void {
    if (this.view.card && (this.view.phase === 'question' || this.view.phase === 'answer')) {
      lastSession = { deckId: this.deckId, cardId: this.view.card.id, side: this.view.phase, startedAt: this.startedAt, at: Date.now() };
    }
    this.disposed = true;
    this.gen++;
    this.clearAutoTimer();
    this.offFrame();
    this.player.dispose();
    this.frame.dispose();
    this.listeners.clear();
  }

  setOptions(opts: ReviewerOptions): void {
    const themeChanged = opts.theme !== this.opts.theme;
    const scaleChanged = opts.prefs.fontScale !== this.opts.prefs.fontScale;
    this.opts = opts;
    if (themeChanged || scaleChanged) this.applyFrameConfig();
    this.set({
      showRemaining: opts.prefs.showRemaining ?? this.engine.showRemaining,
      buttons: this.states ? answerButtons(this.states, this.labels, opts.prefs.twoButton, this.showIntervals()) : [],
    });
    if (themeChanged) void this.rerender();
  }

  private showIntervals(): boolean {
    return this.opts.prefs.showIntervals ?? this.engine.showIntervals;
  }

  private applyFrameConfig(): void {
    this.frame.setConfig({
      htmlClass: this.opts.theme === 'dark' ? 'night-mode' : this.opts.theme === 'eink' ? 'eink' : '',
      fontScale: this.opts.prefs.fontScale,
      inject: this.inject,
    });
  }

  // --- queue ---------------------------------------------------------------

  private prepare(card: api.QueuedCard['card']): Promise<api.PreparedCard> {
    const id = card!.id ?? 0;
    const cached = this.cache.get(id);
    this.cache.clear();
    if (cached) return cached.catch(() => api.prepareCard(card!, this.engine.hideAudioPlayButtons));
    return api.prepareCard(card!, this.engine.hideAudioPlayButtons);
  }

  /** Fetches the queue and shows the top card's question (or the congrats page). */
  async loadNext(resume: Resume | null = null): Promise<void> {
    const gen = ++this.gen;
    this.clearAutoTimer();
    this.player.stop();
    let queued: api.QueuedCards;
    try {
      queued = await api.getQueuedCards(2);
    } catch (error) {
      if (gen === this.gen) this.set({ phase: 'error', error, busy: false });
      return;
    }
    if (gen !== this.gen) return;
    const counts: [number, number, number] = [queued.newCount ?? 0, queued.learningCount ?? 0, queued.reviewCount ?? 0];
    if (!queued.cards.length) {
      this.top = this.prepared = null;
      this.states = null;
      this.set({ phase: 'congrats', card: null, counts, busy: false, buttons: [], timer: null, rendered: null });
      void this.refreshUndo();
      return;
    }
    const top = queued.cards[0];
    const card = top.card!;
    const states = top.states!;
    // As aqt's V3CardInfo.from_queue: custom data of the current state comes from the card.
    if (states.current) states.current.customData = card.customData;
    let prepared: api.PreparedCard;
    let conf: api.DeckConfig;
    try {
      [prepared, conf] = await Promise.all([this.prepare(card), api.deckConfigForCard(card)]);
    } catch (error) {
      if (gen === this.gen) this.set({ phase: 'error', error, busy: false });
      return;
    }
    if (gen !== this.gen) return;
    this.top = top;
    this.prepared = prepared;
    this.conf = conf;
    this.states = states;
    this.labels = [];
    this.startedAt = resume && resume.cardId === card.id ? resume.startedAt : Date.now();
    const homeDeckId = card.originalDeckId || card.deckId || 0;
    this.set({
      phase: 'question',
      busy: false,
      error: null,
      card: {
        id: card.id ?? 0,
        noteId: card.noteId ?? 0,
        deckId: card.deckId ?? 0,
        originalDeckId: card.originalDeckId ?? 0,
        homeDeckId,
        flag: (card.flags ?? 0) & 0b111,
        marked: prepared.marked,
        queue: top.queue ?? 0,
      },
      counts,
      activeIdx: activeQueueIndex(top.queue),
      buttons: answerButtons(states, [], this.opts.prefs.twoButton, false),
      intervalsReady: false,
      timer: conf.showTimer ? { startedAt: this.startedAt, capMs: (conf.capAnswerTimeToSecs ?? 60) * 1000, stoppedAt: null } : null,
      rendered: null,
      hasAudio: prepared.questionAv.length + prepared.answerAv.length > 0,
      scriptErrors: [],
    });
    this.statesReady = this.computeStates(gen);
    await this.showQuestionSide(gen, true);
    if (gen !== this.gen) return;
    // Preload the next card (render + images) to avoid a gap after answering.
    const next = queued.cards[1]?.card;
    if (next?.id && next.id !== card.id) {
      const nextId = next.id;
      const p = api.prepareCard(next, this.engine.hideAudioPlayButtons);
      this.cache.set(nextId, p);
      p.then((n) => this.frame.preload(n.question), () => this.cache.delete(nextId));
    }
    if (resume && resume.cardId === card.id && resume.side === 'answer') await this.showAnswer();
  }

  /** Runs the deck's custom scheduling (if any) and fetches the interval labels. */
  private async computeStates(gen: number): Promise<void> {
    let states = this.states!;
    if (this.customizer && this.top) {
      try {
        const bytes = await this.frame.mutateStates(this.customizer, api.encodeStatesWithContext(states, this.top.context));
        if (bytes && bytes.length) {
          const req = api.decodeSetStatesRequest(bytes);
          if (req.states) states = req.states;
        }
      } catch {
        // keep the engine's states
      }
    }
    if (gen !== this.gen) return;
    this.states = states;
    let labels: string[] = [];
    try {
      labels = await api.describeNextStates(states);
    } catch {
      labels = [];
    }
    if (gen !== this.gen) return;
    this.labels = labels;
    this.set({ buttons: answerButtons(states, labels, this.opts.prefs.twoButton, this.showIntervals()), intervalsReady: true });
  }

  private frameInfo(side: 'question' | 'answer'): Record<string, unknown> {
    const c = this.top?.card;
    return {
      side,
      newCount: this.view.counts[0],
      lrnCount: this.view.counts[1],
      revCount: this.view.counts[2],
      marked: this.view.card?.marked ?? false,
      flag: this.view.card?.flag ?? 0,
      cardId: c?.id,
      noteId: c?.noteId,
      deckId: c?.deckId,
      originalDeckId: c?.originalDeckId,
      type: c?.ctype,
      queue: c?.queue,
      reps: c?.reps,
      lapses: c?.lapses,
      interval: c?.interval,
      factor: c?.easeFactor,
      due: c?.due,
      originalDue: c?.originalDue,
      left: c?.remainingSteps,
      mod: c?.mtimeSecs,
      deckName: this.view.deckName,
      nextTimes: this.labels,
      nightMode: this.opts.theme === 'dark',
    };
  }

  private bodyClass(): string {
    return cardBodyClass(this.prepared?.ord ?? 0, this.opts.theme, this.opts.platform, navigator.userAgent);
  }

  private async showQuestionSide(gen: number, autoplay: boolean): Promise<void> {
    const p = this.prepared!;
    const rendered = this.frame.render({
      side: 'question',
      html: p.question,
      css: p.css,
      bodyClass: this.bodyClass(),
      answerPreload: p.answer,
      info: this.frameInfo('question'),
    });
    this.frame.drawFlag(this.view.card?.flag ?? 0);
    this.frame.drawMark(this.view.card?.marked ?? false);
    if (autoplay && this.conf && !this.conf.disableAutoplay) this.player.play(p.questionAv, true);
    this.scheduleAutoAdvance('question');
    await rendered;
    if (gen === this.gen && this.view.phase === 'question') this.set({ rendered: 'question' });
  }

  /** Re-sends the current side (theme change, frame reloaded) without replaying audio. */
  private async rerender(): Promise<void> {
    if (!this.prepared) return;
    const gen = this.gen;
    if (this.view.phase === 'question') await this.showQuestionSide(gen, false);
    else if (this.view.phase === 'answer') {
      await this.frame.render({ side: 'question', html: this.prepared.question, css: this.prepared.css, bodyClass: this.bodyClass(), info: this.frameInfo('question') });
      await this.frame.render({ side: 'answer', html: this.lastAnswerHtml, css: this.prepared.css, bodyClass: this.bodyClass(), info: this.frameInfo('answer') });
      this.frame.drawFlag(this.view.card?.flag ?? 0);
      this.frame.drawMark(this.view.card?.marked ?? false);
    }
  }

  async showAnswer(): Promise<void> {
    if (this.view.phase !== 'question' || this.view.busy || !this.prepared) return;
    const gen = this.gen;
    const p = this.prepared;
    let html = p.answer;
    if (p.typeSpec) {
      let compared = '';
      if (p.typeTarget?.expected) {
        try {
          compared = await api.compareAnswer(p.typeTarget.expected, this.frame.typed ?? '', p.typeSpec.combining);
        } catch {
          compared = '';
        }
      }
      if (gen !== this.gen) return;
      html = typeAnsAnswerFilter(html, p.typeTarget, compared);
    }
    this.lastAnswerHtml = html;
    const timer = this.view.timer && this.conf?.stopTimerOnAnswer ? { ...this.view.timer, stoppedAt: Date.now() } : this.view.timer;
    this.set({ phase: 'answer', timer, rendered: null });
    const rendered = this.frame.render({ side: 'answer', html, css: p.css, bodyClass: this.bodyClass(), info: this.frameInfo('answer') });
    if (this.conf && !this.conf.disableAutoplay) this.player.play(p.answerAv, this.engine.interruptAudio);
    this.scheduleAutoAdvance('answer');
    await rendered;
    if (gen === this.gen && (this.view.phase as Phase) === 'answer') this.set({ rendered: 'answer' });
  }

  async answer(rating: RatingName): Promise<void> {
    if (this.view.phase !== 'answer' || this.view.busy || !this.top) return;
    // A rating the engine did not offer a state for cannot be answered.
    if (!this.states?.[rating]) return;
    this.set({ busy: true });
    this.clearAutoTimer();
    await this.statesReady;
    const states = this.states!;
    const cardId = this.top.card?.id ?? 0;
    const ms = timeTakenMs(this.startedAt, Date.now(), this.conf?.capAnswerTimeToSecs ?? 60);
    let newState: api.States['again'];
    try {
      newState = await api.answerCard(cardId, states, RATING_VALUE[rating], ms);
    } catch (e) {
      // Usually the card changed underneath (sync, another screen): start over from the engine's queue.
      toast(describeError(e).message, { kind: 'error' });
      await this.loadNext();
      return;
    }
    this.sessionReps++;
    if (newState) void this.checkLeech(cardId, newState);
    void this.refreshUndo();
    await this.loadNext();
    this.checkTimebox();
  }

  private async checkLeech(cardId: number, state: NonNullable<api.States['again']>): Promise<void> {
    if (!(await api.stateIsLeech(state))) return;
    let suspended = false;
    try {
      suspended = (await api.getCard(cardId)).queue < 0;
    } catch {
      // ignore
    }
    toast(`자주 잊는 카드(리치)입니다.${suspended ? ' 일시 중지되었습니다.' : ''}`);
  }

  private checkTimebox(): void {
    const limit = this.engine.timeLimitSecs;
    if (!limit || this.view.phase === 'congrats') return;
    const elapsed = (Date.now() - this.sessionStart) / 1000;
    if (elapsed < limit) return;
    this.set({ timebox: { cards: this.sessionReps, minutes: Math.round(elapsed / 60) } });
  }

  continueAfterTimebox(): void {
    this.sessionStart = Date.now();
    this.sessionReps = 0;
    this.set({ timebox: null });
  }

  /** Focus regained / sync finished / collection changed elsewhere: follow the engine without losing the shown side when nothing changed. */
  async refreshIfChanged(): Promise<void> {
    if (this.disposed || this.view.busy || this.view.phase === 'loading') return;
    let q: api.QueuedCards;
    try {
      q = await api.getQueuedCards(1);
    } catch {
      return;
    }
    const topId = q.cards[0]?.card?.id;
    if (this.view.phase === 'error' || topId !== this.view.card?.id || (this.view.phase === 'congrats') !== !topId) {
      this.cache.clear();
      await this.loadNext();
      return;
    }
    this.set({ counts: [q.newCount, q.learningCount, q.reviewCount] });
  }

  async refreshUndo(): Promise<void> {
    try {
      const s = await api.undoStatus();
      if (!this.disposed) this.set({ undoLabel: s.undo, redoLabel: s.redo });
    } catch {
      // ignore
    }
  }

  // --- actions -----------------------------------------------------------------

  private async op(fn: () => Promise<string | void>, opts: { reload?: boolean } = { reload: true }): Promise<void> {
    if (this.view.busy) return;
    this.set({ busy: true });
    try {
      const msg = await fn();
      if (msg) toast(msg);
    } catch (e) {
      toast(describeError(e).message, { kind: 'error' });
    }
    this.cache.clear();
    void this.refreshUndo();
    if (opts.reload !== false) await this.loadNext();
    else this.set({ busy: false });
  }

  undo(): Promise<void> {
    return this.op(async () => {
      if (!this.view.undoLabel) {
        const s = await api.undoStatus();
        if (!s.undo) return '실행 취소할 작업이 없습니다';
      }
      const out = await api.undo();
      return `실행 취소: ${out.operation}`;
    });
  }

  redo(): Promise<void> {
    return this.op(async () => {
      const s = await api.undoStatus();
      if (!s.redo) return '다시 실행할 작업이 없습니다';
      const out = await api.redo();
      return `다시 실행: ${out.operation}`;
    });
  }

  async setFlag(flag: number): Promise<void> {
    const card = this.view.card;
    if (!card || this.view.busy) return;
    // Like Anki: choosing the current flag again removes it.
    const next = card.flag === flag ? 0 : flag;
    await this.op(async () => {
      await api.setFlag([card.id], next);
      this.set({ card: { ...card, flag: next } });
      this.frame.drawFlag(next);
    }, { reload: false });
  }

  async toggleMark(): Promise<void> {
    const card = this.view.card;
    if (!card || this.view.busy) return;
    await this.op(async () => {
      await api.setMarked(card.noteId, !card.marked);
      this.set({ card: { ...card, marked: !card.marked } });
      if (this.prepared) this.prepared.marked = !card.marked;
      this.frame.drawMark(!card.marked);
      return card.marked ? '표시를 해제했습니다' : '노트를 표시했습니다';
    }, { reload: false });
  }

  buryCard() {
    const c = this.view.card;
    if (!c) return Promise.resolve();
    return this.op(async () => `카드 ${await api.buryOrSuspend('bury', { cardIds: [c.id] })}장을 숨겼습니다`);
  }
  buryNote() {
    const c = this.view.card;
    if (!c) return Promise.resolve();
    return this.op(async () => `카드 ${await api.buryOrSuspend('bury', { noteIds: [c.noteId] })}장을 숨겼습니다`);
  }
  suspendCard() {
    const c = this.view.card;
    if (!c) return Promise.resolve();
    return this.op(async () => {
      await api.buryOrSuspend('suspend', { cardIds: [c.id] });
      return '카드를 일시 중지했습니다';
    });
  }
  suspendNote() {
    const c = this.view.card;
    if (!c) return Promise.resolve();
    return this.op(async () => {
      await api.buryOrSuspend('suspend', { noteIds: [c.noteId] });
      return '노트를 일시 중지했습니다';
    });
  }
  forget(restorePosition: boolean, resetCounts: boolean) {
    const c = this.view.card;
    if (!c) return Promise.resolve();
    return this.op(async () => {
      await api.forgetCard(c.id, restorePosition, resetCounts);
      return '카드를 새 카드로 되돌렸습니다';
    });
  }
  setDueDate(days: string) {
    const c = this.view.card;
    if (!c) return Promise.resolve();
    return this.op(async () => {
      await api.setDueDate(c.id, days);
      return '복습 날짜를 지정했습니다';
    });
  }
  deleteNote() {
    const c = this.view.card;
    if (!c) return Promise.resolve();
    return this.op(async () => `노트를 삭제했습니다 (카드 ${await api.removeNote(c.noteId)}장)`);
  }

  replay(): void {
    const p = this.prepared;
    if (!p) return;
    if (this.view.phase === 'question') this.player.play(p.questionAv, true);
    else if (this.view.phase === 'answer') {
      const replayQ = !this.conf?.skipQuestionWhenReplayingAnswer;
      this.player.play(replayQ ? [...p.questionAv, ...p.answerAv] : p.answerAv, true);
    }
  }

  toggleAutoAdvance(): void {
    const on = !this.view.autoAdvance;
    this.set({ autoAdvance: on });
    toast(on ? '자동 넘기기를 켰습니다' : '자동 넘기기를 껐습니다');
    if (on && (this.view.phase === 'question' || this.view.phase === 'answer')) this.scheduleAutoAdvance(this.view.phase);
    else this.clearAutoTimer();
  }

  dismissScriptErrors(): void {
    this.set({ scriptErrors: [] });
  }

  /** Dispatches a keyboard / remote / bridge action. */
  perform(action: StudyAction): void {
    const card = this.view.card;
    switch (action) {
      case 'flip':
        void this.showAnswer();
        return;
      case 'again':
      case 'hard':
      case 'good':
      case 'easy':
        void this.answer(action);
        return;
      case 'undo':
        void this.undo();
        return;
      case 'redo':
        void this.redo();
        return;
      case 'replay':
        this.replay();
        return;
      case 'pauseAudio':
        this.player.togglePause();
        return;
      case 'toggleAutoAdvance':
        this.toggleAutoAdvance();
        return;
      case 'scrollUp':
        this.frame.scroll('lineUp');
        return;
      case 'scrollDown':
        this.frame.scroll('lineDown');
        return;
    }
    if (!card || (this.view.phase !== 'question' && this.view.phase !== 'answer')) return;
    switch (action) {
      case 'edit':
        this.hooks.navigate(`/note/${card.noteId}`);
        return;
      case 'cardInfo':
        this.hooks.navigate(`/card-info/${card.id}`);
        return;
      case 'options':
        this.hooks.navigate(`/deck-options/${card.homeDeckId}`);
        return;
      case 'menu':
        this.hooks.openMenu();
        return;
      case 'mark':
        void this.toggleMark();
        return;
      case 'buryCard':
        void this.buryCard();
        return;
      case 'buryNote':
        void this.buryNote();
        return;
      case 'suspendCard':
        void this.suspendCard();
        return;
      case 'suspendNote':
        void this.suspendNote();
        return;
      case 'forget':
        this.hooks.openForget();
        return;
      case 'setDue':
        this.hooks.openSetDue();
        return;
      case 'deleteNote':
        this.hooks.confirmDelete();
        return;
      default:
        if (action.startsWith('flag')) void this.setFlag(Number(action.slice(4)));
    }
  }

  // --- frame events --------------------------------------------------------------

  private onFrameEvent = (ev: FrameEvent) => {
    switch (ev.type) {
      case 'amgi:tap':
        if (this.opts.prefs.tapToFlip && this.view.phase === 'question') void this.showAnswer();
        return;
      case 'amgi:bridge':
        this.onBridge(ev.cmd);
        return;
      case 'amgi:script-error':
        this.set({ scriptErrors: [...this.view.scriptErrors, ev.message].slice(-20) });
        return;
      case 'amgi:reloaded':
        void this.rerender();
        return;
    }
  };

  private onBridge(cmd: string): void {
    if (cmd === 'ans') {
      void this.showAnswer();
      return;
    }
    const ease = /^ease([1-4])$/.exec(cmd);
    if (ease) {
      const r = (['again', 'hard', 'good', 'easy'] as const)[Number(ease[1]) - 1];
      if (this.view.phase === 'answer') void this.answer(r);
      return;
    }
    const play = parsePlayCommand(cmd);
    if (play && this.prepared) {
      const tags = play.side === 'q' ? this.prepared.questionAv : this.prepared.answerAv;
      const tag = tags[play.index];
      if (tag) this.player.play([tag], true);
      return;
    }
    if (cmd === 'amgi:mark') return void this.toggleMark();
    if (cmd.startsWith('amgi:flag:')) return void this.setFlag(Number(cmd.slice(10)) || 0);
    if (cmd === 'amgi:bury-card') return void this.buryCard();
    if (cmd === 'amgi:bury-note') return void this.buryNote();
    if (cmd === 'amgi:suspend-card') return void this.suspendCard();
    if (cmd === 'amgi:suspend-note') return void this.suspendNote();
    if (cmd.startsWith('amgi:toast:')) return toast(cmd.slice(11));
    if (cmd === 'amgi:tts-stop') return this.player.stop();
    const tts = /^amgi:tts:([^:]*):([\s\S]*)$/.exec(cmd);
    if (tts) {
      const tag: AvTag = { kind: 'tts', lang: tts[1], text: tts[2], speed: 1, voices: [] };
      this.player.play([tag], true);
    }
    // Anything else (add-on commands): ignored, like an unknown link in Anki.
  }

  // --- auto advance (aqt/reviewer.py _auto_advance_*) ---------------------------------

  private clearAutoTimer(): void {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = null;
  }

  private scheduleAutoAdvance(side: 'question' | 'answer'): void {
    this.clearAutoTimer();
    if (!this.view.autoAdvance || !this.conf) return;
    const secs = side === 'question' ? this.conf.secondsToShowQuestion : this.conf.secondsToShowAnswer;
    if (!secs) return;
    const gen = this.gen;
    this.autoTimer = setTimeout(() => this.onAutoTimeout(side, gen), secs * 1000);
  }

  private onAutoTimeout(side: 'question' | 'answer', gen: number): void {
    if (gen !== this.gen || this.view.phase !== side || !this.view.autoAdvance || !this.conf) return;
    if (this.conf.waitForAudio && this.player.busy) {
      const off = this.player.onIdle(() => {
        off();
        setTimeout(() => this.onAutoTimeout(side, gen), 100);
      });
      return;
    }
    if (side === 'question') {
      if (this.conf.questionAction === 0) void this.showAnswer();
      else toast('질문을 표시할 시간이 지났습니다');
      return;
    }
    switch (this.conf.answerAction) {
      case 1:
        void this.answer('again');
        return;
      case 2:
        void this.answer('good');
        return;
      case 3:
        void this.answer('hard');
        return;
      case 4:
        toast('답을 표시할 시간이 지났습니다');
        return;
      default:
        void this.buryCard();
    }
  }
}
