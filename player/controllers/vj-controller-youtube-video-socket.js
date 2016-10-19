import Q from 'bluebird';
import _ from 'lodash';

import {
  Utils,
  Constants,
  Cache
} from '../../utils'
const { ERROR_TYPES,MEDIASOURCE_TYPES } = Constants;

class YoutubeVideoSocket {

  constructor(controller) {
    this._controller = controller
    this._SocketService = this._controller._SocketService
    this._sidxQualityOptions = this._getSidxQualityOptions(this._controller.options.quality)
  }

  getManifest(mediaSource, videoId, uuid) {
    return new Q((yes, no) => {
      let _existingManifest = Cache.getSidxManifest(uuid)
      if (_existingManifest) {
        yes(_existingManifest)
      } else {
        yes(this._getSidx(
          videoId,
          this._getSidxOptions(
            mediaSource,
            videoId,
            this._sidxQualityOptions
          )
        ).then(manifest => {
          Cache.setSidxManifest(uuid, manifest)
          return manifest
        }))
      }
    })
  }

  getIndexBuffer(
    uuid,
    url,
    range,
    options = {
      youtubeDl: true,
      isIndexRange: true,
      uuid:uuid,
    }) {

    return this._getSocketVideoRange(
      _.assign({}, {
        uuid: uuid,
        url: url,
        totalBytes:0,
        range: range
      }, options)
    ).then(buffer=>{
      Cache.copySetIndexBuffer(uuid, buffer)
      return buffer
    })

  }

  getRangeBuffer(uuid,
    url,
    range,
    options = {
      youtubeDl: true
    }) {

    return this._getSocketVideoRange(
      _.assign({}, {
        uuid: uuid,
        url: url,
        totalBytes:0,
        range: range
      }, options)
    )

  }

  preload(mediaSource, videoId) {
    let _uuid = this.getUUID(mediaSource.type, videoId)
    let _videoVo = this.videoVoUtils.getVideoVo(_uuid)

    _videoVo.preloadPromise = this.getManifest(
        mediaSource,
        videoId,
        _uuid
      ).then((manifest) => {

        this._controller._onManifestReceived(mediaSource, _videoVo, manifest)

        return this.getIndexBuffer(
          _uuid,
          this.videoVoUtils.getManifestUrl(manifest),
          this.videoVoUtils.getManifestIndexRange(manifest)
        ).then(buffer => {
          let _mediaSourceVo = this._controller._createMediaSourceVo(manifest, _videoVo, this.options)
          _mediaSourceVo.indexBuffer = buffer
          Cache.copySetIndexBuffer(_uuid, buffer)
          console.log("CACHED", videoId, _uuid);
          return _mediaSourceVo
        })
      })
      .catch(err => {
        this.controller._onMediaSourceError(Utils.getError(ERROR_TYPES.VIDEO_ID))
      })
      return _videoVo.preloadPromise
  }

  cancelPreload(videoId){
    let _vuuid = this.getUUID(MEDIASOURCE_TYPES.VIDEO, videoId)
    let _auuid = this.getUUID(MEDIASOURCE_TYPES.AUDIO, videoId)
    let _videoVo = this.videoVoUtils.getVideoVo(_vuuid)
    let _audioVo = this.videoVoUtils.getVideoVo(_auuid)
    if(_videoVo){
      if(_videoVo.preloadPromise){
        _videoVo.preloadPromise.cancel()
        _videoVo.preloadPromise = null
        delete _videoVo.preloadPromise
      }
    }
  }

  getUUID(type, videoId) {
    return `${type}:${videoId}:${this.sidxResolution}`
  }

  get sidxResolution() {
    return this._sidxQualityOptions.resolution
  }

  get videoVoUtils(){
    return this._controller._videoVoUtils
  }

  get options(){
    return this._controller._options
  }

  get controller(){
    return this._controller
  }

  _getSidx(vId, options = {}) {
      return this._SocketService
        .getSidx(_.assign({}, options, { id: vId }))
        .then(sidx => {
          return sidx
        })
        /*.catch(err => {
          let { videoId } = err
          console.log(err);
          console.log(this.youtubeItemIds);
          this._removeVideoIdFromQueue(videoId)
          console.log(this.youtubeItemIds);
          return this.addVo().finally()
        })*/
    }

  _getSidxQualityOptions(quality) {
    return {
      resolution: quality.resolution
    }
  }

  _getSidxOptions(mediaSource, videoId, options = {}) {
    return _.assign({}, {
      videoOnly: (mediaSource.type === 'video'),
      audioOnly: (mediaSource.type === 'audio'),
      uuid: this.getUUID(mediaSource.type, videoId)
    }, options)
  }

  _getSocketVideoRange(options) {
    return this._SocketService.getVideoRange(options)
  }

}

export default YoutubeVideoSocket
