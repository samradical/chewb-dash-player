import Q from 'bluebird';
import Signals from 'signals';

import {
  Utils,
  Emitter,
} from '../../utils'

import ServerService from '../../service/serverService';
import SocketService from '../../service/socketService';

import { VideoLoop, Shuffle } from './extentions'

const EXT_MAP = {
  loop: VideoLoop,
  shuffle: Shuffle
}

let VIDEO_VO = {
  refIndex: 0,
  currentRefDuration: 0,
  watchedRefs: [],
  timelineTotal: 0,
  refLength: undefined
}
let TIMELINE_VO = {}

class ControllerBase {

  constructor(options = {}) {
    this._options = options
    this.mediaSources = []
    this._readyCheck = {
      handshake: false,
      ready: false
    }
    this._ServerService = ServerService
    this._SocketService = new SocketService(this._options.serverBase)
    this._addVoSignal = new Signals()
    this._voAddedSignal = new Signals()
    this._emitVoBound = this._onMediaSourceReady.bind(this)
    this._nextVideoBound = this._nextVideo.bind(this)
    this._previousVideoBound = this._previousVideo.bind(this)
    this._nextSegmentBound = this._nextSegment.bind(this)
    this._previousSegmentBound = this._previousSegment.bind(this)
    this._onEndingSignalBound = this._onEndingSignal.bind(this)
    this._onTimeupdateSignalBound = this._onTimeupdateSignal.bind(this)
    this._onVideoPlayingSignalBound = this._onVideoPlayingSignal.bind(this)
    this._onVideoPausedSignalBound = this._onVideoPausedSignal.bind(this)
    this._onVideoWaitingSignalBound = this._onVideoWaitingSignal.bind(this)

    this._extensions = {}
    this._playedVideoVos = {
      //videoId...{}
    }

    this._ServerService.setServerBase(this._options.serverBase)

    Emitter.on(`${options.id}:controller:video:previous:video`, this._previousVideoBound)
    Emitter.on(`${options.id}:controller:video:next:video`, this._nextVideoBound)
    Emitter.on(`${options.id}:controller:video:previous:segment`, this._previousSegmentBound)
    Emitter.on(`${options.id}:controller:video:next:segment`, this._nextSegmentBound)

    this._createExtensions(options)

    this._SocketService.handshakeSignal.addOnce(() => {
      this._readyCheck.handshake = true
      this._tryStart()
    })

  }

  //************
  //INIT
  //************

  init() {

  }

  update() {
    if (this.videoCanvas) {
      this.videoCanvas.update()
    }
  }

  _tryStart() {
    let _r = _.every(_.values(this._readyCheck), Boolean);
    if (_r) {
      this._initListeners()
      if (!this._options.paused && !this._options.noAutoStart) {
        this.addVo().finally()
      }
    }
  }

  _initListeners() {
    this.mediaSources.forEach(ms => {
      ms.readySignal.addOnce(this._emitVoBound)
      ms.endingSignal.add(this._onEndingSignalBound)
      ms.timeUpdateSignal.add(this._onTimeupdateSignalBound)
      ms.videoPlayingSignal.add(this._onVideoPlayingSignalBound)
      ms.videoPausedSignal.add(this._onVideoPausedSignalBound)
      ms.videoWaitingSignal.add(this._onVideoWaitingSignalBound)
    })
  }

  _createExtensions(options) {
  	console.log(options);
    let extensions = options.extensions || []
    extensions.map(id => {
      this._extensions[id] = new EXT_MAP[id](this, options)
    })
  }

  addVo() {
    return Q.map(this.mediaSources, mediaSource => {
      return this._getMediaSourceVo(mediaSource)
    }, { concurrency: 1 })
  }

  /*
  Override this
  */
  _getMediaSourceVo(mediaSource) {

  }

  //************
  //INIT
  //************

  get addVoSignal() {
    return this._addVoSignal
  }

