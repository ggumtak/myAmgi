(function () {
  'use strict';

  window.onUpdateHook = window.onUpdateHook || [];
  window.onShownHook = window.onShownHook || [];

  var bridge = function () {
    return window.MyAmgiBridge || null;
  };

  function isEinkMode() {
    return (
      document.documentElement.classList.contains('eink_mode') ||
      Boolean(window.__myAmgiEinkMode)
    );
  }

  function runHookArray(arr, hookName) {
    if (!Array.isArray(arr)) return;
    for (var i = 0; i < arr.length; i++) {
      var fn = arr[i];
      if (typeof fn === 'function') {
        try {
          fn();
        } catch (err) {
          if (window.console && console.error) {
            console.error('[myAmgi] ' + hookName + ' error:', err);
          }
        }
      }
    }
  }

  window.__myAmgiRunHooks = function () {
    var execute = function () {
      runHookArray(window.onUpdateHook, 'onUpdateHook');
      runHookArray(window.onShownHook, 'onShownHook');
    };
    if (isEinkMode() || typeof window.requestAnimationFrame !== 'function') {
      execute();
    } else {
      window.requestAnimationFrame(execute);
    }
  };

  function ensureDeckStyle() {
    var styleEl = document.getElementById('myamgi-deck-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'myamgi-deck-style';
      (document.head || document.documentElement).appendChild(styleEl);
    }
    return styleEl;
  }

  function executeScripts(container) {
    if (!container) return;
    var scripts = container.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      var oldScript = scripts[i];
      var newScript = document.createElement('script');
      for (var j = 0; j < oldScript.attributes.length; j++) {
        var attr = oldScript.attributes[j];
        newScript.setAttribute(attr.name, attr.value);
      }
      if (oldScript.textContent) {
        newScript.textContent = oldScript.textContent;
      }
      if (oldScript.parentNode) {
        oldScript.parentNode.replaceChild(newScript, oldScript);
      }
    }
  }

  function resetScrollPosition(isAnswer) {
    if (isAnswer) {
      var answerEl = document.getElementById('answer');
      if (answerEl && typeof answerEl.scrollIntoView === 'function') {
        answerEl.scrollIntoView({
          block: 'start',
          behavior: 'auto'
        });
        return;
      }
    }
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  window.__myAmgiSwapCard = function (payload) {
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        return;
      }
    }
    if (!payload || typeof payload !== 'object') return;

    window.__myAmgiState = {
      cardId: payload.cardId || 0,
      noteId: payload.noteId || 0,
      isAnswer: Boolean(payload.isAnswer)
    };

    if (typeof payload.htmlClass === 'string') {
      document.documentElement.className = payload.htmlClass;
    }
    if (typeof payload.bodyClass === 'string' && document.body) {
      document.body.className = payload.bodyClass;
    }

    var deckStyle = ensureDeckStyle();
    var nextCss = typeof payload.css === 'string' ? payload.css : '';
    if (deckStyle.textContent !== nextCss) {
      deckStyle.textContent = nextCss;
    }

    var qa = document.getElementById('qa');
    if (!qa) {
      qa = document.createElement('div');
      qa.id = 'qa';
      (document.body || document.documentElement).appendChild(qa);
    }

    // Reset per-card hooks before re-executing card scripts so hooks don't accumulate across cards
    // unless preserved by a template that only runs once; AnkiDroid clears hooks on card load.
    window.onUpdateHook = [];
    window.onShownHook = [];

    qa.innerHTML = typeof payload.html === 'string' ? payload.html : '';
    executeScripts(qa);

    resetScrollPosition(Boolean(payload.isAnswer));

    window.__myAmgiRunHooks();

    if (typeof window.__hjtapRun === 'function') {
      try {
        window.__hjtapRun();
      } catch (err) {
        if (window.console && console.error) {
          console.error('[myAmgi] __hjtapRun error:', err);
        }
      }
    }
  };

  function playAudio(filename) {
    var b = bridge();
    if (b && typeof b.playAudio === 'function') {
      b.playAudio(filename || '');
    }
  }

  // Anki pycmd compatibility shim
  window.pycmd = function (cmd) {
    if (typeof cmd !== 'string') return;
    var b = bridge();
    if (!b) return;

    if (cmd === 'ans' || cmd === 'showAnswer') {
      if (typeof b.showAnswer === 'function') {
        b.showAnswer();
      }
      return;
    }

    if (/^ease([1-4])$/.test(cmd)) {
      var ease = parseInt(cmd.slice(4), 10);
      if (typeof b.answerCard === 'function') {
        b.answerCard(ease);
      } else if (typeof b.onEase === 'function') {
        b.onEase(ease);
      }
      return;
    }

    if (cmd.indexOf('play:') === 0) {
      playAudio(cmd.slice(5));
      return;
    }

    if (typeof b.onPycmd === 'function') {
      b.onPycmd(cmd);
    }
  };

  // Delegate audio replay buttons ([data-myamgi-sound] and Anki replay links)
  document.addEventListener(
    'click',
    function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var soundEl = target.closest('[data-myamgi-sound]');
      if (soundEl) {
        event.preventDefault();
        event.stopPropagation();
        playAudio(soundEl.getAttribute('data-myamgi-sound'));
        return;
      }

      var replayAnchor = target.closest('a.replay-button, a[href^="playsound:"]');
      if (replayAnchor) {
        var href = replayAnchor.getAttribute('href') || '';
        if (href.indexOf('playsound:') === 0) {
          event.preventDefault();
          event.stopPropagation();
          playAudio(decodeURIComponent(href.slice('playsound:'.length)));
        }
      }
    },
    true
  );

  // Relative / broken media fallback for <img>
  document.addEventListener(
    'error',
    function (event) {
      var img = event.target;
      if (!img || img.nodeName !== 'IMG') return;
      if (img.dataset.myamgiFallbackTried === '1') return;

      var rawSrc = img.getAttribute('src') || '';
      if (!rawSrc || /^(data:|blob:|https?:|file:|content:)/i.test(rawSrc)) return;

      img.dataset.myamgiFallbackTried = '1';
      var base = window.__myAmgiMediaBase || '';
      if (base) {
        var cleaned = rawSrc.replace(/^\.?\//, '');
        if (base.charAt(base.length - 1) !== '/') base += '/';
        img.src = base + cleaned;
        return;
      }

      var b = bridge();
      if (b && typeof b.resolveMediaUrl === 'function') {
        try {
          var resolved = b.resolveMediaUrl(rawSrc);
          if (resolved && resolved !== rawSrc) {
            img.src = resolved;
          }
        } catch (err) {}
      }
    },
    true
  );

  // Tap-to-flip / tap-zone notification on non-interactive elements
  var INTERACTIVE_SELECTOR = [
    '.tappable',
    '.hjtap',
    '.hjchip',
    '[data-myamgi-sound]',
    'a',
    'button',
    'input',
    'textarea',
    'select',
    'option',
    'label',
    'summary',
    'details',
    'audio',
    'video',
    '[contenteditable]',
    '[role="button"]',
    '[onclick]'
  ].join(',');

  var touchStartPos = null;

  document.addEventListener(
    'touchstart',
    function (e) {
      if (e.touches && e.touches.length === 1) {
        touchStartPos = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      } else {
        touchStartPos = null;
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'click',
    function (event) {
      if (event.defaultPrevented) return;

      var sel = window.getSelection ? window.getSelection() : null;
      if (sel && !sel.isCollapsed && String(sel).trim().length > 0) return;

      if (touchStartPos) {
        var dx = Math.abs((event.clientX || 0) - touchStartPos.x);
        var dy = Math.abs((event.clientY || 0) - touchStartPos.y);
        touchStartPos = null;
        if (dx > 18 || dy > 18) return;
      }

      var target = event.target;
      if (!target) return;
      if (target.nodeType === 3) target = target.parentElement;
      if (!target || !target.closest) return;
      if (target.closest(INTERACTIVE_SELECTOR)) return;

      var b = bridge();
      if (b && typeof b.onCardTap === 'function') {
        var w = window.innerWidth || 1;
        var h = window.innerHeight || 1;
        var nx = Math.max(0, Math.min(1, (event.clientX || 0) / w));
        var ny = Math.max(0, Math.min(1, (event.clientY || 0) / h));
        b.onCardTap(nx, ny);
      }
    },
    false
  );

  // Sync type-in-the-answer input to native if present
  document.addEventListener('input', function (event) {
    var target = event.target;
    if (!target || target.id !== 'typeans') return;
    var b = bridge();
    if (b && typeof b.onTypeAnswerChanged === 'function') {
      b.onTypeAnswerChanged(target.value || '');
    }
  });
})();
