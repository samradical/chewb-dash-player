import _ from 'lodash';

import {
  Utils,
  Emitter,
  Metronome
} from '../utils'

import Signals from 'signals';

import VjMediaSource from './vj-mediasource-socket';
import VjVideoCanvas from './vj-video-canvas';
import ControllerYoutubeVideo from './controllers/vj-controller-youtube-video';
import ControllerVideo from './controllers/vj-controller-video';

import VjUtils from './vj-utils';

class VjManager {

  constructor(Controller = {}) {
    this.options = Controller.toJson()
    this.mediaSourcesConfigs = this.options.mediaSources;

    this.playerGroups = [];
    this.videoCanvases = [];

    this.parent = this.options.el || document.body;
    this.boundUpdate = this._update.bind(this);


    Emitter.on('mediasource:ready', (mediasource) => {
      // this._contoller.getVo(mediasource.options)
      // .then(vo=>{
      //     mediasource.addVo(vo)
      // })
    })

    Emitter.on('controller:addVo', (mediasource) => {
      // this._contoller.getVo(mediasource.options)
      // .then(vo=>{
      //     mediasource.addVo(vo)
      // })
    })

    Emitter.on('mediasource:ending', (mediasource) => {

    })

    Emitter.on('mediasource:videostarting', (mediasource) => {
      for (let i = 0; i < this._videoCanvasesLength; i++) {
        this.videoCanvases[i].onResize(window.innerWidth, window.innerHeight);
      }
    })

    _.each(this.mediaSourcesConfigs, (mediaPlayersOptions) => {
      let _o = {
        readySignal: new Signals(),
        videoStartedSignal: new Signals(),
        videoPlayingSignal: new Signals(),
        videoPausedSignal: new Signals(),
        videoWaitingSignal: new Signals(),
        segmentAddedSignal: new Signals(),
        timeUpdateSignal: new Signals(),
        endingSignal: new Signals(),
        endedSignal: new Signals()
      }
      _.forIn(_o, (val, key) => {
        mediaPlayersOptions[key] = val
      })
      Object.freeze(mediaPlayersOptions)
      this._createController(mediaPlayersOptions)
    })

    this._update();
  }

  _createController(options) {

    let _group = {

    }
    this.playerGroups.push(_group)
    this.playerGroupsLength = this.playerGroups.length

    let _controller,
      _controllerOptions = _.assign({}, options.controller, options)
    if (_controllerOptions.playlists.length) {
      _controller = new ControllerYoutubeVideo(_controllerOptions)
    } else {
      _controller = new ControllerVideo(_controllerOptions)
    }

    if (options.video) {
      _controller.videoSource = this._createMediaSource(
        _controllerOptions,
        'video'
      )

      _controller.mediaSources.push(_controller.videoSource)

      if (!options.noVideoCanvas) {
        _controller.videoCanvas = this._createVideoCanvas(
          _controller.videoSource,
          options,
          options.videoCanvas
        )
      }
    }

    if (options.audio) {
      _controller.audioSource = this._createMediaSource(
        _controllerOptions,
        'audio'
      )
      _controller.mediaSources.push(_controller.audioSource)
    }

    _group.controller = _controller

    _controller.init()
  }

  _createMediaSource(options, type) {
    let _ms = new VjMediaSource(options, type)
    if (options.verbose) {
      this.parent.appendChild(_ms.el);
    }
    return _ms
  }

  _createVideoCanvas(mediaSource, options) {
    let _v = new VjVideoCanvas(mediaSource,
      options,
      options.videoCanvas
    );
    if (options.verbose) {
      this.parent.appendChild(_v.el);
    }
    return _v
  }

  /*
    _createMediaSource(options) {
      let _isAudio = !options.quality.videoOnly
      let _isVideo = options.quality.videoOnly
      let _ms = new VjMediaSource(options)
      let _group = {

      }
      this.playerGroups.push(_group)
      this.playerGroupsLength = this.playerGroups.length

      if (!_isAudio && !options.noVideoCanvas) {
        this.videoCanvases.push(new VjVideoCanvas(_ms, options, options.videoCanvas));
        this._videoCanvasesLength = this.videoCanvases.length
      }
      //options.controller.mediaSource = _ms
      let _controller,
        _controllerOptions = _.assign({}, options, options.controller)
      if (_controllerOptions.playlists.length) {
        _controller = new ControllerYoutubeVideo(_ms, _controllerOptions)

      } else {
        _controller = new ControllerVideo(_ms, _controllerOptions)
      }

      if (_controllerOptions.verbose) {
        this.parent.appendChild(_ms.el);
      }

      _group.mediasource = _ms
      _group.controller = _controller
    }*/

  _update() {
    if (this.options.autoUpdate) {
      for (let i = 0; i < this.playerGroupsLength; i++) {
        this.playerGroups[i].controller.update();
      }
      this.requestId = window.requestAnimationFrame(this.boundUpdate);
    }
  }

  onWindowResize(w, h) {
    for (let i = 0; i < this._videoCanvasesLength; i++) {
      this.videoCanvases[i].onResize(w, h);
    }
  }

  on(event, callback) {
    Emitter.on(`user:${event}`, callback)
  }

  off(event, callback) {
    Emitter.off(`user:${event}`, callback)
  }

  // set controller(contoller) {
  //     this._controller = contoller
  //     this._controller.addVoSignal.add(() => {

  //     })
  // }

  update() {
    this.boundUpdate();
  }

  getCanvasAt(index) {
    return this.videoCanvas[index].getCanvas();
  }

  getBuffersAt(index) {
    return this.videoCanvas[index].getBuffers();
  }

  get mediaSources() {
    return this.playerGroups.map(group => {
      return group.controller.mediaSources
    })
  }

  get videoCanvas() {
    return this.playerGroups.map(group => {
      return group.controller.videoCanvas
    })
  }

  get controllers() {
    return this.playerGroups.map(group => {
      return group.controller
    })
  }
}

export default VjManager;
