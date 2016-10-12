import Q from 'bluebird';
import _ from 'lodash';

import {
  Utils,
  Constants,
  Cache
} from '../../utils'

const { ERROR_TYPES } = Constants;

/*
We only store videoIds
*/
class VideoControllerPlaylist {

  constructor(controller) {
    this.controller = controller
    this.youtubeItems = [];
    this.youtubeItemIds = [];
  }

  get current() {
    return this.youtubeItemIds[0]
  }

  getPlaylistVideoIds() {
    return new Q((resolve, reject) => {
      if (this.youtubeItemIds.length) {
        resolve(this.youtubeItemIds)
      } else {
        if(!this.playlists.length){
          let _err = new Error('No playlists')
          _err.name = ERROR_TYPES.NO_PLAYLISTS
          reject(_err)
        }
        return Q.map(this.playlists, (id) => {
          return this.socket.playlistItems({
              playlistId: id,
              force: this.options.forcePlaylistUpdate
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

  /*
    More items have come in
    Shuffle them and join them to the mix
    */
  _updateYoutubeResults(data) {
    let _ids = [];
    if (this.options.shufflePlaylist) {
      Utils.shuffle(data.items);
    }
    _.each(data.items, (item) => {
      _ids.push(Utils.getIdFromItem(item));
    });
    this.youtubeItems = [...this.youtubeItems, ...data.items];
    this.youtubeItemIds = [...this.youtubeItemIds, ..._ids];
  }

  get playlists() {
    return this.controller._playlists
  }

  get socket() {
    return this.controller._SocketService
  }

  get options() {
    return this.controller._options
  }

  get nextVideoId(){
    return this.youtubeItemIds[1]
  }

  next() {
    this.youtubeItemIds.shift()
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

}

export default VideoControllerPlaylist;