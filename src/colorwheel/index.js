const Utils = require('../utils');
const Event = require('../core/event');

AFRAME.registerComponent('colorwheel', {
  dependencies: ['raycaster'],
  schema: {
    value: {
      type: 'string',
      default: ''
    },
    name: {
      type: 'string',
      default: ''
    },
    disabled: {
      type: 'boolean',
      default: false
    },
    color: {
      type: 'color',
      default: '#000'
    },
    backgroundColor: {
      type: 'color',
      default: '#FFF'
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
  //Util to animate between colors. Item should be a material.
  setTween: function(item, fromColor, toColor) {
    this.tween = new TWEEN.Tween(new THREE.Color(fromColor)).to(toColor, 500).onUpdate(function() {
      item.color.r = this.r;
      item.color.g = this.g;
      item.color.b = this.b;
    }).start()
  },
  init: function() {
    const that = this

    //Padding around background, between elements
    //TODO: Expose?
    const padding = 0.15

    //Selected HSV color of the wheel
    this.hsv = {
      h: 0.0,
      s: 0.0,
      v: 1.0
    }

    this.color = '#ffffff'

    const defaultMaterial = {
      color: '#ffffff',
      flatShading: true,
      transparent: true,
      fog: false,
      side: 'double'
    }

    //Background color of this interface
    //TODO: Expose?
    this.backgroundWidth = this.data.wheelSize * 2;
    this.backgroundHeight = this.data.wheelSize * 2;

    this.background = document.createElement('a-rounded');
    this.background.setAttribute('radius', 0.02)
    this.background.setAttribute('width', this.backgroundWidth + 2 * padding)
    this.background.setAttribute('height', this.backgroundHeight + 2 * padding)
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
    //TODO: Expose height and width for customisation?
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

    //Color 'cursor'. We'll use this to indicate a rough color selection
    this.colorCursorOptions = {
      cursorRadius: 0.025,
      cursorSegments: 32,
      cursorColor: new THREE.Color(0x000000),
      lineWidth: 3.0
    }
    this.colorCursorOptions.cursorMaterial = new THREE.LineBasicMaterial( { color: this.colorCursorOptions.cursorColor, transparent:true, linewidth: this.colorCursorOptions.lineWidth } ),

    //A custom THREE object because we don't want the centre vertex, and want a line material
    this.colorCursor = document.createElement('a-entity')
    let geometry = new THREE.CircleGeometry( this.colorCursorOptions.cursorRadius, this.colorCursorOptions.cursorSegments )
    geometry.vertices.shift()
    this.colorCursor.setObject3D('mesh', new THREE.Line( geometry, this.colorCursorOptions.cursorMaterial ))
    this.el.appendChild(this.colorCursor);

    //Handlers
    this.bindMethods()

    setTimeout(() => {

      that.el.initColorWheel()
      that.el.initBrightnessSlider()
      that.el.refreshRaycaster()

      that.colorWheel.addEventListener('click', function(evt) {
        if (that.data.disabled) return;
        that.el.onHueDown(evt.detail.intersection.point)
      });

      that.brightnessSlider.addEventListener('click', function(evt) {
        if (that.data.disabled) return;
        that.el.onBrightnessDown(evt.detail.intersection.point)
      });

    }, 5)
  },

  bindMethods: function() {
    this.el.initColorWheel = this.initColorWheel.bind(this)
    this.el.initBrightnessSlider = this.initBrightnessSlider.bind(this)
    this.el.updateColor = this.updateColor.bind(this)
    this.el.onHueDown = this.onHueDown.bind(this)
    this.el.onBrightnessDown = this.onBrightnessDown.bind(this)
    this.el.refreshRaycaster = this.refreshRaycaster.bind(this)
  },

  refreshRaycaster: function() {
    const raycasterEl = AFRAME.scenes[0].querySelector('[raycaster]')
    raycasterEl.components.raycaster.refreshObjects()
  },

  initBrightnessSlider: function() {
    /*
     * NOTE:
     *
     * In A-Painter, the brightness slider is actually a model submesh or element.
     * We're going to generate it using glsl here and add it to our plane.
     */

    const vertexShader = `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `

    const fragmentShader = `
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
    })

    this.brightnessSlider.getObject3D('mesh').material = material;
    this.brightnessSlider.getObject3D('mesh').material.needsUpdate = true;

  },
  initColorWheel: function() {
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      #define M_PI2 6.28318530718
      uniform float brightness;
      varying vec2 vUv;
      vec3 hsb2rgb(in vec3 c){
          vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0 );
          rgb = rgb * rgb * (3.0 - 2.0 * rgb);
          return c.z * mix( vec3(1.0), rgb, c.y);
      }

      void main() {
        vec2 toCenter = vec2(0.5) - vUv;
        float angle = atan(toCenter.y, toCenter.x);
        float radius = length(toCenter) * 2.0;
        vec3 color = hsb2rgb(vec3((angle / M_PI2) + 0.5, radius, brightness));
        gl_FragColor = vec4(color, 1.0);
      }
      `;

    let material = new THREE.ShaderMaterial({
      uniforms: {
        brightness: {
          type: 'f',
          value: this.hsv.v
        }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });

    this.colorWheel.getObject3D('mesh').material = material
    this.colorWheel.getObject3D('mesh').material.needsUpdate = true
  },
  onBrightnessDown: function(position) {
    const brightnessSlider = this.brightnessSlider

    brightnessSlider.getObject3D('mesh').updateMatrixWorld()
    brightnessSlider.getObject3D('mesh').worldToLocal(position)

    //Value between 0 and 1
    //Plane is centre registered
    let cursorOffset = position.y + this.brightnessSliderHeight / 2
    let brightness =  cursorOffset  / this.brightnessSliderHeight

    this.colorWheel.getObject3D('mesh').material.uniforms['brightness'].value = brightness
    this.hsv.v = brightness

    this.el.updateColor()
  },
  onHueDown: function(position) {
    const colorWheel = this.colorWheel,
      radius = this.data.wheelSize

    colorWheel.getObject3D('mesh').updateMatrixWorld();
    colorWheel.getObject3D('mesh').worldToLocal(position);

    let polarPosition = {
      r: Math.sqrt(position.x * position.x + position.y * position.y),
      theta: Math.PI + Math.atan2(position.y, position.x)
    };
    var angle = ((polarPosition.theta * (180 / Math.PI)) + 180) % 360;
    this.hsv.h = angle / 360;
    this.hsv.s = polarPosition.r / radius;

    this.el.updateColor()
  },

  updateColor: function() {
    let rgb = this.hsvToRgb(this.hsv)
    let color = 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')'

    const selectionEl = this.selectionEl.getObject3D('mesh')

    //Update indicator element of selected color
    if (this.data.showSelection) {
      //Uncomment for no tweens: selectionEl.material.color.set(color)
      this.setTween(selectionEl.material, selectionEl.material.color, new THREE.Color(color))
      selectionEl.material.needsUpdate = true
    }

    this.color = color

    //Notify listeners the color has changed. TODO: Test this works :0
    Event.emit(this.el, 'changecolor', color)
    Event.emit(document.body, 'didchangecolor', this.el);

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
  update: function() {
    const that = this;
    that.background.setAttribute('color', this.data.backgroundColor)
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
