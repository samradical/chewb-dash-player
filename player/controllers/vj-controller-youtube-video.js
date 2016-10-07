import Q from 'bluebird';
import _ from 'lodash';


import ControllerBase from './vj-controller-base';

import {
  Utils,
  Constants,
  Cache
} from '../../utils'

const { ERROR_TYPES } = Constants;

let VIDEO_VO = {
  refIndex: 0,
  currentRefDuration: 0,
  watchedRefs: [],
  timelineTotal: 0,
  refLength: undefined
}
let TIMELINE_VO = {}

const VERBOSE = true

import VjUtils from '../vj-utils';

class VideoController extends ControllerBase {

  constructor(options) {
    super(options)
      //this.mediaSource = mediaSource
    this._options = options
    this._playlists = this._options.playlists
    this._sidxQualityOptions = this._getSidxQualityOptions(this._options.quality)

    this.youtubeItems = [];
    this.youtubeItemIds = [];

    this._requestedIds = []

    this._barCounter = 0

  }

  init() {
    this._getPlaylistVideoIds()
      .then(() => {
        this._readyCheck.ready = true
        return this._tryStart()
      })
  }

  _getSidxQualityOptions(quality) {
    return {
      resolution: quality.resolution
    }
  }

  _getMediaSourceVo(mediaSource) {
    //maybe a hack?
    this._tempMediaSource = mediaSource

    let _uuid = this._getUUID(mediaSource, this.currentVideoId)
    console.log('_getMediaSourceVo');
    console.log(_uuid);
    return this._getSidx(
        this.currentVideoId,
        this._getSidxOptions(
          mediaSource,
          this.currentVideoId,
          this._sidxQualityOptions
        )
      )
      .then(data => {
        let _videoVo = this._getCurrentVideoVo(_uuid)
        let _references = data.sidx.references
        let _ref = _references[_videoVo.refIndex]
        _videoVo.refLength = _references.length

        //we override this in extensions
        this._chooseVoRefIndex(_videoVo)

        let _vo = VjUtils.combineRefsIndexs(
          data,
          _videoVo,
          this._options);

        _vo.uuid = _uuid

        return this._SocketService
          .getVideoRange({
            uuid: _uuid,
            url: _vo.url,
            range: _vo.indexRange,
            youtubeDl: _vo.youtubeDl,
            isIndexRange:true
          })
          .then(buffer => {
            _vo.indexBuffer = buffer
            Cache.copySetIndexBuffer(_vo.uuid, _vo.indexBuffer)
            if(VERBOSE) console.log("Got index buffer");
            return this._SocketService
              .getVideoRange({
                uuid: _uuid,
                url: _vo.url,
                range: _vo.byteRange,
                youtubeDl: _vo.youtubeDl
              })
              .then(buffer => {
                _vo.videoBuffer = buffer
            	if(VERBOSE) console.log("Got video buffer");

                /*var buf = new ArrayBuffer(_vo.indexBuffer.length)
                var bufView = new Uint8Array(buf);
                bufView.set(_vo.indexBuffer)

                let i = Math.floor(Math.random() * 4)
                this._SocketService.addVideo({
                	indexBuffer: buf,
                	rangeBuffer: _vo.videoBuffer,
                	saveName: _vo.videoId,
                	duration:_vo.duration,
                	saveGroup: (i === 0)
                })*/

                //override this method
                this._onIndexAndBufferSuccess(_vo)

                /*this._saveIndexRange(_vo)*/
                /*this._addToRequested(_vo)*/

                return mediaSource.addVo(_vo)
                  .then(mediaSource => {
                    this.voAddedSignal.dispatch(mediaSource)
                    console.log("Added");
                    return mediaSource
                  })
                  .catch(err => {
                    console.log(err);
                  })
                  //return _vo
              })
          })
      })
      .catch(err => {})
  }

  /*
  Override this to get a copy of the vo as it its passed
  */
  _onIndexAndBufferSuccess(vo) {}

  /*
  Know which videos we've requested
  */
  _addToRequested(vo) {
    if (this._requestedIds.indexOf(vo.videoId) < 0) {
      this._requestedIds.push(vo.videoId)
    }
  }

  /*
  Save the indexBuffer on redis only once
  */
  _saveIndexRange(vo) {
    if (this._requestedIds.indexOf(vo.videoId) < 0) {
      this._SocketService.saveIndexRangeRedis({
        uuid: _vo.uuid,
        value: _vo.indexBuffer
      })
    }
  }

  /*
  By default it will play through a video and go to the next
  */
  _chooseVoRefIndex(videoVo) {
    //passed the last ref
    if ((videoVo.refIndex + 1) > (videoVo.refLength - 1)) {
      this._chooseCurrentVideoIndex()
      let _uuid = this._getUUID(this._tempMediaSource, this.currentVideoId)
      videoVo = this._getCurrentVideoVo(_uuid)
    } else {
      videoVo.refIndex = (videoVo.refIndex + 1)
    }
    videoVo.watchedRefs.push(videoVo.refIndex)
  }

  /*Override this too*/
  _chooseCurrentVideoIndex() {
    this._setNextVideoId()
  }

