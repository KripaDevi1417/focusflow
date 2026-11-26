/* ============================================================
   FocusFlow - Focus Studio audio
   All soundscapes are synthesized in the browser. No samples,
   no licences, no network requests. One AudioContext is shared.
   ============================================================ */
window.FFSound = (function () {
  "use strict";

  var SOUNDS = {
    rain:   { name: "Rain",        icon: "☂", copy: "Soft rain on a window",     plan: 1 },
    ocean:  { name: "Ocean",       icon: "≈", copy: "Slow tide, wide horizon",   plan: 1 },
    brown:  { name: "Brown noise", icon: "●", copy: "Warm low-end hush",         plan: 0 },
    green:  { name: "Green noise", icon: "❋", copy: "Mid-frequency forest air",  plan: 1 },
    fire:   { name: "Fireplace",   icon: "△", copy: "Low crackle, no heat",      plan: 1 },
    night:  { name: "Night",       icon: "☾", copy: "Crickets and open air",     plan: 1 },
    wind:   { name: "Wind",        icon: "↝", copy: "A long, clean gust",        plan: 1 },
    cafe:   { name: "Café",        icon: "☕", copy: "A distant room murmur",     plan: 1 }
  };

  var ctx = null;
  var master = null;
  var voices = {};
  var generative = null;
  var lastMaster = 0.7;

  function ensure() {
    if (!ctx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error("Web Audio is not available");
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function clamp(value, min, max) {
    value = Number(value);
    if (!isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  function noiseBuffer(kind) {
    var length = Math.floor(ctx.sampleRate * 4);
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var last = 0;
    var b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < length; i++) {
      var white = Math.random() * 2 - 1;
      if (kind === "brown") {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else if (kind === "pink") {
        b0 = 0.99765 * b0 + white * 0.0990460;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
      } else {
        data[i] = white * 0.7;
      }
    }
    return buffer;
  }

  function sourceLoop(kind) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(kind);
    src.loop = true;
    return src;
  }

  function layerGain(value) {
    var gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(master);
    gain.gain.setTargetAtTime(Math.max(0.0001, value), ctx.currentTime, 0.12);
    return gain;
  }

  function makeVoice(id) {
    if (voices[id]) return voices[id];
    var src, filter, gain, lfo, lfoGain, timer, extra = [];

    if (id === "rain") {
      src = sourceLoop("white");
      filter = ctx.createBiquadFilter();
      filter.type = "highpass"; filter.frequency.value = 900; filter.Q.value = 0.4;
      gain = layerGain(0.12);
      src.connect(filter); filter.connect(gain); src.start();
    } else if (id === "ocean") {
      src = sourceLoop("brown");
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 620; filter.Q.value = 0.7;
      gain = layerGain(0.20);
      src.connect(filter); filter.connect(gain); src.start();
      lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      lfoGain = ctx.createGain(); lfoGain.gain.value = 0.07;
      lfo.connect(lfoGain); lfoGain.connect(gain.gain); lfo.start();
    } else if (id === "brown") {
      src = sourceLoop("brown");
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 900;
      gain = layerGain(0.18);
      src.connect(filter); filter.connect(gain); src.start();
    } else if (id === "green") {
      src = sourceLoop("white");
      filter = ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = 1450; filter.Q.value = 0.55;
      gain = layerGain(0.075);
      src.connect(filter); filter.connect(gain); src.start();
    } else if (id === "fire") {
      src = sourceLoop("brown");
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 1050; filter.Q.value = 0.5;
      gain = layerGain(0.18);
      src.connect(filter); filter.connect(gain); src.start();
      timer = setInterval(function () {
        try {
          var burst = ctx.createBufferSource();
          var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
          var d = buf.getChannelData(0);
          for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
          burst.buffer = buf;
          var bg = ctx.createGain(); bg.gain.value = 0.22;
          burst.connect(bg); bg.connect(gain); burst.start();
        } catch (e) { /* context closed */ }
      }, 900);
    } else if (id === "night") {
      src = sourceLoop("brown");
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 480;
      gain = layerGain(0.14);
      src.connect(filter); filter.connect(gain); src.start();
      timer = setInterval(function () {
        try {
          var osc = ctx.createOscillator();
          var chirp = ctx.createGain();
          osc.type = "sine"; osc.frequency.setValueAtTime(3600, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(4300, ctx.currentTime + 0.06);
          chirp.gain.setValueAtTime(0.0001, ctx.currentTime);
          chirp.gain.exponentialRampToValueAtTime(0.018, ctx.currentTime + 0.015);
          chirp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
          osc.connect(chirp); chirp.connect(gain);
          osc.start(); osc.stop(ctx.currentTime + 0.11);
        } catch (e) { /* context closed */ }
      }, 2400);
    } else if (id === "wind") {
      src = sourceLoop("white");
      filter = ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = 520; filter.Q.value = 1.1;
      gain = layerGain(0.075);
      src.connect(filter); filter.connect(gain); src.start();
      lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
      lfoGain = ctx.createGain(); lfoGain.gain.value = 260;
      lfo.connect(lfoGain); lfoGain.connect(filter.frequency); lfo.start();
    } else if (id === "cafe") {
      src = sourceLoop("pink");
      filter = ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = 950; filter.Q.value = 0.45;
      gain = layerGain(0.10);
      src.connect(filter); filter.connect(gain); src.start();
      lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
      lfoGain = ctx.createGain(); lfoGain.gain.value = 0.025;
      lfo.connect(lfoGain); lfoGain.connect(gain.gain); lfo.start();
    }

    var voice = {
      src: src, filter: filter, gain: gain, lfo: lfo, lfoGain: lfoGain, timer: timer,
      set: function (value) {
        if (!gain) return;
        gain.gain.setTargetAtTime(Math.max(0.0001, value), ctx.currentTime, 0.12);
      },
      stop: function () {
        try { if (src) src.stop(); } catch (e) {}
        try { if (lfo) lfo.stop(); } catch (e) {}
        if (timer) clearInterval(timer);
        try { if (gain) gain.disconnect(); } catch (e) {}
      }
    };
    voices[id] = voice;
    return voice;
  }

  function stopVoice(id) {
    var voice = voices[id];
    if (!voice) return;
    voice.stop();
    delete voices[id];
  }

  var CHORDS = [
    [146.83, 220.00, 293.66, 349.23],
    [130.81, 196.00, 261.63, 329.63],
    [110.00, 164.81, 220.00, 293.66],
    [123.47, 185.00, 246.94, 311.13]
  ];

  function makeGenerative() {
    if (generative) return generative;
    var gain = layerGain(0.075);
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 1200; filter.Q.value = 0.4;
    filter.connect(gain);
    var oscs = [];
    var chord = CHORDS[0];
    chord.forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      g.gain.value = i === 0 ? 0.6 : 0.22;
      osc.connect(g); g.connect(filter); osc.start();
      oscs.push({ osc: osc, gain: g });
    });
    var lfo = ctx.createOscillator();
    var lfoGain = ctx.createGain();
    lfo.frequency.value = 0.055;
    lfoGain.gain.value = 0.022;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain); lfo.start();
    var step = 0;
    var timer = setInterval(function () {
      if (!generative) return;
      step = (step + 1) % CHORDS.length;
      var next = CHORDS[step];
      oscs.forEach(function (item, i) {
        item.osc.frequency.setTargetAtTime(next[i], ctx.currentTime, 2.6);
      });
    }, 9000);
    generative = {
      gain: gain, oscs: oscs, lfo: lfo, timer: timer,
      set: function (value) { gain.gain.setTargetAtTime(Math.max(0.0001, value), ctx.currentTime, 0.4); },
      stop: function () {
        if (timer) clearInterval(timer);
        oscs.forEach(function (item) { try { item.osc.stop(); } catch (e) {} });
        try { lfo.stop(); } catch (e) {}
        try { gain.disconnect(); } catch (e) {}
        generative = null;
      }
    };
    return generative;
  }

  function stopGenerative() {
    if (generative) generative.stop();
    generative = null;
  }

  function setMaster(value) {
    lastMaster = clamp(value, 0, 1);
    if (master && ctx) master.gain.setTargetAtTime(Math.max(0.0001, lastMaster), ctx.currentTime, 0.1);
  }

  function play(mix, masterValue, withGenerative) {
    ensure();
    setMaster(masterValue === undefined ? lastMaster : masterValue);
    Object.keys(SOUNDS).forEach(function (id) {
      var level = clamp(mix && mix[id], 0, 1);
      if (level > 0.001) {
        makeVoice(id).set(level);
      } else {
        stopVoice(id);
      }
    });
    if (withGenerative) makeGenerative().set(0.8);
    else stopGenerative();
  }

  function stop() {
    Object.keys(voices).forEach(function (id) { stopVoice(id); });
    stopGenerative();
  }

  function isPlaying() {
    return Object.keys(voices).length > 0 || !!generative;
  }

  function setLayer(id, value) {
    if (!voices[id] && value > 0.001) makeVoice(id).set(value);
    else if (voices[id]) {
      if (value <= 0.001) stopVoice(id);
      else voices[id].set(value);
    }
  }

  return {
    SOUNDS: SOUNDS,
    play: play,
    stop: stop,
    isPlaying: isPlaying,
    setLayer: setLayer,
    setMaster: setMaster,
    ensure: ensure
  };
})();