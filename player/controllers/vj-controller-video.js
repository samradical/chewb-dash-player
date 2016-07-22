import Q from 'bluebird';
import _ from 'lodash';

import ControllerBase from './vj-controller-base';

import {
  JsonLoader,
  Utils,
  Emitter,
  Constants
} from '../../utils'

const { ERROR_TYPES } = Constants;
let VIDEO_VO = {
  refIndex: 0,
  refLength: undefined
}

import VjUtils from '../vj-utils';
class VideoController extends ControllerBase {

  constructor(mediaSource, options) {
    super(mediaSource, options)
    this.mediaSource = mediaSource
    this._options = options
    this._jsonsUrls = this._options.jsonUrls

    this._playedVideoVos = {}

    this._loadJsons(this._jsonsUrls).then(jsons => {
      this._mpds = jsons
      if(this._options.noAutoStart){
        this._loadNextSegment()
      }
    })
  }

  addVo() {
    this._loadNextSegment().finally()
  }

  _onEndingSignal() {
    this._loadNextSegment().finally()
  }

  _loadNextSegment(sub = {}) {
    let _videoVo = this.currentVideoVo
    let data = this._mpds[this.currentVideoIndex]
    let _references = data.sidx.references
    _videoVo.refLength = _references.length
    console.log(data);
    console.log(_references);
    console.log(_videoVo);
    let _ref = _references[_videoVo.refIndex]
    let _vo = VjUtils.voFromRef(data, _ref);
    _videoVo.refIndex = (_videoVo.refIndex + 1) > (_references.length - 1) ? 0 : (_videoVo.refIndex + 1)
    console.log(_vo);
    return this._mediaSource.addVo(_vo)
    .catch(err => {
      console.log(err);
    })
  }

  /*
  Something went wrong when trying to add the vo
  */
  _handleVoError(err) {
    let { message } = err
    let _type = message.split(':')[0]
    let _videoId = message.split(':')[1]
    switch (_type) {
      case ERROR_TYPES.FATAL:
        this._currentRef = undefined
        this._mpds = this._filterById(this._mpds, _videoId)
        return this._mediaSource.resetMediasource()
          .then(() => {
            return this._loadNextSegment()
          })
        break
    }
  }

  _loadJsons(jsons) {
    return JsonLoader.load(jsons)
  }

  _filterById(source, id) {
    return source.filter(item => {
      return !(item === id)
    })
  }

  _getPlayedVideoVo(videoId) {
    if (!this._playedVideoVos[videoId]) {
      this._playedVideoVos[videoId] = _.clone(VIDEO_VO)
    }
    return this._playedVideoVos[videoId]
  }

  _setRandomVideoIndex() {
    this.currentVideoIndex = Utils.getRandomNumberRange(this._mpds.length - 1)
    return this.currentVideoIndex
  }

  set currentVideoIndex(i) {
    this._currentVideoIndex = i
  }

  get currentVideoIndex() {
    return this._currentVideoIndex || 0
  }

  set currentVideoId(id) {
    this._currentVideoId = id
    this.currentVideoIndex = this._mpds.indexOf(_.find(this._mpds, {id:id}))
  }

  get currentVideoId() {
    return this._mpds[this.currentVideoIndex].id
  }

  get currentVideoVo() {
    return this._getPlayedVideoVo(this.currentVideoId)
  }

  get options() {
    return this._options
  }

  _getRandomVideoId() {
    return this._mpds[Math.floor(Math.random() * this._mpds.length - 1)]
  }
}

export default VideoController;
