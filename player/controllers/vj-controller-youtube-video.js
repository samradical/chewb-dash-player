import Q from 'bluebird';
import _ from 'lodash';


import ControllerBase from './vj-controller-base';
import VideoVoUtils from './vj-controller-youtube-videovo-utils';
import YoutubeVideoSocket from './vj-controller-youtube-video-socket';

import {
  Utils,
  Constants,
  Cache
} from '../../utils'

const { ERROR_TYPES } = Constants;

let TIMELINE_VO = {}

const VERBOSE = true

import VjUtils from '../vj-utils';

class VideoController extends ControllerBase {

  constructor(options) {
    super(options)
      //this.mediaSource = mediaSource
    this._options = options
    this._playlists = this._options.playlists

    this.youtubeItems = [];
    this.youtubeItemIds = [];

    this._videoVoUtils = new VideoVoUtils(this)
    this._videoSocket = new YoutubeVideoSocket(this)

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

    let _uuid = this._getUUID(mediaSource.type, this.currentVideoId)
    let _videoVo = this._videoVoUtils.getCurrentVideoVo(_uuid)
    console.log('_getMediaSourceVo');
    console.log(_videoVo.preloadPromise);

    if (_videoVo.preloadPromise) {
      if (!_videoVo.preloadPromise.isFulfilled()) {
        return _videoVo.preloadPromise
          .then(mediaSourceVo => {
            delete _videoVo.preloadPromise
            return this._doRangeRequestAndAdd(mediaSource, mediaSourceVo, _videoVo)
          })
      }
      let manifest = Cache.getSidxManifest(_videoVo.uuid)
      let _mediaSourceVo = this._createMediaSourceVo(manifest, _videoVo, this._options)
      return this._doRangeRequestAndAdd(mediaSource, _mediaSourceVo, _videoVo)
    } else {

      return this._getSidxManifest(
          mediaSource,
          this.currentVideoId,
          _uuid
        ).then(manifest => {
          this._onManifestReceived(mediaSource, _videoVo, manifest)

          //preload
          if (this._videoVoUtils.isAtLastRef(_videoVo)) {
            this._videoSocket.preload(mediaSource, this._getNextVideoId())
          }
          //we make a new object
          let _mediaSourceVo = this._createMediaSourceVo(manifest, _videoVo, this._options)

          return this._getIndexBuffer(
            _videoVo.uuid,
            _mediaSourceVo.url,
            _mediaSourceVo.indexRange
          ).then(buffer => {
            _mediaSourceVo.indexBuffer = buffer
            if (VERBOSE) console.log("Got index buffer");
            return this._doRangeRequestAndAdd(mediaSource, _mediaSourceVo, _videoVo)
          })
        })
        .catch(err => {
          //do something before
          console.warn(err);
          return this.addVo().finally()
        })
    }
  }

  _getSidxManifest(mediaSource, videoId, uuid) {
    return this._videoSocket.getManifest(mediaSource, videoId, uuid)
  }

  _getIndexBuffer(uuid, url, range, options) {
    return this._videoSocket.getIndexBuffer(uuid, url, range, options)
  }

  _getRangeBuffer(uuid, url, range, options) {
    return this._videoSocket.getRangeBuffer(uuid, url, range, options)
  }

  _doRangeRequest(mediaSource, mediaSourceVo, videoVo) {
    return this._getRangeBuffer(
      videoVo.uuid,
      mediaSourceVo.url,
      mediaSourceVo.byteRange
    ).then(buffer => {
      mediaSourceVo.videoBuffer = buffer
      if (VERBOSE) console.log("Got video buffer");

      /*var buf = new ArrayBuffer(mediaSourceVo.indexBuffer.length)
      var bufView = new Uint8Array(buf);
      bufView.set(mediaSourceVo.indexBuffer)

      let i = Math.floor(Math.random() * 4)
      this._SocketService.addVideo({
        indexBuffer: buf,
        rangeBuffer: mediaSourceVo.videoBuffer,
        saveName: mediaSourceVo.videoId,
        duration:mediaSourceVo.duration,
        saveGroup: (i === 0)
      })*/

      //override this method
      this._onIndexAndBufferSuccess(mediaSourceVo)

      //this is important
      this._videoVoUtils.addRefToWatchedVideoVo(videoVo)

      return mediaSourceVo

      /*this._saveIndexRange(mediaSourceVo)*/
      /*this._addToRequested(mediaSourceVo)*/
    })
  }

