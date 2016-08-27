import Q from 'bluebird';
import _ from 'lodash';


import ControllerBase from './vj-controller-youtube-base';

import {
  Utils,
  Emitter,
  Constants
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

import VjUtils from '../vj-utils';

class VideoController extends ControllerBase {

  constructor(options) {
    super(options)
      //this.mediaSource = mediaSource
    this._options = options
    this._playlists = this._options.playlists

    this.youtubeItems = [];
    this.youtubeItemIds = [];

    this._barCounter = 0

  }

  init() {
    this._getPlaylistVideoIds()
      .then(() => {
        this._readyCheck.playlistsLoaded = true
        this._tryStart()
      })
      .finally()
  }

  _getMediaSourceVo(mediaSource) {

    let _uuid = this._getUUID(mediaSource, this.currentVideoId)
    return this._getSidx(
        this.currentVideoId,
        this._getSidxOptions(
          mediaSource,
          this.currentVideoId
        )
      )
      .then(data => {
        let _videoVo = this._getCurrentVideoVo(_uuid)
        let _references = data.sidx.references
        let _ref = _references[_videoVo.refIndex]
        _videoVo.refLength = _references.length
          //_videoVo.refIndex = (_videoVo.refIndex + 1) > (_references.length - 1) ? 0 : (_videoVo.refIndex + 1)
        this._chooseVoRefIndex(_videoVo)
        console.log(_videoVo);
        let _vo = VjUtils.combineRefsIndexs(
          data,
          _videoVo.refIndex[0],
          _videoVo.refIndex[1],
          this._options);

        return this._SocketService
          .getVideoRange({
            uuid: _uuid,
            url: _vo.url,
            range: _vo.indexRange,
            youtubeDl: _vo.youtubeDl
          })
          .then(buffer => {
            _vo.indexBuffer = buffer
            return this._SocketService
              .getVideoRange({
                uuid: _uuid,
                url: _vo.url,
                range: _vo.byteRange,
                youtubeDl: _vo.youtubeDl
              })
              .then(buffer => {
                _vo.videoBuffer = buffer
                return _vo
              })
          })
      })
      .catch(err => {})
  }

  _getSidxOptions(mediaSource, videoId) {
    return {
      videoOnly: (mediaSource.type === 'video'),
      audioOnly: (mediaSource.type === 'audio'),
      uuid: this._getUUID(mediaSource, videoId)
    }
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
          this.youtubeItemIds = this._filterById(this.youtubeItemIds, _videoId)
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

  _getUUID(mediaSource, videoId) {
    let _videoOnly = mediaSource.type === 'video'
    let _audioOnly = mediaSource.type === 'audio'
    return `${mediaSource.type}:${videoId}`
  }

  /*
  Get an sidx from vId
  */
  _getSidx(vId, options = {}) {
      console.log(options);
      return this._SocketService
        .getSidx(_.assign({}, options, { id: vId }))
        .then(sidx => {
          return sidx
        })
    }
    /*
    Get all the video Ids from playlists
    */
  _getPlaylistVideoIds() {
    return new Q((resolve, reject) => {
      console.log(this.youtubeItemIds.length);
      if (this.youtubeItemIds.length) {
        resolve(this.youtubeItemIds)
      } else {
        return Q.map(this._playlists, (id) => {
          return this._ServerService.playlistItems({
              playlistId: id
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

  _filterById(source, id) {
    return source.filter(item => {
      return !(item === id)
    })
  }

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

  _getRandomVideoId() {
    return this.youtubeItemIds[Math.floor(Math.random() * this.youtubeItemIds.length - 1)]
  }
}

export default VideoController;
