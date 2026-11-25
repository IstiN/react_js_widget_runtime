// Generated from IstiN/js_widget_runtime@4457ff0:src/bootstrap-runtime.js by scripts/sync-bootstrap.sh — do not edit
// Generated from IstiN/flutter_js_widget_runtime@25c1bb975e30d458fb8ea0e99be80308453436d0:lib/src/runtime/js_widget_bootstrap.dart (runtime half) by scripts/extract_bootstrap.mjs — do not edit.
var __cbs = {};
var __iv_cbs = {};
var __raf_cbs = {};
function __jsrResolve(id,value){
  var cb=__cbs[id];
  if(!cb)return;
  cb(value);
  delete __cbs[id];
}
function __jsrInterval(id){
  var cb=__iv_cbs[id];
  if(cb)cb();
}
function __jsrRaf(id,elapsed){
  var cb=__raf_cbs[id];
  if(!cb)return;
  cb(elapsed);
  delete __raf_cbs[id];
}
function __tag(payload){
  if(payload===undefined||payload===null)return '{"iid":"'+__IID+'"}';
  if(typeof payload==='string'){
    // Plain-id channels (clearInterval/cancelAnimationFrame): wrap as
    // {iid, id} — the Dart router unwraps and delivers the raw id.
    try{
      var o=JSON.parse(payload);
      if(o&&typeof o==='object'){o.iid=__IID;return JSON.stringify(o);}
    }catch(e){}
    return '{"iid":"'+__IID+'","id":'+JSON.stringify(payload)+'}';
  }
  return payload;
}
function __send(ch,payload){sendMessage(ch,__tag(payload));}
var __idCounter = 0;
var __nid = function(){return 'i'+(++__idCounter);};
function __jsrWarmResolve(id, value, size){
  var cb = __cbs[id];
  if(!cb) return;
  delete __cbs[id];
  var a = new Uint8Array(size|0);
  __jsrWarmFill(String(id), a);
  value.bytes = a;
  cb(value);
}
function __joinArgs(a){
  var n=a.length;
  if(n===0)return '';
  if(n===1)return String(a[0]);
  var s=String(a[0]);
  for(var i=1;i<n;i++){s+=' '+String(a[i]);}
  return s;
}
var __timers = {};
var console = {
  log:   function(){__send('__jsr_log', __joinArgs(arguments));},
  warn:  function(){__send('__jsr_log', '[W] '+__joinArgs(arguments));},
  error: function(){__send('__jsr_log', '[E] '+__joinArgs(arguments));},
  // info/debug share the log channel (no separate level exists on the
  // host side); time/timeEnd are the official-module pairing used by
  // webgl_instancing_scatter/performance build timings — a missing label
  // degrades to an empty string instead of throwing.
  info:  function(){__send('__jsr_log', __joinArgs(arguments));},
  debug: function(){__send('__jsr_log', __joinArgs(arguments));},
  time:  function(l){__timers[''+l]=Date.now();},
  timeEnd: function(l){ var k=''+l, t0=__timers[k]; if(t0===undefined)return;
                        delete __timers[k];
                        __send('__jsr_log', k+': '+(Date.now()-t0)+'ms'); }
};
var setTimeout = function(fn,ms){ var id=__nid(); __iv_cbs[id]=function(){delete __iv_cbs[id];fn();}; __send('__jsr_set_interval','{"id":"'+id+'","ms":'+(ms||0)+',"once":true}'); return id; };
var clearTimeout = function(id){ __send('__jsr_clear_interval', String(id)); };
var setInterval = function(fn,ms){ var id=__nid(); __iv_cbs[id]=fn; __send('__jsr_set_interval','{"id":"'+id+'","ms":'+(ms||1000)+'}'); return id; };
var clearInterval = function(id){ __send('__jsr_clear_interval', String(id)); delete __iv_cbs[String(id)]; };
var requestAnimationFrame = function(fn){ var id=__nid(); __raf_cbs[id]=fn; __send('__jsr_raf','{"id":"'+id+'","iid":"'+__IID+'"}'); return id; };
var cancelAnimationFrame = function(id){ delete __raf_cbs[String(id)]; __send('__jsr_caf', String(id)); };
if (typeof performance === 'undefined') {
  var performance = {now: function(){ return Date.now(); }};
}
var jsr = {
audio: {
    synth: function(opts){ return new __JsAudioSynth(opts); },
    noteToFrequency: function(note){ return __jsrAudioNoteFrequency(note); },
  },
fetchJson: function(url,opts){
    return new Promise(function(resolve,reject){
      var id=__nid();
      __cbs[id]=function(r){if(r&&r.__error)reject(new Error(r.__error));else resolve(r);};
      __send('__jsr_fetch', JSON.stringify({id:id,url:url,method:(opts&&opts.method)||'GET',headers:(opts&&opts.headers)||{}}));
    });
  },
exec: function(cmd){
    return new Promise(function(resolve,reject){
      var id=__nid();
      __cbs[id]=function(r){if(r&&r.__error)reject(new Error(r.__error));else resolve(r);};
      __send('__jsr_exec', JSON.stringify({id:id,cmd:cmd}));
    });
  },
openUrl: function(url){
    return new Promise(function(resolve,reject){
      var id=__nid();
      __cbs[id]=function(r){if(r&&r.__error)reject(new Error(r.__error));else resolve(r);};
      __send('__jsr_open_url', JSON.stringify({id:id,url:String(url)}));
    });
  },
hostCall: function(name,args){
    return new Promise(function(resolve,reject){
      var id=__nid();
      __cbs[id]=function(r){if(r&&r.__error)reject(new Error(r.__error));else resolve(r);};
      __send('__jsr_host_call', JSON.stringify({id:id,name:String(name),args:args||{}}));
    });
  },
// CRAP override for jsr.b64encode (reference CC 16): the encoder is split
// into a lazily cached pair table, full-triplet quads, the 1/2-byte tail and
// the chunked string assembly. Output is byte-identical to the reference
// encoder (same alphabet, same padding, same chunk size).
b64encode: function(data){
    // Typed arrays encode their BYTE IMAGE (a Float32Array yields its 4
    // bytes per element, views only their visible range); ArrayBuffers
    // and array-likes encode element-wise as before.
    var u8;
    if (data instanceof Uint8Array) u8 = data;
    else if (data && data.buffer) {
      u8 = new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
    } else u8 = new Uint8Array(data);
    var len = u8.length;
    if (len === 0) return '';
    var codes = __b64Quads(u8, __b64PairTable());
    return __b64String(codes);
  },
// CRAP override for jsr.hostCallBinary (reference CC 9): the string-lane
// branch moves to a top-level helper; the member keeps only the native
// bytes-lane detection. Same lanes, same payload shapes.
hostCallBinary: function(name, data){
    var n = String(name).replace(/[^A-Za-z0-9._\-]/g, '_');
    // Native bytes lane: a typed array crosses by (pointer, length) with
    // zero encode. Subarray views send only their visible range.
    if (typeof __jsrSendBytes === 'function' && data &&
        typeof data === 'object' && data.buffer) {
      __jsrSendBytes(n, new Uint8Array(data.buffer,
        data.byteOffset || 0, data.byteLength));
      return;
    }
    __jsrSendBinaryString(n, data);
  },
capture: function(opts){
    return new Promise(function(resolve,reject){
      var id=__nid();
      __cbs[id]=function(r){if(r&&r.__error)reject(new Error(r.__error));else resolve(r);};
      __send('__jsr_capture', JSON.stringify({id:id,opts:opts||{}}));
    });
  },
storage:{
    _c:{},
    get:function(key){
      if(key in this._c)return Promise.resolve(this._c[key]);
      var self=this;
      return new Promise(function(resolve){
        var id=__nid();
        __cbs[id]=function(v){self._c[key]=v;resolve(v);};
        __send('__jsr_storage_get', JSON.stringify({id:id,key:key}));
      });
    },
    set:function(key,val){
      this._c[key]=val;
      __send('__jsr_storage_set', JSON.stringify({key:key,value:val}));
      return Promise.resolve();
    }
  },
exportState:function(obj){__send('__jsr_export_state', JSON.stringify(obj||{}));},
secrets:{
    get:function(key){
      return new Promise(function(resolve){
        var id=__nid();
        __cbs[id]=function(v){resolve(v);};
        __send('__jsr_secrets_get', JSON.stringify({id:id,key:key}));
      });
    },
    set:function(key,val){
      return new Promise(function(resolve){
        var id=__nid();
        __cbs[id]=function(ok){resolve(ok);};
        __send('__jsr_secrets_set', JSON.stringify({id:id,key:key,value:val}));
      });
    },
    delete:function(key){
      return new Promise(function(resolve){
        var id=__nid();
        __cbs[id]=function(ok){resolve(ok);};
        __send('__jsr_secrets_set', JSON.stringify({id:id,key:key,value:null}));
      });
    }
  },
loadAsset: function(path) {
    return new Promise(function(resolve) {
      var id = __nid();
      __cbs[id] = function(v) { resolve(v); };
      __send('__jsr_load_asset', JSON.stringify({id: id, path: path}));
    });
  },
scene3d: {
    _send: function(kind, sceneId, payload) {
      __send('__jsr_scene3d_command', JSON.stringify({
        kind: kind,
        sceneId: sceneId,
        payload: payload || {}
      }));
    },
    create: function(sceneId, config) {
      this._send('create', sceneId, config);
    },
    destroy: function(sceneId) {
      this._send('destroy', sceneId);
    },
    addModel: function(sceneId, options) {
      this._send('addModel', sceneId, options);
    },
    removeModel: function(sceneId, modelId) {
      this._send('removeModel', sceneId, {modelId: modelId});
    },
    setTransform: function(sceneId, modelId, transform) {
      var payload = {modelId: modelId};
      if (transform) {
        for (var k in transform) { payload[k] = transform[k]; }
      }
      this._send('setTransform', sceneId, payload);
    },
    // Batched transforms: one bridge message instead of N.
    // items = [{modelId, position?, rotation?, scale?}, ...]
    setTransforms: function(sceneId, items) {
      this._send('setTransforms', sceneId, {items: items || []});
    },
    // options: an animation name (string, skeletal), or an object
    // {name, loop, speed} for skeletal animations / {axis, speed} for the
    // built-in axis rotation.
    playAnimation: function(sceneId, modelId, options) {
      var payload = {modelId: modelId};
      if (typeof options === 'string') {
        payload.name = options;
      } else if (options) {
        for (var k in options) { payload[k] = options[k]; }
      }
      this._send('playAnimation', sceneId, payload);
    },
    stopAnimation: function(sceneId, modelId) {
      this._send('stopAnimation', sceneId, {modelId: modelId});
    },
    // Tap picking: handler receives {modelId, point:[x,y,z]} for the nearest
    // hit, or {modelId: null} on a miss.
    _tapHandlers: {},
    onTap: function(sceneId, fn) {
      this._tapHandlers[sceneId] = fn;
    },
    setCamera: function(sceneId, camera) {
      this._send('setCamera', sceneId, camera);
    },
    setLight: function(sceneId, light) {
      this._send('setLight', sceneId, light);
    }
  }
};
var __jsrAudioTrackCounter = 0;
var __jsrAudioMaxSamples = 16777216;
var __jsrAudioMaxDuration = 120;
function __jsrAudioNumber(opts, key, def, min, max, label){
  var v = opts ? opts[key] : undefined;
  if (v === undefined || v === null) return def;
  v = Number(v);
  if (!isFinite(v) || v < min || v > max) {
    throw new Error('audio.synth: ' + label + ' must be a number from ' +
      min + ' to ' + max);
  }
  return v;
}
function __jsrAudioName(name){
  var raw = (name === undefined || name === null) ? '' : String(name);
  var safe = raw.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 80);
  return safe || ('synth-' + (++__jsrAudioTrackCounter));
}
// CRAP override for __jsrAudioNoteFrequency (reference CC 13): the numeric
// path and the note-name path split, accidentals move to their own helper.
// Error messages and returned frequencies are identical.
function __jsrAudioNoteFrequency(note){
  if (typeof note === 'number') return __jsrAudioFreqHz(note);
  var m = /^\s*([A-Ga-g])\s*([#bB]?)\s*(-?\d{1,2})\s*$/.exec(String(note));
  if (!m) throw new Error('audio.synth: unsupported note name "' + note + '"');
  var midi = __jsrAudioSemitones(m);
  if (midi < 0 || midi > 127) {
    throw new Error('audio.synth: note is outside MIDI range 0..127');
  }
  return 440 * Math.pow(2, (midi - 69) / 12);
}
// CRAP override for __jsrAudioFilter (reference CC 8): the optional
// (undefined-or-null) numeric field moves to a shared helper. Same checks,
// same error messages, same defaults.
function __jsrAudioFilter(spec){
  if (spec === undefined || spec === null) return null;
  if (typeof spec !== 'object') {
    throw new Error('audio.synth: filter must be an object');
  }
  var type = String(spec.type || 'lowpass').toLowerCase();
  if (['lowpass', 'highpass', 'bandpass'].indexOf(type) < 0) {
    throw new Error('audio.synth: unsupported filter type "' + type + '"');
  }
  return {
    type: type,
    frequency: __jsrAudioNumber(spec, 'frequency', 1000, 1, 20000, 'filter.frequency'),
    frequencyEnd: __jsrAudioOptionalNumber(spec, 'frequencyEnd', 1, 20000, 'filter.frequencyEnd'),
    q: __jsrAudioNumber(spec, 'q', 0.707, 0.01, 24, 'filter.q'),
  };
}
function __jsrAudioLfo(spec, label, defaultRate, defaultDepth, maxDepth){
  if (spec === undefined || spec === null) return null;
  if (typeof spec !== 'object') {
    throw new Error('audio.synth: ' + label + ' must be an object');
  }
  return {
    rate: __jsrAudioNumber(spec, 'rate', defaultRate, 0.01, 100, label + '.rate'),
    depth: __jsrAudioNumber(
      spec, 'depth', defaultDepth, 0, maxDepth, label + '.depth'),
  };
}
function __jsrAudioFm(spec){
  if (spec === undefined || spec === null) return null;
  if (typeof spec !== 'object') {
    throw new Error('audio.synth: fm must be an object');
  }
  if (spec.modFrequency !== undefined && spec.modFrequency !== null) {
    throw new Error(
      'audio.synth: fm.modFrequency is not supported; use fm.ratio of the carrier');
  }
  return {
    ratio: __jsrAudioNumber(spec, 'ratio', 1, 0.01, 100, 'fm.ratio'),
    index: __jsrAudioNumber(spec, 'index', 2, 0, 48, 'fm.index'),
  };
}
// CRAP override for __jsrAudioEffects (reference CC 11): one effect is
// validated per item by __jsrAudioEffect, with delay/reverb field groups in
// their own helpers. Validation order and error messages are identical.
function __jsrAudioEffects(spec){
  if (spec === undefined || spec === null) return [];
  var list = spec instanceof Array ? spec : [spec];
  if (list.length > 8) {
    throw new Error('audio.synth: track effect limit is 8');
  }
  var out = [];
  for (var i = 0; i < list.length; i++) {
    out.push(__jsrAudioEffect(list[i]));
  }
  return out;
}
function __jsrAudioEffectTailSeconds(effects){
  var tail = 0;
  for (var i = 0; i < effects.length; i++) {
    var ef = effects[i];
    var seconds = ef.type === 'delay' ? ef.time * 4 : ef.decay;
    if (seconds > tail) tail = seconds;
  }
  return tail;
}
function __jsrAudioApplyDelay(pcm, sampleRate, channels, ef){
  var delaySamples = Math.max(1, Math.round(ef.time * sampleRate));
  var buffers = [];
  var positions = [];
  for (var c = 0; c < channels; c++) {
    buffers.push(new Float32Array(delaySamples));
    positions.push(0);
  }
  for (var i = 0; i < pcm.length; i += channels) {
    for (var ch = 0; ch < channels; ch++) {
      var at = i + ch;
      var pos = positions[ch];
      var wet = buffers[ch][pos];
      buffers[ch][pos] = pcm[at] + wet * ef.feedback;
      positions[ch] = (pos + 1) % delaySamples;
      pcm[at] = pcm[at] * (1 - ef.mix) + wet * ef.mix;
    }
  }
}
// CRAP override for __jsrAudioApplyReverb (reference CC 8): the comb bank
// setup and the per-frame inner loop become helpers. The sample processing
// is mathematically identical (same comb bank, same one-pole diffuser).
function __jsrAudioApplyReverb(pcm, sampleRate, channels, ef){
  // Small parallel comb bank plus a one-pole diffuser: cheap enough for a
  // widget-sized offline render, and bounded by the mix/feedback ranges.
  var banks = __jsrAudioReverbBanks(channels, sampleRate, ef);
  var diffusers = [];
  var diffuserPositions = [];
  for (var channel = 0; channel < channels; channel++) {
    diffusers.push(new Float32Array(Math.max(2, Math.round(0.005 * sampleRate))));
    diffuserPositions.push(0);
  }
  for (var frame = 0; frame < pcm.length; frame += channels) {
    for (var channelAt = 0; channelAt < channels; channelAt++) {
      __jsrAudioReverbFrame(pcm, frame, channelAt, channels, ef, banks, diffusers, diffuserPositions);
    }
  }
}
function __jsrAudioApplyTrackEffects(pcm, sampleRate, channels, effects){
  for (var i = 0; i < effects.length; i++) {
    var ef = effects[i];
    if (ef.type === 'delay') {
      __jsrAudioApplyDelay(pcm, sampleRate, channels, ef);
    } else if (ef.type === 'reverb') {
      __jsrAudioApplyReverb(pcm, sampleRate, channels, ef);
    }
  }
}
function __jsrAudioBiquad(out, type, cutoff, q, sampleRate){
  var nyquist = sampleRate * 0.499;
  if (cutoff > nyquist) cutoff = nyquist;
  if (cutoff < 1) cutoff = 1;
  var w0 = Math.PI * 2 * cutoff / sampleRate;
  var cosine = Math.cos(w0);
  var alpha = Math.sin(w0) / (2 * q);
  var a0 = 1 + alpha;
  var b0;
  var b1;
  var b2;
  if (type === 'lowpass') {
    var oneMinusCosine = 1 - cosine;
    b0 = oneMinusCosine / 2;
    b1 = oneMinusCosine;
    b2 = oneMinusCosine / 2;
  } else if (type === 'highpass') {
    var onePlusCosine = 1 + cosine;
    b0 = onePlusCosine / 2;
    b1 = -onePlusCosine;
    b2 = onePlusCosine / 2;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  out.b0 = b0 / a0;
  out.b1 = b1 / a0;
  out.b2 = b2 / a0;
  out.a1 = -2 * cosine / a0;
  out.a2 = (1 - alpha) / a0;
}
function __JsAudioSynth(opts){
  opts = opts || {};
  this.sampleRate = Math.round(__jsrAudioNumber(
    opts, 'sampleRate', 44100, 8000, 192000, 'sampleRate'));
  this.channels = Math.round(__jsrAudioNumber(
    opts, 'channels', 2, 1, 2, 'channels'));
  this.duration = opts.duration === undefined || opts.duration === null
    ? null
    : __jsrAudioNumber(
        opts, 'duration', 0, 0.001, __jsrAudioMaxDuration, 'duration');
  this.name = __jsrAudioName(opts.name);
  this.effects = __jsrAudioEffects(opts.effects);
  this.events = [];
}
// CRAP override for __JsAudioSynth.prototype.osc (reference CC 17): the
// oscillator type, frequency requirement and noiseColor validation move to
// helpers; the event object is assembled with the same field evaluation
// order, so validation errors surface in the same sequence.
__JsAudioSynth.prototype.osc = function(opts){
  if (this.events.length >= 4096) {
    throw new Error('audio.synth: event limit is 4096 per track');
  }
  opts = opts || {};
  var type = __jsrAudioOscType(opts);
  var frequency = __jsrAudioOscFrequency(opts, type);
  this.events.push({
    type: type,
    frequency: frequency,
    frequencyEnd: __jsrAudioNumber(opts, 'frequencyEnd', 0, 1, 20000, 'frequencyEnd'),
    detune: __jsrAudioNumber(opts, 'detune', 0, -4800, 4800, 'detune'),
    start: __jsrAudioNumber(opts, 'start', 0, 0, __jsrAudioMaxDuration, 'start'),
    duration: __jsrAudioNumber(opts, 'duration', 0.25, 0.001, __jsrAudioMaxDuration, 'duration'),
    gain: __jsrAudioNumber(opts, 'gain', 0.8, 0, 1, 'gain'),
    attack: __jsrAudioNumber(opts, 'attack', 0.005, 0, 10, 'attack'),
    decay: __jsrAudioNumber(opts, 'decay', 0.02, 0, 10, 'decay'),
    sustain: __jsrAudioNumber(opts, 'sustain', 0.7, 0, 1, 'sustain'),
    release: __jsrAudioNumber(opts, 'release', 0.05, 0, 10, 'release'),
    pan: __jsrAudioNumber(opts, 'pan', 0, -1, 1, 'pan'),
    noiseColor: __jsrAudioOscNoiseColor(opts, type),
    filter: __jsrAudioFilter(opts.filter),
    vibrato: __jsrAudioLfo(opts.vibrato, 'vibrato', 5, 20, 480),
    tremolo: __jsrAudioLfo(opts.tremolo, 'tremolo', 5, 0.5, 1),
    drive: __jsrAudioNumber(opts, 'drive', 0, 0, 20, 'drive'),
    driveMix: __jsrAudioNumber(opts, 'driveMix', 1, 0, 1, 'driveMix'),
    fm: __jsrAudioFm(opts.fm),
  });
  return this;
};
__JsAudioSynth.prototype.note = function(note, opts){
  opts = opts || {};
  var copy = {};
  for (var k in opts) copy[k] = opts[k];
  if (copy.frequency === undefined) copy.frequency = __jsrAudioNoteFrequency(note);
  return this.osc(copy);
};
// CRAP override for __JsAudioSynth.prototype.render (reference CC 62): the
// track length validation, PCM allocation, per-event fill and sample chain
// (envelope, vibrato, FM, noise/oscillator, filter, drive, tremolo, mix)
// become helpers driven by a per-event state object. The sample math,
// mutation order and every error message are identical to the reference.
var __jsrAudioPi2 = Math.PI * 2;

__JsAudioSynth.prototype.render = function(){
  var self = this;
  return new Promise(function(resolve, reject){
    var sampleRate = self.sampleRate;
    var channels = self.channels;
    var events = self.events;
    if (events.length === 0) {
      reject(new Error('audio.synth: track has no osc/note events'));
      return;
    }
    var totalSeconds = __jsrAudioTrackSeconds(self);
    var frames = Math.ceil(totalSeconds * sampleRate);
    var totalSamples = frames * channels;
    if (totalSamples > __jsrAudioMaxSamples) {
      reject(new Error('audio.synth: rendered PCM exceeds the 64 MiB limit'));
      return;
    }

    var pcm = new Float32Array(totalSamples);
    __jsrAudioFillTrack(pcm, events, sampleRate, channels);
    __jsrAudioApplyTrackEffects(pcm, sampleRate, channels, self.effects);
    __jsrAudioClampPcm(pcm);

    var id = __nid();
    __cbs[id] = function(r){
      if (r && r.__error) reject(new Error(r.__error));
      else resolve(r);
    };
    try {
      jsr.hostCallBinary('audio.synth', __jsrAudioEnvelope(
        id, self.name, sampleRate, channels, frames, pcm));
    } catch (err) {
      delete __cbs[id];
      reject(err);
    }
  });
};
function __jsrAudioEnvelope(id, name, sampleRate, channels, frames, pcm){
  var header = '{"id":"' + id + '","name":"' + name +
    '","sampleRate":' + sampleRate + ',"channels":' + channels +
    ',"frames":' + frames + '}';
  var rawLen = header.length;
  var pad = (4 - rawLen % 4) % 4;
  var body = new Uint8Array(pcm.buffer, pcm.byteOffset || 0, pcm.byteLength);
  var out = new Uint8Array(12 + rawLen + pad + body.length);
  var dv = new DataView(out.buffer);
  dv.setUint32(0, 0x4152524a, true); // 'JSRA'
  dv.setUint32(4, 1, true);
  dv.setUint32(8, rawLen, true);
  for (var h = 0; h < rawLen; h++) out[12 + h] = header.charCodeAt(h);
  for (var b = 0; b < body.length; b++) out[12 + rawLen + pad + b] = body[b];
  return out;
}
function __jsrAudioOscType(opts){
  var type = String(opts.type || opts.wave || 'sine').toLowerCase();
  if (type === 'white') type = 'noise';
  if (['sine', 'square', 'sawtooth', 'triangle', 'noise'].indexOf(type) < 0) {
    throw new Error('audio.synth: unsupported oscillator type "' + type + '"');
  }
  return type;
}
function __jsrAudioOscFrequency(opts, type){
  var frequency = type === 'noise'
    ? 0
    : __jsrAudioNumber(opts, 'frequency', 0, 1, 20000, 'frequency');
  if (type !== 'noise' && frequency <= 0) {
    throw new Error('audio.synth: frequency is required for ' + type);
  }
  return frequency;
}
function __jsrAudioOscNoiseColor(opts, type){
  var noiseColor = null;
  if (type === 'noise') {
    noiseColor = String(opts.noiseColor || 'white').toLowerCase();
    if (['white', 'pink', 'brown'].indexOf(noiseColor) < 0) {
      throw new Error(
        'audio.synth: unsupported noiseColor "' + noiseColor + '"');
    }
  } else if (opts.noiseColor !== undefined && opts.noiseColor !== null) {
    throw new Error('audio.synth: noiseColor is only valid for type "noise"');
  }
  return noiseColor;
}
function __jsrAudioTrackSeconds(self){
  var totalSeconds = self.duration;
  var events = self.events;
  if (totalSeconds === null) {
    totalSeconds = 0;
    for (var e = 0; e < events.length; e++) {
      var end = events[e].start + events[e].duration + events[e].release;
      if (end > totalSeconds) totalSeconds = end;
    }
    totalSeconds += __jsrAudioEffectTailSeconds(self.effects);
    if (totalSeconds <= 0 || totalSeconds > __jsrAudioMaxDuration) {
      throw new Error('audio.synth: rendered duration must be 0..' +
        __jsrAudioMaxDuration + ' seconds');
    }
  }
  return totalSeconds;
}
function __jsrAudioFillTrack(pcm, events, sampleRate, channels){
  for (var n = 0; n < events.length; n++) {
    __jsrAudioFillEvent(pcm, events[n], sampleRate, channels);
  }
}
function __jsrAudioFillEvent(pcm, ev, sampleRate, channels){
  var frames = pcm.length / channels;
  var start = Math.floor(ev.start * sampleRate);
  if (start >= frames) return;
  var end = Math.min(
    frames,
    Math.ceil((ev.start + ev.duration + ev.release) * sampleRate));
  if (end <= start) return;
  var st = __jsrAudioEventContext(ev, sampleRate, channels);
  for (var i = start; i < end; i++) {
    var x = i - start;
    var env = __jsrAudioEnvelopeValue(x, st);
    if (env <= 0) continue;
    var v = __jsrAudioSampleValue(st, ev, x, sampleRate);
    __jsrAudioMixSample(pcm, i * channels, v, ev.gain * env, st, channels);
    if (ev.type !== 'noise') {
      st.phase += st.frequencyNow / sampleRate;
      if (st.phase >= 1) st.phase -= Math.floor(st.phase);
    }
  }
}
function __jsrAudioEventContext(ev, sampleRate, channels){
  var detuneMul = Math.pow(2, ev.detune / 1200);
  var st = {
    attack: ev.attack * sampleRate,
    decay: ev.decay * sampleRate,
    hold: ev.duration * sampleRate,
    release: ev.release * sampleRate,
    attackDecay: ev.attack * sampleRate + ev.decay * sampleRate,
    sustain: ev.sustain,
    frequency: ev.frequency * detuneMul,
    frequencyEnd: ev.frequencyEnd * detuneMul,
    phase: 0,
    frequencyNow: 0,
    pink: [0, 0, 0, 0, 0, 0, 0],
    brown: 0,
  };
  var f = __jsrAudioFilterContext(ev, sampleRate);
  st.filter = f.filter;
  st.filterState = f.filterState;
  st.filterCoeff = f.filterCoeff;
  st.filterFrequency = f.filterFrequency;
  st.filterEnd = f.filterEnd;
  var m = __jsrAudioModContext(ev, sampleRate);
  for (var k in m) { st[k] = m[k]; }
  var panAngle = (Math.max(-1, Math.min(1, ev.pan)) + 1) * Math.PI / 4;
  st.leftGain = channels === 1 ? 1 : Math.cos(panAngle);
  st.rightGain = channels === 1 ? 0 : Math.sin(panAngle);
  return st;
}
function __jsrAudioFilterContext(ev, sampleRate){
  var filter = ev.filter;
  var filterState = filter ? { x1: 0, x2: 0, y1: 0, y2: 0 } : null;
  var filterCoeff = filter ? {} : null;
  var filterFrequency = filter ? filter.frequency : 0;
  var filterEnd = filter && filter.frequencyEnd !== null
    ? filter.frequencyEnd
    : 0;
  if (filter) {
    __jsrAudioBiquad(
      filterCoeff, filter.type, filterFrequency, filter.q, sampleRate);
  }
  return {
    filter: filter,
    filterState: filterState,
    filterCoeff: filterCoeff,
    filterFrequency: filterFrequency,
    filterEnd: filterEnd,
  };
}
function __jsrAudioModContext(ev, sampleRate){
  var vibrato = ev.vibrato;
  var tremolo = ev.tremolo;
  var fm = ev.fm;
  return {
    vibratoDepth: vibrato ? vibrato.depth : 0,
    vibratoPhase: 0,
    vibratoStep: vibrato ? vibrato.rate / sampleRate : 0,
    tremoloDepth: tremolo ? tremolo.depth : 0,
    tremoloPhase: 0,
    tremoloStep: tremolo ? tremolo.rate / sampleRate : 0,
    fmRatio: fm ? fm.ratio : 1,
    fmIndex: fm ? fm.index : 0,
    fmPhase: 0,
  };
}
function __jsrAudioEnvelopeValue(x, st){
  var env;
  if (x < st.attack) env = st.attack > 0 ? x / st.attack : 1;
  else if (x < st.attackDecay) env = 1 - (1 - st.sustain) * ((x - st.attack) / st.decay);
  else env = st.sustain;
  if (x > st.hold) {
    env = st.release > 0 ? st.sustain * (1 - (x - st.hold) / st.release) : 0;
  }
  return env;
}
function __jsrAudioSampleValue(st, ev, x, sampleRate){
  var sweepT = st.hold > 0 ? Math.min(1, x / st.hold) : 1;
  var frequencyNow = st.frequencyEnd > 0 && ev.type !== 'noise'
    ? st.frequency * Math.pow(st.frequencyEnd / st.frequency, sweepT)
    : st.frequency;
  frequencyNow = __jsrAudioVibratoTick(st, ev, frequencyNow);
  var oscPhase = __jsrAudioFmTick(st, ev, st.phase, frequencyNow, sampleRate);
  var v = ev.type === 'noise'
    ? __jsrAudioNoiseSample(st, ev.noiseColor)
    : __jsrAudioOscSample(ev.type, oscPhase);
  if (st.filter) {
    v = __jsrAudioFilterTick(st, v, sweepT, sampleRate);
  }
  if (ev.drive > 0) {
    v = __jsrAudioDriveTick(ev, v);
  }
  st.frequencyNow = frequencyNow;
  return v;
}
function __jsrAudioVibratoTick(st, ev, frequencyNow){
  if (st.vibratoDepth > 0 && ev.type !== 'noise') {
    frequencyNow *= Math.pow(2,
      st.vibratoDepth * Math.sin(st.vibratoPhase * __jsrAudioPi2) / 1200);
    st.vibratoPhase += st.vibratoStep;
    if (st.vibratoPhase >= 1) {
      st.vibratoPhase -= Math.floor(st.vibratoPhase);
    }
  }
  return frequencyNow;
}
function __jsrAudioFmTick(st, ev, oscPhase, frequencyNow, sampleRate){
  if (st.fmIndex > 0 && ev.type !== 'noise') {
    oscPhase += st.fmIndex * Math.sin(st.fmPhase * __jsrAudioPi2);
    st.fmPhase += frequencyNow * st.fmRatio / sampleRate;
    if (st.fmPhase >= 1) st.fmPhase -= Math.floor(st.fmPhase);
  }
  return oscPhase;
}
function __jsrAudioNoiseSample(st, noiseColor){
  var white = Math.random() * 2 - 1;
  if (noiseColor === 'pink') {
    var p = st.pink;
    p[0] = 0.99886 * p[0] + white * 0.0990460;
    p[1] = 0.2935 * p[1] - white * 0.2965164;
    p[2] = -1.0527 * p[2] - white * 0.0522123;
    p[3] = 0.0734 * p[3] - white * 0.016875;
    p[4] = 0.2974 * p[4] + white * 0.0919425;
    p[5] = 0.2927 * p[5] - white * 0.0034354;
    p[6] = white * 0.5362;
    return (p[0] + p[1] + p[2] + p[3] + p[4] +
        p[5] + p[6] + p[6]) * 0.11;
  } else if (noiseColor === 'brown') {
    st.brown = (st.brown + 0.02 * white) / 1.02;
    if (st.brown > 1) st.brown = 1;
    else if (st.brown < -1) st.brown = -1;
    return st.brown * 0.8;
  }
  return white;
}
function __jsrAudioOscSample(type, oscPhase){
  if (type === 'square') {
    return oscPhase < 0.5 ? 1 : -1;
  } else if (type === 'sawtooth') {
    return oscPhase * 2 - 1;
  } else if (type === 'triangle') {
    return 1 - 4 * Math.abs(oscPhase - 0.5);
  }
  return Math.sin(oscPhase * __jsrAudioPi2);
}
function __jsrAudioFilterTick(st, v, sweepT, sampleRate){
  var cutoff = st.filterEnd > 0
    ? st.filterFrequency * Math.pow(st.filterEnd / st.filterFrequency, sweepT)
    : st.filterFrequency;
  __jsrAudioBiquad(
    st.filterCoeff, st.filter.type, cutoff, st.filter.q, sampleRate);
  var input = v;
  var output = st.filterCoeff.b0 * input +
    st.filterCoeff.b1 * st.filterState.x1 +
    st.filterCoeff.b2 * st.filterState.x2 -
    st.filterCoeff.a1 * st.filterState.y1 -
    st.filterCoeff.a2 * st.filterState.y2;
  st.filterState.x2 = st.filterState.x1;
  st.filterState.x1 = input;
  st.filterState.y2 = st.filterState.y1;
  st.filterState.y1 = output;
  return output;
}
function __jsrAudioDriveTick(ev, v){
  // Bounded soft clip, normalized so unity drive leaves full scale.
  var amount = 1 + ev.drive;
  var driven = v * amount;
  var shaped = driven / (1 + Math.abs(driven));
  shaped *= (1 + amount) / amount;
  return shaped * ev.driveMix + v * (1 - ev.driveMix);
}
function __jsrAudioMixSample(pcm, base, v, g, st, channels){
  if (st.tremoloDepth > 0) {
    var trem = Math.sin(st.tremoloPhase * __jsrAudioPi2);
    g *= 1 - st.tremoloDepth * (1 - trem) / 2;
    st.tremoloPhase += st.tremoloStep;
    if (st.tremoloPhase >= 1) {
      st.tremoloPhase -= Math.floor(st.tremoloPhase);
    }
  }
  if (channels === 1) {
    pcm[base] += v * g;
  } else {
    pcm[base] += v * g * st.leftGain;
    pcm[base + 1] += v * g * st.rightGain;
  }
}
function __jsrAudioClampPcm(pcm){
  for (var s = 0; s < pcm.length; s++) {
    if (pcm[s] > 1) pcm[s] = 1;
    else if (pcm[s] < -1) pcm[s] = -1;
  }
}
function __jsrAudioReverbBanks(channels, sampleRate, ef){
  var combSeconds = [0.023, 0.0297, 0.0371, 0.0411];
  var combs = combSeconds.length;
  var buffers = [];
  var positions = [];
  var gains = [];
  for (var ch = 0; ch < channels; ch++) {
    for (var c = 0; c < combs; c++) {
      var samples = Math.max(2, Math.round(combSeconds[c] * sampleRate));
      // Tiny per-channel offsets keep stereo decorrelated without a second IR.
      if (ch > 0) samples += ch * 7 + c;
      buffers.push(new Float32Array(samples));
      positions.push(0);
      gains.push(Math.min(0.9, Math.pow(0.001, combSeconds[c] / ef.decay)));
    }
  }
  return { combs: combs, buffers: buffers, positions: positions, gains: gains };
}
function __jsrAudioReverbFrame(pcm, frame, channelAt, channels, ef, banks, diffusers, diffuserPositions){
  var at = frame + channelAt;
  var input = pcm[at];
  var wet = 0;
  for (var combAt = 0; combAt < banks.combs; combAt++) {
    // Buffers are channel-major; the four combs follow their channel.
    var index = channelAt * banks.combs + combAt;
    var buffer = banks.buffers[index];
    var pos = banks.positions[index];
    var delayed = buffer[pos];
    buffer[pos] = input + delayed * banks.gains[index];
    banks.positions[index] = (pos + 1) % buffer.length;
    wet += delayed;
  }
  wet /= banks.combs;
  var diffuser = diffusers[channelAt];
  var diffuserPos = diffuserPositions[channelAt];
  var diffused = diffuser[diffuserPos];
  diffuser[diffuserPos] = wet * 0.5 + diffused * 0.5;
  diffuserPositions[channelAt] = (diffuserPos + 1) % diffuser.length;
  pcm[at] = input * (1 - ef.mix) + diffused * ef.mix;
}
function __jsrAudioEffect(raw){
  if (!raw || typeof raw !== 'object') {
    throw new Error('audio.synth: effect must be an object');
  }
  var type = String(raw.type || '').toLowerCase();
  if (type === 'delay') return __jsrAudioDelayEffect(raw);
  if (type === 'reverb') return __jsrAudioReverbEffect(raw);
  throw new Error('audio.synth: unsupported effect type "' + type + '"');
}
function __jsrAudioDelayEffect(raw){
  return {
    type: 'delay',
    time: __jsrAudioNumber(raw, 'time', 0.25, 0.001, 5, 'delay.time'),
    feedback: __jsrAudioNumber(raw, 'feedback', 0.35, 0, 0.95, 'delay.feedback'),
    mix: __jsrAudioNumber(raw, 'mix', 0.35, 0, 1, 'delay.mix'),
  };
}
function __jsrAudioReverbEffect(raw){
  return {
    type: 'reverb',
    decay: __jsrAudioNumber(raw, 'decay', 1.2, 0.05, 10, 'reverb.decay'),
    mix: __jsrAudioNumber(raw, 'mix', 0.3, 0, 1, 'reverb.mix'),
  };
}
function __jsrAudioOptionalNumber(spec, key, min, max, label){
  var v = spec ? spec[key] : undefined;
  if (v === undefined || v === null) return null;
  return __jsrAudioNumber(spec, key, 0, min, max, label);
}
function __jsrAudioFreqHz(note){
  if (isFinite(note) && note > 0 && note <= 20000) return note;
  throw new Error('audio.synth: note frequency must be 1..20000 Hz');
}
function __jsrAudioSemitones(m){
  var semis = {c:0, d:2, e:4, f:5, g:7, a:9, b:11};
  var midi = (parseInt(m[3], 10) + 1) * 12 + semis[m[1].toLowerCase()];
  if (m[2] === '#' || m[2] === '\u266f') midi++;
  if (m[2] === 'b' || m[2] === 'B' || m[2] === '\u266d') midi--;
  return midi;
}
function __b64PairTable(){
  // (The alphabet is split across concatenated literals on purpose: single
  // high-entropy literals get eaten by secret-scanning editors.)
  if (jsr._b64PairTable) return jsr._b64PairTable;
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' + '0123456789' + '+/';
  var t = new Array(4096);
  for (var hi = 0; hi < 64; hi++)
    for (var lo = 0; lo < 64; lo++)
      t[(hi << 6) | lo] = A[hi] + A[lo];
  jsr._b64PairTable = t;
  return t;
}
function __b64Quads(u8, table){
  var len = u8.length;
  var full = (len / 3) | 0;
  var rem = len - full * 3;
  var quadCount = full * 4 + (rem ? 4 : 0);
  var codes = new Uint16Array(quadCount);
  var q = __b64FullQuads(u8, full, codes, table);
  __b64Tail(u8, rem, full, codes, q, table);
  return codes;
}
function __b64FullQuads(u8, full, codes, table){
  var q = 0;
  for (var i = 0; i < full; i++) {
    var o = i * 3;
    var n = (u8[o] << 16) | (u8[o + 1] << 8) | u8[o + 2];
    var pair = table[(n >> 12) & 0xfff];
    codes[q++] = pair.charCodeAt(0);
    codes[q++] = pair.charCodeAt(1);
    pair = table[n & 0xfff];
    codes[q++] = pair.charCodeAt(0);
    codes[q++] = pair.charCodeAt(1);
  }
  return q;
}
function __b64Tail(u8, rem, full, codes, q, table){
  var tail = full * 3;
  if (rem === 1) {
    var n1 = u8[tail] << 16;
    var p1 = table[(n1 >> 12) & 0xfff];
    codes[q++] = p1.charCodeAt(0);
    codes[q++] = p1.charCodeAt(1);
    codes[q++] = 61; // '='
    codes[q++] = 61; // '='
  } else if (rem === 2) {
    var n2 = (u8[tail] << 16) | (u8[tail + 1] << 8);
    var p2a = table[(n2 >> 12) & 0xfff];
    codes[q++] = p2a.charCodeAt(0);
    codes[q++] = p2a.charCodeAt(1);
    // Third char is A[(n2 >> 6) & 63]; index the pair table with a zero
    // low sextet and keep only the high char.
    codes[q++] = table[((n2 >> 6) & 0x3f) << 6].charCodeAt(0);
    codes[q++] = 61; // '='
  }
}
function __b64String(codes){
  var CHUNK = 8192;
  if (codes.length <= CHUNK) return String.fromCharCode.apply(null, codes);
  var parts = [];
  for (var off = 0; off < codes.length; off += CHUNK) {
    parts.push(String.fromCharCode.apply(
      null, codes.length - off < CHUNK ? codes.subarray(off) : codes.subarray(off, off + CHUNK)));
  }
  return parts.join('');
}
function __jsrSendBinaryString(n, data){
  // String path: pre-encoded b64 passes through, typed arrays on
  // engines without the native lane encode first.
  var b64 = (typeof data === 'string') ? data : jsr.b64encode(data);
  var d = String(b64 == null ? '' : b64);
  // Engines with per-engine isolation (QuickJS) advertise __JSR_RAW_BINARY__:
  // skip the {iid,id} wrapper — a plain `<name> <base64>` string crosses
  // with zero JSON work on either side. Shared-runtime engines keep the
  // tagged path for correct cross-engine routing.
  var d2 = n + ' ' + d;
  if (typeof __JSR_RAW_BINARY__ !== 'undefined') {
    sendMessage('__jsr_host_call_binary', d2);
  } else {
    __send('__jsr_host_call_binary', d2);
  }
}
