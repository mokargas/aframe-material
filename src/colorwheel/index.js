const Utils = require('../utils');
const Event = require('../core/event');

AFRAME.registerComponent('colorwheel', {
  dependencies: ['raycaster'],
  schema: {
    value: {
      type: "string",
      default: ""
    },
    name: {
      type: "string",
      default: ""
    },
    disabled: {
      type: "boolean",
      default: false
    },
    color: {
      type: "color",
      default: "#000"
    },
    backgroundColor: {
      type: "color",
      default: "#FFF"
    },
    //Size of the colorWheel. NOTE: Assumed in metres.
    wheelSize: {
      type: 'number',
      default: 0.4
    },
    //Show color choice in an element
    showSelection: {
      type: 'boolean',
      default: true
    },
    selectionSize: {
      type: 'number',
      default: 0.10
    }
  },
  init: function() {
    let that = this;

    //TODO: Expose?
    let padding = 0.15;

    //Selected HSV color of the wheel
    this.hsv = {
      h: 0.0,
      s: 0.0,
      v: 1.0
    }

    const defaultMaterial = {
      color: '#ffffff',
      flatShading: true,
      transparent: true,
      fog: false,
      side: 'double'
    }

    //Background color of this interface
    this.backgroundWidth = this.data.wheelSize * 2;
    this.backgroundHeight = this.data.wheelSize * 2;

    this.background = document.createElement('a-rounded');
    this.background.setAttribute('radius', 0.02)
    this.background.setAttribute('width', this.backgroundWidth + 2 * padding)
    this.background.setAttribute('height',this.backgroundHeight + 2 * padding)
    this.background.setAttribute('position', {
      x: -(this.data.wheelSize + padding),
      y: -(this.data.wheelSize + padding),
      z: -0.001
    })
    this.background.setAttribute('side', 'double')
    this.el.appendChild(this.background)
    
    //Circle for colorwheel
    this.colorWheel = document.createElement('a-circle')
    this.colorWheel.setAttribute('radius', this.data.wheelSize)
    this.colorWheel.setAttribute('material', defaultMaterial)
    this.colorWheel.setAttribute('position', {
      x: 0,
      y: 0,
      z: 0
    })
    this.el.appendChild(this.colorWheel);

    //Plane for the brightness slider
    this.brightnessSliderHeight = (this.data.wheelSize + padding) * 2
    this.brightnessSliderWidth = 0.10

    this.brightnessSlider = document.createElement('a-plane')
    this.brightnessSlider.setAttribute('width', this.brightnessSliderWidth)
    this.brightnessSlider.setAttribute('height', this.brightnessSliderHeight)
    this.brightnessSlider.setAttribute('material', defaultMaterial)
    this.brightnessSlider.setAttribute('position', {
      x: this.data.wheelSize + this.brightnessSliderWidth,
      y: 0,
      z: 0
    })
    this.el.appendChild(this.brightnessSlider);

    //Plane the color selection element will inhabit
    if (this.data.showSelection) {
      this.selectionEl = document.createElement('a-circle')
      this.selectionEl.setAttribute('radius', this.data.selectionSize)
      this.selectionEl.setAttribute('material', defaultMaterial)

      //Place in top left, lift slightly
      this.selectionEl.setAttribute('position', {
        x: -this.data.wheelSize,
        y: this.data.wheelSize,
        z: 0.001
      })
      this.el.appendChild(this.selectionEl);
    }

    //Handlers
    this.el.initColorWheel = this.initColorWheel.bind(this)
    this.el.initBrightnessSlider = this.initBrightnessSlider.bind(this)
    this.el.updateColor = this.updateColor.bind(this)
    this.el.onHueDown = this.onHueDown.bind(this)
    this.el.refreshRaycaster = this.refreshRaycaster.bind(this)

    this.el.focus = this.focus.bind(this);
    this.el.blur = this.blur.bind(this);

    setTimeout(function() {
      that.el.initColorWheel()
      that.el.initBrightnessSlider()
      that.el.refreshRaycaster()

      that.colorWheel.addEventListener('click', function(evt) {
        if (that.data.disabled) return;
        console.debug(evt.detail.intersection)
        that.el.onHueDown(evt.detail.intersection.point)
        that.focus();
      });

    }, 5)


    Object.defineProperty(this.el, 'value', {
      get: function() {
        return this.getAttribute('value');
      },
      set: function(value) {
        this.setAttribute('value', value);
      },
      enumerable: true,
      configurable: true
    });
  },
  refreshRaycaster: function(){
    var raycasterEl = AFRAME.scenes[0].querySelector('[raycaster]');
    raycasterEl.components.raycaster.refreshObjects();
  },
  initBrightnessSlider: function(){
    console.debug('setup brightness slider')

    //NOTE: In A-Painter, this is actually a model submesh or element. We're going to generate it here and add it to our plane.

    let vertexShader = `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `

    let fragmentShader = `
      uniform vec3 color1;
      uniform vec3 color2;
      varying vec2 vUv;

      void main(){
        vec4 c1 = vec4(color1, 1.0);
  	    vec4 c2 = vec4(color2, 1.0);

        vec4 color = mix(c2, c1, smoothstep(0.0, 1.0, vUv.y));
        gl_FragColor = color;
      }
    `

    let material = new THREE.ShaderMaterial({
      uniforms: {
        resolution:{
          type: 'v2',
          value: new THREE.Vector2(this.brightnessSliderWidth, this.brightnessSliderHeight)
        },
        color1: {
          type: 'c',
          value: new THREE.Color(0xFFFFFF)
        },
        color2: {
          type: 'c',
          value: new THREE.Color(0x000000)
        }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });

    this.brightnessSlider.getObject3D('mesh').material = material;
    this.brightnessSlider.getObject3D('mesh').material.needsUpdate = true;

  },
  initColorWheel: function() {
    console.debug('setup color wheel')
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
      uniforms: {
        brightness: {
          type: 'f',
          value: this.hsv.v
        }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });

    this.colorWheel.getObject3D('mesh').material = material;
    this.colorWheel.getObject3D('mesh').material.needsUpdate = true;
  },
  onBrightnessDown: function(position){

  },
  onHueDown: function(position) {
    const colorWheel = this.colorWheel,
          radius = this.data.wheelSize

    let polarPosition;
    colorWheel.getObject3D('mesh').updateMatrixWorld();
    colorWheel.getObject3D('mesh').worldToLocal(position);


    let angle = Math.atan2(position.x, position.y)
    let hue = 360 - (Math.round(angle * (180 / Math.PI)) + 270) % 360
    let dist = Math.min(Math.sqrt(Math.pow(position.x, 2) + Math.pow(position.y, 2)), radius)

    this.hsv.h = hue
    this.hsv.s = Math.round((100 / radius) * dist)
    this.el.updateColor()
  },

  updateColor: function() {
    var rgb = this.hsvToRgb(this.hsv)
    console.debug(this.hsv, rgb)

    //TODO: Add indicator element of selected color
    if(this.data.showSelection){
      this.selectionEl.getObject3D('mesh').material.color.set( new THREE.Color(rgb))
      this.selectionEl.getObject3D('mesh').material.needsUpdate = true
      console.debug(this.selectionEl.getObject3D('mesh'))

    }

    this.colorHasChanged = true;
  },
  hsvToRgb: function(hsv) {
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
      case 0:
        r = v;
        g = t;
        b = p;
        break;
      case 1:
        r = q;
        g = v;
        b = p;
        break;
      case 2:
        r = p;
        g = v;
        b = t;
        break;
      case 3:
        r = p;
        g = q;
        b = v;
        break;
      case 4:
        r = t;
        g = p;
        b = v;
        break;
      case 5:
        r = v;
        g = p;
        b = q;
        break;
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  },

  rgb2hsv: function(r, g, b) {
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var d = max - min;
    var h;
    var s = (max === 0 ? 0 : d / max);
    var v = max;

    if (arguments.length === 1) {
      g = r.g;
      b = r.b;
      r = r.r;
    }

    switch (max) {
      case min:
        h = 0;
        break;
      case r:
        h = (g - b) + d * (g < b ? 6 : 0);
        h /= 6 * d;
        break;
      case g:
        h = (b - r) + d * 2;
        h /= 6 * d;
        break;
      case b:
        h = (r - g) + d * 4;
        h /= 6 * d;
        break;
    }
    return {
      h: h,
      s: s,
      v: v
    };
  },
  isFocused: false,
  focus: function(noemit) {
    if (this.isFocused) {
      return;
    }
    this.isFocused = true;

    Event.emit(this.el, 'focus');
    if (!noemit) {
      Event.emit(document.body, 'didfocuscolorwheel', this.el);
    }
  },
  blur: function(noemit) {
    if (!this.isFocused) {
      return;
    }
    this.isFocused = false;

    Event.emit(this.el, 'blur');
    if (!noemit) {
      Event.emit(document.body, 'didblurcolorwheel', this.el);
    }
  },
  update: function() {
    let that = this;
    //that.el.background.setAttribute('color', this.data.backgroundColor)
  },
  tick: function() {},
  remove: function() {},
  pause: function() {},
  play: function() {}
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
    backgroundcolor: 'colorwheel.backgroundColor',
    showselection: 'colorwheel.showSelection',
    wheelsize: 'colorwheel.wheelSize',
    selectionsize: 'colorwheel.selectionSize'
  }
});