  _addVo(mediaSource, mediaSourceVo) {
    return mediaSource.addVo(mediaSourceVo)
      .then(mediaSource => {
        this.voAddedSignal.dispatch(mediaSource)
        console.log("Added");
        mediaSourceVo = null
        return mediaSource
      })
      .catch(err => {
        console.log(err);
      })
  }

  _doRangeRequestAndAdd(mediaSource, mediaSourceVo, videoVo) {
    return this._doRangeRequest(mediaSource, mediaSourceVo, videoVo)
      .then(mediaSourceVo => {
        return this._addVo(mediaSource, mediaSourceVo)
      })
  }

  _onManifestReceived(mediaSource, videoVo, manifest) {
    let _references = manifest.sidx.references
    this._videoVoUtils.setReferenceLength(videoVo, _references.length)

    //we override this in extensions
    this._chooseVoRefIndex(videoVo, mediaSource)
  }

  _createMediaSourceVo(manifest, videoVo, options) {
    return this._videoVoUtils.getMediaSourceVo(
      manifest,
      videoVo,
      options
    )
  }

  /*
  Override this to get a copy of the vo as it its passed
  */
  _onIndexAndBufferSuccess(vo) {}

  //!!!!!!!!!!!!!!!!!!!!
  //UNUSED
  //!!!!!!!!!!!!!!!!!!!!
  /*
  Know which videos we've requested
  */
  _addToRequested(vo) {
    if (this._requestedIds.indexOf(vo.videoId) < 0) {
      this._requestedIds.push(vo.videoId)
    }
  }

  /*
  Save the indexBuffer on redis only once,
  UNUSED
  */
  _saveIndexRange(vo) {
    if (this._requestedIds.indexOf(vo.videoId) < 0) {
      this._SocketService.saveIndexRangeRedis({
        uuid: _vo.uuid,
        value: _vo.indexBuffer
      })
    }
  }

  //****************
  //OVERRIDES
  //****************

  /*
  By default it will play through a video and go to the next
  */
  _chooseVoRefIndex(videoVo, mediaSource) {
    //passed the last ref, so choose next video
    //basic 
    this._videoVoUtils.incrementRefIndex(videoVo, 1, (videoVo) => {
      this._chooseCurrentVideoIndex(videoVo)
    })
  }

  /*Override this too*/
  _chooseCurrentVideoIndex(videoVo) {
    //increase the youtube
    this._setNextVideoId()
      //so it starts the next
    throw new Error('Ran out of videos')
  }

  _onVideoPlayingSignal(mediaSource) {

  }

  //**************
  //fetching data
  //**************

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
  _getUUID(type, videoId) {
    return this._videoSocket.getUUID(type, videoId)
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
              force: this._options.forcePlaylistUpdate
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

  _setRandomVideoIndex() {
    this.currentVideoIndex = Utils.getRandomNumberRange(this.youtubeItemIds.length - 1)
    return this.currentVideoIndex
  }

  /*
  DECIDE TO GO TO NEXT VIDEO OR NOT
  */

  //!!!!!!!!!!!!!!
  //UNUSED
  //!!!!!!!!!!!!!!
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

  /*_adjustAfterNewVideo(videoVo, oldId, newId) {
    this.mediaSources.forEach(ms => {
      ms.currentTime = ms.totalDuration - videoVo.currentRefDuration
    })
  }*/

  _setNextVideoId() {
    let _c = this.currentVideoIndex
    _c++
    if (_c > this.youtubeItemIds.length - 1) {
      _c = 0
    }
    this.currentVideoIndex = _c
  }

  _getNextVideoId() {
    let _c = this.currentVideoIndex
    _c++
    if (_c > this.youtubeItemIds.length - 1) {
      _c = 0
    }
    return this.youtubeItemIds[_c]
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

  _getRandomVideoId() {
    return this.youtubeItemIds[Math.floor(Math.random() * this.youtubeItemIds.length - 1)]
  }

  _removeVideoIdFromQueue(id) {
    let _i = this.youtubeItemIds.indexOf(id)
    if (_i > -1) {
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
  unshiftNewVideo(value) {
    console.log(value);
    this.youtubeItemIds.unshift(value)
  }

}

export default VideoController;