  /*For the API*/
  _getSidxOptions(mediaSource, videoId, options) {
    return _.assign({}, {
      videoOnly: (mediaSource.type === 'video'),
      audioOnly: (mediaSource.type === 'audio'),
      uuid: this._getUUID(mediaSource, videoId)
    }, options)
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
          this.youtubeItemIds = this._filterYoutubeResultsById(this.youtubeItemIds, _videoId)
          return this._mediaSource.resetMediasource()
            .then(() => {
              return this._loadNextSegment()
            })
          break
      }
    }
    /*
    More items have come in
    Shuffle them and join them to the mix
    */
  _updateYoutubeResults(data) {
      let _ids = [];
      if (this._options.shufflePlaylist) {
        Utils.shuffle(data.items);
      }
      _.each(data.items, (item) => {
        _ids.push(Utils.getIdFromItem(item));
      });
      this.youtubeItems = [...this.youtubeItems, ...data.items];
      this.youtubeItemIds = [...this.youtubeItemIds, ..._ids];
    }
    /*
    Might be disused
    */
  _createReferenceIndexFromResults(results) {
    return results
    _.each(results, (item) => {
      this.playlistUtils.mix(item, this.playlistReferenceIndex, this._options);
    });
    return this.sidxIndexReferences;
  }

  /*
  The unique identifier to look up chached index range
  */
  _getUUID(mediaSource, videoId) {
    let _videoOnly = mediaSource.type === 'video'
    let _audioOnly = mediaSource.type === 'audio'
    return `${mediaSource.type}:${videoId}:${this.sidxResolution}`
  }

  /*
  Get an sidx from vId
  */
  _getSidx(vId, options = {}) {
      return this._SocketService
        .getSidx(_.assign({}, options, { id: vId }))
        .then(sidx => {
          return sidx
        })
        .catch(err=>{
          let {videoId} = err
          console.log(err);
          console.log(this.youtubeItemIds);
          this._removeVideoIdFromQueue(videoId)
          console.log(this.youtubeItemIds);
          return this.addVo().finally()
        })
    }
    /*
    Get all the video Ids from playlists
    */
  _getPlaylistVideoIds() {
    return new Q((resolve, reject) => {
      if (this.youtubeItemIds.length) {
        resolve(this.youtubeItemIds)
      } else {
        return Q.map(this._playlists, (id) => {
          return this._SocketService.playlistItems({
              playlistId: id,
              force:this._options.forcePlaylistUpdate
            })
            .then(results => {
              this._updateYoutubeResults(results);
              return resolve(this.youtubeItemIds)
            });
        }, {
          concurrency: 10
        }).finally()
      }
    });
  }

  /*Remove any that dont conform*/
  _filterYoutubeResultsById(source, id) {
    return source.filter(item => {
      return !(item === id)
    })
  }

  /*
  Store the info regarding an ID
  */
  _getPlayedVideoVo(uuid) {
    if (!this._playedVideoVos[uuid]) {
      this._playedVideoVos[uuid] = _.clone(VIDEO_VO)
    }
    return this._playedVideoVos[uuid]
  }

  _setRandomVideoIndex() {
    this.currentVideoIndex = Utils.getRandomNumberRange(this.youtubeItemIds.length - 1)
    return this.currentVideoIndex
  }

  /*
  DECIDE TO GO TO NEXT VIDEO OR NOT
  */
  _checkVideoPlaybackPostion(mediaSource) {
    let _uuid = this._getUUID(mediaSource, this.currentVideoId)
    let _videoVo = this._getCurrentVideoVo(_uuid)
      //only once
    if (this.mediaSources.indexOf(mediaSource) === 0) {
      if (_videoVo.refIndex + 1 >= _videoVo.refLength) {
        this._setNextVideoId()
      }
    }
  }

  _onVoAdded(mediaSource, videoVo) {
    console.log(videoVo.timelineTotal);
  }

  _adjustAfterNewVideo(videoVo, oldId, newId) {
    this.mediaSources.forEach(ms => {
      ms.currentTime = ms.totalDuration - videoVo.currentRefDuration
    })
  }

  _setNextVideoId() {
    let _c = this.currentVideoIndex
    _c++
    if (_c > this.youtubeItemIds.length - 1) {
      _c = 0
    }
    this.currentVideoIndex = _c
  }

  _getCurrentVideoVo(uuid) {
    return this._getPlayedVideoVo(uuid)
  }

  _setPreviousVideoId() {
    let _c = this.currentVideoIndex
    _c--
    if (_c < 0) {
      _c = this.youtubeItemIds.length - 1
    }
    this.currentVideoIndex = _c
  }

  _isMediaSourceMaster(ms) {
    return (this.mediaSources.indexOf(ms) === 0)
  }

  set currentVideoIndex(i) {
    this._currentVideoIndex = i
  }

  get currentVideoIndex() {
    return this._currentVideoIndex || 0
  }

  set currentVideoId(id) {
    this._currentVideoId = id
  }

  get currentVideoId() {
    return this.youtubeItemIds[this.currentVideoIndex]
  }

  get options() {
    return this._options
  }

  get sidxResolution() {
    return this._sidxQualityOptions.resolution
  }

  _getRandomVideoId() {
    return this.youtubeItemIds[Math.floor(Math.random() * this.youtubeItemIds.length - 1)]
  }

  _removeVideoIdFromQueue(id){
    let _i = this.youtubeItemIds.indexOf(id)
    if(_i > -1){
      this.youtubeItemIds.splice(_i, 1)
    }
  }

  //********************
  //API
  /*
  override methods in Base
  */
  //********************

  /*
  Requires youtubeVideoId
  */
  unshiftNewVideo(value){
    console.log(value);
    this.youtubeItemIds.unshift(value)
  }

}

export default VideoController;