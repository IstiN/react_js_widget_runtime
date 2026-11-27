// Generated from IstiN/js_widget_runtime@ca6dd7f:src/bootstrap-widget.js by scripts/sync-bootstrap.sh — do not edit
// Generated from IstiN/flutter_js_widget_runtime@135ac6b:lib/src/runtime/js_widget_bootstrap.dart (widget half) by scripts/extract_bootstrap.mjs — do not edit
Object.assign(jsr, {
ease: {
    linear: function(t){ return t; },
    easeIn: function(t){ return t*t; },
    easeOut: function(t){ return 1-(1-t)*(1-t); },
    easeInOut: function(t){ return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2; },
    easeInOutCubic: function(t){ return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; },
    easeInOutQuart: function(t){ return t<0.5?8*t*t*t*t:1-Math.pow(-2*t+2,4)/2; },
    easeOutExpo: function(t){ return t===1?1:1-Math.pow(2,-10*t); },
    bounce: function(t){ var n=7.5625,d=2.75; if(t<1/d){ return n*t*t; } else if(t<2/d){ t-=1.5/d; return n*t*t+0.75; } else if(t<2.5/d){ t-=2.25/d; return n*t*t+0.9375; } else { t-=2.625/d; return n*t*t+0.984375; } },
    elastic: function(t){ if(t===0||t===1)return t; var c4=(2*Math.PI)/3; return -Math.pow(2,10*t-10)*Math.sin((t*10-10.75)*c4); },
    backIn: function(t){ var c1=1.70158,c3=c1+1; return c3*t*t*t-c1*t*t; },
    backOut: function(t){ var c1=1.70158,c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); },
    // cubicBezier(x1, y1, x2, y2) -> easing function(t), CSS-style timing
    // curve. x1/x2 must be within [0,1] (CSS restriction, not enforced);
    // y is unconstrained, so overshoot curves work. Solved with
    // Newton-Raphson and a bisection fallback for flat derivatives.
    cubicBezier: function(x1,y1,x2,y2){
      var cx=3*x1, bx=3*(x2-x1)-cx, ax=1-cx-bx;
      var cy=3*y1, by=3*(y2-y1)-cy, ay=1-cy-by;
      var sampleX=function(t){ return ((ax*t+bx)*t+cx)*t; };
      var sampleY=function(t){ return ((ay*t+by)*t+cy)*t; };
      var slopeX=function(t){ return (3*ax*t+2*bx)*t+cx; };
      return function(x){
        if(x<=0)return 0; if(x>=1)return 1;
        var t=x, i, e, d, lo, hi, cur;
        for(i=0;i<8;i++){ e=sampleX(t)-x; if(Math.abs(e)<1e-6) return sampleY(t); d=slopeX(t); if(Math.abs(d)<1e-6) break; t-=e/d; }
        lo=0; hi=1; t=x;
        for(i=0;i<24;i++){ cur=sampleX(t); if(Math.abs(cur-x)<1e-6) break; if(x>cur) lo=t; else hi=t; t=(lo+hi)/2; }
        return sampleY(t);
      };
    },
  },
motion: {
    tween: function(ms, startMs, durationMs, from, to, easing){
      var t = durationMs > 0 ? (ms - startMs) / durationMs : 1;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      return from + (to - from) * jsr._easeFn(easing)(t);
    },
    // Clamps v into [inMin, inMax], then maps through the easing onto
    // [outMin, outMax]. Reversed output ranges work (outMin > outMax).
    mapRange: function(v, inMin, inMax, outMin, outMax, easing){
      if (inMax === inMin) return outMin;
      var t = (v - inMin) / (inMax - inMin);
      if (t < 0) t = 0; else if (t > 1) t = 1;
      return outMin + (outMax - outMin) * jsr._easeFn(easing)(t);
    },
    clamp: function(v, min, max){ return Math.min(Math.max(v, min), max); },
    // Zero-centered sine for beat-synced motion:
    // amplitude * sin(2*pi * ms / periodMs + phase) — phase in radians.
    wave: function(ms, periodMs, amplitude, phase){
      return amplitude * Math.sin((2 * Math.PI * ms) / periodMs + (phase || 0));
    },
  },
_easeFn: function(e){
    if (typeof e === 'function') return e;
    if (typeof e === 'string' && jsr.ease[e]) return jsr.ease[e];
    return jsr.ease.linear;
  },
render: function(tree){ try{ tree.__iid = __IID; }catch(e){} __send('__jsr_render', JSON.stringify(tree)); },
setTitle: function(t){ __send('__jsr_set_title', String(t)); },
_handler: null,
onEvent: function(fn){ jsr._handler = fn; },
_keyHandler: null,
onKey: function(fn){ jsr._keyHandler = fn; },
theme: {isDark:true,bg:'#0f172a',surface:'#1e293b',surfaceAlt:'#293548',border:'#334155',borderBright:'#475569',accent:'#818cf8',accent2:'#a78bfa',onAccent:'#0f172a',text:'#f1f5f9',muted:'#64748b'},
_onThemeChange: null,
onThemeChange: function(fn){ jsr._onThemeChange = fn; },
_viewport: null,
_viewportHandler: null,
viewport: function(){ return jsr._viewport; },
onViewport: function(fn){ jsr._viewportHandler = fn; },
breakpoint: function(w){
    var vw = (typeof w === 'number') ? w : (jsr._viewport && jsr._viewport.width) || 0;
    return vw < 600 ? 'compact' : (vw < 840 ? 'medium' : 'expanded');
  },
adaptive: function(map){
    if (!map) return undefined;
    var bp = jsr.breakpoint();
    if (map[bp] !== undefined) return map[bp];
    if (bp === 'expanded') return map.medium !== undefined ? map.medium : map.compact;
    if (bp === 'medium') return map.compact !== undefined ? map.compact : map.expanded;
    return map.medium !== undefined ? map.medium : map.expanded;
  },
showError:function(msg){
    jsr.render({type:'center',child:{type:'padding',padding:[16,16,16,16],child:{
      type:'column',mainAxisSize:'min',children:[
        {type:'text',data:'\u26a0\ufe0f',style:{fontSize:28}},
        {type:'sizedBox',height:8},
        {type:'text',data:String(msg),style:{color:'#ef4444',fontSize:13,textAlign:'center'}}
      ]
    }}});
  }
});
jsr.ease.easeOutBack = jsr.ease.backOut;
jsr.ease.easeOutBounce = jsr.ease.bounce;
jsr.ease.easeOutElastic = jsr.ease.elastic;
var __jsrHostEvent = function(target, payload) {
  try {
    if (target === 'key') {
      if (jsr._keyHandler) jsr._keyHandler(payload);
      if (jsr.three && typeof jsr.three._hostEvent === 'function') {
        jsr.three._hostEvent('key', payload);
      }
    } else if (target === 'viewport') {
      jsr._viewport = payload;
      if (jsr._viewportHandler) jsr._viewportHandler(payload);
      if (jsr.three && typeof jsr.three._hostEvent === 'function') {
        jsr.three._hostEvent('viewport', payload);
      }
    } else if (target === 'three.blur') {
      if (jsr.three && typeof jsr.three._hostEvent === 'function') {
        jsr.three._hostEvent('blur', payload);
      }
    } else if (target.indexOf('three.input:') === 0) {
      if (jsr.three && typeof jsr.three._hostEvent === 'function') {
        jsr.three._hostEvent(target.substring(6), payload);
      }
    } else if (target.indexOf('scene3d.tap:') === 0) {
      var h = jsr.scene3d._tapHandlers[target.substring('scene3d.tap:'.length)];
      if (h) h(payload);
    } else if (target.indexOf('gesture:') === 0) {
      // High-frequency gesture streams (drag/scroll look): invoke the event
      // handler WITHOUT the event_done round trip — the serialized callEvent
      // queue lags behind the finger at 60-120 events/sec and the widget
      // keeps "catching up" after release. Message order is still preserved
      // (single worker queue); errors are logged, not surfaced.
      var gh = jsr._handler || (typeof handleEvent === 'function' ? handleEvent : null);
      if (gh) {
        var gr = gh(target.substring(8), payload);
        if (gr && typeof gr.catch === 'function') gr.catch(function(){});
      }
    }
  } catch (e) {
    console.error('jsr host event error: ' + (e && e.message ? e.message : String(e)));
  }
};
