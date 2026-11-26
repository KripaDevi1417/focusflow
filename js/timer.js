/* ============================================================
   FocusFlow timer - timestamp based so it stays accurate
   even when the tab is throttled in the background.
   ============================================================ */
window.FFTimer = function (options) {
  var opts = options || {};
  var onTick = opts.onTick || function () {};
  var onComplete = opts.onComplete || function () {};
  var total = (opts.minutes || 25) * 60;
  var remaining = total;
  var running = false;
  var endAt = 0;
  var ticker = null;

  function emit() {
    onTick(remaining, total);
  }

  function stopTicker() {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function tick() {
    if (!running) return;
    remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    emit();
    if (remaining <= 0) {
      running = false;
      stopTicker();
      onComplete();
    }
  }

  function start() {
    if (running || remaining <= 0) return;
    running = true;
    endAt = Date.now() + remaining * 1000;
    stopTicker();
    ticker = setInterval(tick, 250);
    emit();
  }

  function pause() {
    if (!running) return;
    remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    running = false;
    stopTicker();
    emit();
  }

  function reset(nextMinutes) {
    running = false;
    stopTicker();
    if (typeof nextMinutes === "number") total = nextMinutes * 60;
    remaining = total;
    emit();
  }

  function setMinutes(minutes) {
    reset(Number(minutes) || 25);
  }

  return {
    start: start,
    pause: pause,
    reset: reset,
    setMinutes: setMinutes,
    isRunning: function () { return running; },
    remaining: function () { return remaining; },
    total: function () { return total; },
    toggle: function () { running ? pause() : start(); }
  };
};