  get voAddedSignal() {
    return this._voAddedSignal
  }

  get options() {
    return this._options
  }

  _nextVideo() {
    this._setNextVideoId()
    this._loadNextSegmentAndSkip()
  }

  _previousVideo() {
    this._setPreviousVideoId()
    this._loadNextSegmentAndSkip()
  }

  _nextSegment() {
    let _videoVo = this.currentVideoVo
    this._nextVideoVoSegment(_videoVo)
  }

  _previousSegment() {
    let _videoVo = this.currentVideoVo
    this._previousVideoVoSegment(_videoVo)
  }

  _loadNextSegmentAndSkip() {
    this.addVo().then(mediasources => {
      mediasources[0].stepForward(mediasources[0].currentVo.startTime)
    }).finally()
    /*this._loadNextSegment()
      .then((addedResult = {}) => {
        this._mediaSource.stepForward(addedResult.duration)
      }).finally()*/
  }

  _nextVideoVoSegment(videoVo) {
    let _s = videoVo.segIndex++
      _s = (_s > videoVo.refLength - 1) ? 0 : _s
    this._loadNextSegmentAndSkip()
  }

  _previousVideoVoSegment(videoVo) {
    //it moved
    let _s = videoVo.segIndex -= 2
    _s = (_s < 0) ? videoVo.refLength - 1 : _s
    this._loadNextSegmentAndSkip()
  }

  _isMediaSourceMaster(ms) {
    return (this.mediaSources.indexOf(ms) === 0)
  }

  //**************
  //SIGNALS
  //**************

  _onEndingSignal(mediaSource) {
    if (this._isMediaSourceMaster(mediaSource)) {
      this.addVo().finally()
    }
    //this._checkVideoPlaybackPostion(mediaSource)
    //this._loadNextSegment(mediaSource).finally()
  }

  /*
  Sync
  */
  _onTimeupdateSignal(mediaSource) {
    //video, or aidio if just audio
    return
    if (this.mediaSources.indexOf(mediaSource) === 0) {
      let _ms = this.mediaSources[1]
      if (_ms) {
        let _diff = Math.abs(_ms.currentTime - mediaSource.currentTime)
        if (_diff > 1) {
          _ms.currentTime = mediaSource.currentTime
        }
      }
    }
    /*let _l = this.mediaSources.length
    if (_l > 1) {
      let _i = this.mediaSources.indexOf(mediaSource)
      let _other = (_i + 1)
      _other = (_other >= _l) ? 0 : _other;
      let _ms = this.mediaSources[_other]
        //sync 1 sec off
      let _diff = Math.abs(_ms.currentTime - mediaSource.currentTime)
      if (_diff > 1) {
        let _t = Math.min(_ms.currentTime, mediaSource.currentTime)
        _ms.currentTime = _t
        mediaSource.currentTime = _t
      }
    }*/
  }

  _onVideoPlayingSignal(mediaSource) {
    let _ms = this._getOtherMediaSource(mediaSource)
    if (mediaSource !== _ms) {
      _ms.play()
    }
  }

  _onVideoPausedSignal(mediaSource) {
    let _ms = this._getOtherMediaSource(mediaSource)
    if (mediaSource !== _ms) {
      _ms.pause()
    }
  }

  _onVideoWaitingSignal(mediaSource) {
    let _ms = this._getOtherMediaSource(mediaSource)
    if (mediaSource !== _ms) {
      _ms.pause()
    }
  }

  _getOtherMediaSource(mediaSource) {
    let _i = this.mediaSources.indexOf(mediaSource)
    let _other = (_i + 1)
    _other = (_other >= this.mediaSources.length) ? 0 : _other;
    return this.mediaSources[_other]
  }

  nextVideoById(id) {
    this.currentVideoId = id
    return this._loadNextSegment()
      //this._loadNextSegmentAndSkip()
  }

  _onMediaSourceReady(mediaSource) {

  }
}

export default ControllerBase;
