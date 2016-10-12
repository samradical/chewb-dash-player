import Q from 'bluebird';
import _ from 'lodash';

import {
  Utils,
  Constants,
  Cache
} from '../../utils'

const { ERROR_TYPES, CONTROLLER_STATUS} = Constants;


class VideoControllerApi {

  constructor(controller) {
    this._controller = controller
  }

  get youtubeItemIds(){
    return this.controller.videoPlaylist.youtubeItemIds
  }

  get controller(){
    return this._controller
  }

  /*
  {
    rush
  }
  */
  unshiftNewVideo(value, options) {
    let _nextId = this.controller.videoPlaylist.nextVideoId
    this.controller.videoSocket.cancelPreload(_nextId)
    this.controller.videoPlaylist.next()
    this.youtubeItemIds.unshift(value)
    console.log(this.controller.status);
    if(this.controller.status === CONTROLLER_STATUS.IDLE){
      this.controller.addVo().finally()
    }
    console.log(value);
  }


}

export default VideoControllerApi;