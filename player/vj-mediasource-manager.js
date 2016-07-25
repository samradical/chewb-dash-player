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

  constructor(options = {}) {
    this.options = options
    this.mediaSourcesConfigs = options.mediaSources;
    console.log(this.mediaSourcesConfigs);

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
        segmentAddedSignal: new Signals(),
        timeUpdateSignal: new Signals(),
        endingSignal: new Signals(),
        endedSignal: new Signals()
      }
      _.forIn(_o, (val, key) => {
        mediaPlayersOptions[key] = val
      })
      Object.freeze(mediaPlayersOptions)
      this._createMediaSource(mediaPlayersOptions)
    })

    //the controller
    // this._contoller = options.controller
    //this._contoller.mediaSources = this.mediaSources

    /*Emitter.on(`playother`, (index) => {
        this.mediaSources.forEach((ms, i) => {
            if (i !== index) {
                ms.play()
            }
        })
    })

    Emitter.on(`source0Video`, (direction) => {
        if (direction === 'down') {
            this.mediaSources[0].stepBack(5 * ControlPerameters.video.stepBack.value)
        } else {
            this.mediaSources[0].stepForward(5 * ControlPerameters.video.stepBack.value)
        }
    })

    Emitter.on(`source1Video`, (direction) => {
        if (direction === 'down') {
            this.mediaSources[1].stepBack(5 * ControlPerameters.video.stepBack.value)
        } else {
            this.mediaSources[1].stepForward(5 * ControlPerameters.video.stepBack.value)
        }
    })*/

    /*this._metronome = new Metronome({
      "tempo": 120,
      "beatsPerBar": 4,
      "loopLength": 4
    })*/

    this._update();
  }


  _createMediaSource(options) {
    let _isAudio = !options.quality.videoOnly
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
  }

  _update() {
    for (let i = 0; i < this._videoCanvasesLength; i++) {
      this.videoCanvases[i].update();
    }
    if (this.options.autoUpdate) {
      this.requestId = window.requestAnimationFrame(this.boundUpdate);
    }
  }

  onWindowResize(w, h) {
    for (let i = 0; i < this._videoCanvasesLength; i++) {
      this.videoCanvases[i].onResize(w, h);
    }
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
    return this.videoCanvases[index].getCanvas();
  }

  getBuffersAt(index) {
    return this.videoCanvases[index].getBuffers();
  }

  get mediaSources() {
    return this.playerGroups.map(group => {
      return group.mediasource
    })
  }

  get controllers() {
    return this.playerGroups.map(group => {
      return group.controller
    })
  }
}

export default VjManager;
