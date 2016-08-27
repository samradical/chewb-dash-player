import VideoBase from './vj-video-ext-base'

import {
  Emitter,
} from '../../../utils'


const MAX_REFS_IN_CLIP = 3
export default class VideoShuffle extends VideoBase {
  constructor(controller, options) {
    super(controller, options)
    this._controller = controller
    this._controller._chooseVoRefIndex = this._chooseVoRefIndex.bind(this)
  }

  _chooseVoRefIndex(videoVo) {
    videoVo.refIndex = null
    while (!videoVo.refIndex) {
      let _r = Math.floor(Math.random() * videoVo.refLength)
      //add some more
      let _add = Math.floor(Math.random() * MAX_REFS_IN_CLIP)
      console.log(_add);
      if (videoVo.watchedRefs.indexOf(_r) < 0) {
        //cliup
        let _max = Math.min(_r + _add, videoVo.refLength - 1)
        videoVo.refIndex = [_r, _max]
      }
    }
    //for next time
   this._chooseCurrentVideoIndex()
  }

  _chooseCurrentVideoIndex() {
    let _r = Math.floor(Math.random() * this.youtubeItemIds.length)
    console.log("---");
    console.log(_r);
    console.log("---");
    this._controller.currentVideoIndex = _r
  }

  get youtubeItemIds() {
    return this._controller.youtubeItemIds || []
  }
}
