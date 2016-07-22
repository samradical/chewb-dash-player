import Q from 'bluebird';
import Signals from 'signals';

import {
  Utils,
  Emitter,
} from '../../utils'

import ServerService from '../../service/serverService';

import { VideoLoop } from './extentions'

const EXT_MAP = {
  loop: VideoLoop
}

class ControllerBase {
  constructor(mediaSource, options) {
    this._ServerService = ServerService
    this._addVoSignal = new Signals()
    this._emitVoBound = this._onMediaSourceReady.bind(this)
    this._nextVideoBound = this._nextVideo.bind(this)
    this._previousVideoBound = this._previousVideo.bind(this)
    this._nextSegmentBound = this._nextSegment.bind(this)
    this._previousSegmentBound = this._previousSegment.bind(this)
    this._onEndingSignalBound = this._onEndingSignal.bind(this)

    this._extentions = {}

    this._options = options

    this._ServerService.setServerBase(this._options.serverBase)

    Emitter.on(`${options.id}:controller:video:previous:video`, this._previousVideoBound)
    Emitter.on(`${options.id}:controller:video:next:video`, this._nextVideoBound)
    Emitter.on(`${options.id}:controller:video:previous:segment`, this._previousSegmentBound)
    Emitter.on(`${options.id}:controller:video:next:segment`, this._nextSegmentBound)

    this._createExtentions(mediaSource, options)
  }

  get addVoSignal() {
    return this._addVoSignal
  }

  get options() {
    return this._options
  }

  set mediaSource(ms) {
    this._mediaSource = ms
    ms.readySignal.addOnce(this._emitVoBound)
    ms.endingSignal.add(this._onEndingSignalBound)
    this._onMediaSourceSet()
  }

  _createExtentions(mediaSource, options) {
    let extentions = options.extentions || []
    extentions.map(id => {
      this._extentions[id] = new EXT_MAP[id](mediaSource, options)
    })
  }

  _nextVideo() {
    this._setNextVideoId()
    this._loadNextSegmentAndSkip()
  }

  _previousVideo() {
    this._setPreviousVideoId()
    this._loadNextSegmentAndSkip()
  }

  _nextSegment(){
    let _videoVo = this.currentVideoVo
    this._nextVideoVoSegment(_videoVo)
  }

  _previousSegment(){
    let _videoVo = this.currentVideoVo
    this._previousVideoVoSegment(_videoVo)
  }

  _loadNextSegmentAndSkip() {
    this._loadNextSegment()
      .then((addedResult={}) => {
        this._mediaSource.stepForward(addedResult.duration)
      }).finally()
  }

  _nextVideoVoSegment(videoVo){
    let _s = videoVo.segIndex++
    _s = (_s > videoVo.refLength-1) ? 0 : _s
    this._loadNextSegmentAndSkip()
  }

  _previousVideoVoSegment(videoVo){
    //it moved
   let _s = videoVo.segIndex-=2
    _s = (_s < 0) ? videoVo.refLength-1 : _s
    this._loadNextSegmentAndSkip()
  }

  _onEndingSignal() {

  }

  _onMediaSourceSet() {

  }

  addVo() {

  }

  getVo() {

  }

  nextVideoById(id){
    this.currentVideoId = id
    this._loadNextSegment().finally()
    //this._loadNextSegmentAndSkip()
  }

  _onMediaSourceReady(mediaSource) {

  }
}

export default ControllerBase;
