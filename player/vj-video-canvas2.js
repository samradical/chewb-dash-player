const W = 640;
const H = 360;
const MOD_FRAMES = 2;
const BUFFER_LENGTH = 50;
const REWIND_RECOVER = 200;

class VideoCanvas {

  constructor(mediaSource, options, videoBufferOptions = {}) {
    this._mediaSource = mediaSource
    this.options = options;
    this._width = options.videoWidth || W
    this._height = options.videoHeight || H
      //this.fpsLoop = Math.floor(60 / (options.fps || 30))
    this.fpsLoop = 0
    this.videoBufferOptions = videoBufferOptions;
    this.videoElement = mediaSource.el;
    this.videoWidth;
    this.videoHeight;
    this.fboWidth;
    this.fboHeight;
    this.windowW = window.innerWidth;
    this.windowH = window.innerHeight;
    this.containerRatio = this._width / this._height;

    this.buffers = []

    this.rewindId;
    this.rewindValue = null
    this.frames = []
    this.totalFrames = 0

    this.counter = 0
    this.activeIndex = 0

    this.options.videoStartedSignal.add(this._setCanvasResolution.bind(this));
    //this.options.videoPlayingSignal.add(this._setCanvasResolution.bind(this));

    this.started = false

    this._init();

  }

  _setCanvasResolution() {
    this.videoWidth = this.videoElement.videoWidth || this._width;
    this.videoHeight = this.videoElement.videoHeight || this._height;

    let elRatio = this.videoWidth / this.videoHeight;
    let scale, x, y;

    // define scale
    if (this.containerRatio > elRatio) {
      scale = this._width / this.videoWidth;
    } else {
      scale = this._height / this.videoHeight;
    }
    // define position
    if (this.containerRatio === elRatio) {
      x = y = 0;
    } else {
      x = (this._width - this.videoWidth * scale) * 0.5 / scale;
      y = (this._height - this.videoHeight * scale) * 0.5 / scale;
    }

    this.fboWidth = this.videoWidth * scale;
    this.fboHeight = this.videoHeight * scale;

    /*this.frameBuffer.width = this.fboWidth;
    this.frameBuffer.height = this.fboHeight;

    this.latestFrameBuffer.width = this.fboWidth;
    this.latestFrameBuffer.height = this.fboHeight;*/
    this.started = true
  }

  _createBuffers(){
    let _c = this._createCanvas(this._width, this._height);
    return{
      canvas:_c,
      ctx:_c.getContext('2d')
    }
  }


  _createCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  _init() {
    this._buffers = [this._createBuffers(), this._createBuffers()]
    /*console.log(this._width, this._height);
    this.frameBuffer = this._createCanvas(this._width, this._height);
    if (this.options.verbose) {
      document.body.appendChild(this.frameBuffer)
    }
    this.bufferCtx = this.frameBuffer.getContext("2d");
    this.buffers.push(this.frameBuffer)

    this.latestFrameBuffer = this._createCanvas(this._width, this._height);
    this.latestBufferCtx = this.latestFrameBuffer.getContext("2d");
    this.buffers.push(this.latestFrameBuffer)*/
    if (this.options.verbose) {
      document.body.appendChild(this._buffers[0].canvas)
      document.body.appendChild(this._buffers[1].canvas)
    }

    this._setCanvasResolution()
  }

  update() {
    if (!this.started || this._mediaSource.waiting) {
      return
    }

    let _ctx = this._buffers[this.activeIndex].ctx
    //if (this.counter % MOD_FRAMES === 0) {

    _ctx.clearRect(0, 0, this.windowW, this.windowH);
    _ctx.drawImage(
      this.videoElement,
      0,
      0,
      this.videoWidth,
      this.videoHeight,
      0,
      -(this.fboHeight-this._height)/2,
      this.fboWidth,
      this.fboHeight);

    /*var data = this.latestBufferCtx.getImageData(0, 0, this.fboWidth, this.fboHeight);
    this.frames.push(data);
    this.totalFrames = this.frames.length;

    if (this.totalFrames >= this.videoBufferOptions.bufferSize) {
      var f = this.frames.shift();
      f = null;
    }

    this.bufferCtx.clearRect(0, 0, this.windowW, this.windowH);
    let _middleFrame = Math.floor(this.totalFrames / 2)
    this.bufferCtx.putImageData(this.frames[_middleFrame], 0, 0);*/
    //}
    //this.counter++
  }

  getCanvas() {
    return this.frameBuffer;
  }

  getBuffers() {
    return this.buffers
  }

  getLastFrameCanvas() {
    return this.latestFrameBuffer;
  }

  onResize(w, h) {
    this.windowW = w;
    this.windowH = h;
    //this._setCanvasResolution()
  }
};
export default VideoCanvas;
