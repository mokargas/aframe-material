const Utils = require('../utils');
const Event = require('../core/event');

AFRAME.registerComponent('colorwheel', {
  schema: {
    value: { type: "string", default: "" },
    name: { type: "string", default: "" },
    disabled: { type: "boolean", default: false },
    color: { type: "color", default: "#000" },
    backgroundColor: { type: "color", default: "#FFF" },
    wheelSize: { type: 'number', default: 0.5} //Metres.
  },
  init: function () {
    let that = this;
    let offset = 0.05;
    this.background = document.createElement('a-rounded');
    this.background.setAttribute('radius', 0.01)
    this.background.setAttribute('width', ( this.data.wheelSize + offset ) * 2)
    this.background.setAttribute('height', ( this.data.wheelSize + offset ) * 2)

    this.background.setAttribute('position', {x: -(this.data.wheelSize + offset ), y: - (this.data.wheelSize + offset), z:-0.001})

    this.background.setAttribute('side', 'double')
    this.el.appendChild(this.background);

    //Plane the colorwheel will inhabit
    this.colorWheel = document.createElement('a-circle')
    this.colorWheel.setAttribute('radius', this.data.wheelSize)
    this.colorWheel.setAttribute('material', {
      color: '#ffffff',
      flatShading: true,
       shader: 'flat',
       transparent: true,
       fog: false,
       side: 'double'
    })

    this.el.appendChild(this.colorWheel);

    //Selected HSV color of the wheel
    this.hsv = { h: 0.0, s: 0.0, v: 1.0 };

    //Handlers
    this.el.initColorWheel = this.initColorWheel.bind(this)
    this.el.focus = this.focus.bind(this);
    this.el.blur = this.blur.bind(this);

    setTimeout(function(){
      that.el.initColorWheel()
    }, 0)

    this.el.addEventListener('click', function() {
      if (this.components.colorwheel.data.disabled) { return; }
      that.focus();
    });

    Object.defineProperty(this.el, 'value', {
      get: function() { return this.getAttribute('value'); },
      set: function(value) { this.setAttribute('value', value); },
      enumerable: true,
      configurable: true
    });
  },
  initColorWheel: function () {
    console.debug('setup color wheel wheel')
    var vertexShader = '\
      varying vec2 vUv;\
      void main() {\
        vUv = uv;\
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);\
        gl_Position = projectionMatrix * mvPosition;\
      }\
      ';

    var fragmentShader = '\
      #define M_PI2 6.28318530718\n \
      uniform float brightness;\
      varying vec2 vUv;\
      vec3 hsb2rgb(in vec3 c){\
          vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, \
                           0.0, \
                           1.0 );\
          rgb = rgb * rgb * (3.0 - 2.0 * rgb);\
          return c.z * mix( vec3(1.0), rgb, c.y);\
      }\
      \
      void main() {\
        vec2 toCenter = vec2(0.5) - vUv;\
        float angle = atan(toCenter.y, toCenter.x);\
        float radius = length(toCenter) * 2.0;\
        vec3 color = hsb2rgb(vec3((angle / M_PI2) + 0.5, radius, brightness));\
        gl_FragColor = vec4(color, 1.0);\
      }\
      ';

    var material = new THREE.ShaderMaterial({
      uniforms: { brightness: { type: 'f', value: this.hsv.v } },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });


    this.colorWheel.getObject3D('mesh').material = material;
    this.colorWheel.getObject3D('mesh').material.needsUpdate = true;
  },

  onHueDown: function (position) {
    var colorWheel = this.colorWheel;
    var polarPosition;
    var radius = this.colorWheelSize;
    colorWheel.updateMatrixWorld();
    colorWheel.worldToLocal(position);

    //TODO: Get cursor position
    this.objects.hueCursor.position.copy(position);

    polarPosition = {
      r: Math.sqrt(position.x * position.x + position.z * position.z),
      theta: Math.PI + Math.atan2(-position.z, position.x)
    };
    var angle = ((polarPosition.theta * (180 / Math.PI)) + 180) % 360;
    this.hsv.h = angle / 360;
    this.hsv.s = polarPosition.r / radius;
    this.updateColor();
  },

  updateColor: function () {
    var rgb = this.hsv2rgb(this.hsv);
    var color = 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')'

    //TODO: Add indicator element of selected color

    this.colorHasChanged = true;
  },

  hsv2rgb: function (hsv) {
    var r, g, b, i, f, p, q, t;
    var h = THREE.Math.clamp(hsv.h, 0, 1);
    var s = THREE.Math.clamp(hsv.s, 0, 1);
    var v = hsv.v;

    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  },

  rgb2hsv: function (r, g, b) {
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var d = max - min;
    var h;
    var s = (max === 0 ? 0 : d / max);
    var v = max;

    if (arguments.length === 1) { g = r.g; b = r.b; r = r.r; }

    switch (max) {
      case min: h = 0; break;
      case r: h = (g - b) + d * (g < b ? 6 : 0); h /= 6 * d; break;
      case g: h = (b - r) + d * 2; h /= 6 * d; break;
      case b: h = (r - g) + d * 4; h /= 6 * d; break;
    }
    return {h: h, s: s, v: v};
  },

  isFocused: false,
  focus: function(noemit) {
    if (this.isFocused) { return; }
    this.isFocused = true;

    Event.emit(this.el, 'focus');
    if (!noemit) { Event.emit(document.body, 'didfocuscolorwheel', this.el); }
  },
  blur: function(noemit) {
    if (!this.isFocused) { return; }
    this.isFocused = false;

    Event.emit(this.el, 'blur');
    if (!noemit) { Event.emit(document.body, 'didblurcolorwheel', this.el); }
  },
  update: function () {
    let that = this;
    //that.el.background.setAttribute('color', this.data.backgroundColor)

  },
  tick: function () {},
  remove: function () {},
  pause: function () {},
  play: function () {}
});

AFRAME.registerPrimitive('a-colorwheel', {
  defaultComponents: {
    colorwheel: {}
  },
  mappings: {
    value: 'colorwheel.value',
    name: 'colorwheel.name',
    disabled: 'colorwheel.disabled',
    color: 'colorwheel.color',
    backgroundColor: 'colorwheel.backgroundColor'
  }
});
