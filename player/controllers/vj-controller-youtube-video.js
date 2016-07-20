import Q from 'bluebird';
import _ from 'lodash';

import ControllerBase from './vj-controller-base';

import {
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
    this._playlists = this._options.playlists

    this.youtubeItems = [];
    this.youtubeItemIds = [];

    this._barCounter = 0

    if (!options.paused) {
      this.addVo()
    }

    this._playedVideoVos = {
      //videoId...{}
    }

    /*if (!options.isSlave) {
      Emitter.on('metronome:bar', () => {
        if (this._barCounter % this._options.playNewEveryBars === 0) {
          this._setRandomVideoIndex()
        }
        this._barCounter++
      })
    }*/
  }

  addVo() {
      this._loadNextSegment().finally()
    }
    /*
    Add from a phrase to MS
    */
  addVoFromPhrase(phrases) {
    if (phrases.length) {
      Q.map(phrases, (phrase) => {
          let _videoId = phrase.vo.videoId
          return this._getSidx(_videoId)
            .then(sidx => {
              let _startIndex = phrase.refIndexs[0]
              let _endIndex = phrase.refIndexs[phrase.refIndexs.length - 1]
              return VjUtils.combineRefs(
                sidx,
                _startIndex,
                _endIndex, {
                  videoId: _videoId,
                  //seekValue: phrase.seekValue
                }
              )
            })
        }, { concurrency: 1 })
        .then(vos => {
          vos.forEach(vo => {
            return this._mediaSource.addVo(vo)
          })
        })
        .finally()
    }
  }

  _onEndingSignal() {
    this._loadNextSegment().finally()
  }

  _loadNextSegment(sub = {}) {
    return this._getPlaylistVideoIds()
      .then(playlistVideoIds => {
        return this._getSidx(this.currentVideoId)
          .then(data => {
            let _videoVo = this.currentVideoVo
            let _references = data.sidx.references
            _videoVo.refLength = _references.length
            let _ref = _references[_videoVo.refIndex]
            let _vo = VjUtils.voFromRef(data, _ref);
            _videoVo.refIndex = (_videoVo.refIndex + 1) > (_references.length - 1) ? 0 : (_videoVo.refIndex + 1)
            return this._mediaSource.addVo(_vo)
          })
          .catch(err => {
            //this._handleVoError(err)
          })
      })
      .catch(err=>{

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
  _getSidxAndAdd(vId) {
    return this._getSidx(vId)
      .then((sidx) => {
        return this._createReferenceIndexFromResults([sidx]);
      });
  }

  _createReferenceIndexFromResults(results) {
    return results
    _.each(results, (item) => {
      this.playlistUtils.mix(item, this.playlistReferenceIndex, this._options);
    });
    return this.sidxIndexReferences;
  }

  /*
  Get an sidx from vId
  */
  _getSidx(vId, quality) {
      quality = quality || this._options.quality
      return this._ServerService.getSidx(vId, quality)
        .then((sidx) => {
          this._currentSidx = sidx
          return this._currentSidx
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
          return this._ServerService.playlistItems({
              playlistId: id
            })
            .then(results => {
              this._updateYoutubeResults(results);
              resolve(this.youtubeItemIds)
            });
        }, {
          concurrency: 3
        })
      }
    });
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
    this.currentVideoIndex = Utils.getRandomNumberRange(this.youtubeItemIds.length - 1)
    return this.currentVideoIndex
  }

  _setNextVideoId() {
    let _c = this.currentVideoIndex
    _c++
    if (_c > this.youtubeItemIds.length - 1) {
      _c = 0
    }
    this.currentVideoIndex = _c
  }

  _setPreviousVideoId() {
    let _c = this.currentVideoIndex
    _c--
    if (_c < 0) {
      _c = this.youtubeItemIds.length - 1
    }
    this.currentVideoIndex = _c
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

  get currentVideoVo(){
    return this._getPlayedVideoVo(this.currentVideoId)
  }

  get options() {
    return this._options
  }

  _getRandomVideoId() {
    return this.youtubeItemIds[Math.floor(Math.random() * this.youtubeItemIds.length - 1)]
  }
}

export default VideoController;
