import VideoBase from './vj-video-ext-base'

import {
  Emitter,
} from '../../../utils'

export default class VideoLoop extends VideoBase {
  constructor(mediaSource, options) {
    super(mediaSource, options)
    this._startBound = this._start.bind(this)
    this._loopBound = this._loop.bind(this)
    this._timeUpdateBound = this._timeUpdate.bind(this)
    this._mediaSouce = mediaSource

    this._mediaSouce.timeUpdateSignal.add(this._timeUpdateBound)
    Emitter.on(`${options.id}:controller:ext:loop`, this._loopBound)

    this._isSettingStartTime = true
  }

  set startTime(v) {
    this._startTime = v
  }

  set endTime(v) {
    this._endTime = v
  }

  set currentTime(v) {
    this._currentTime = v
  }

  get startTime() {
    return this._startTime
  }

  get endTime() {
    return this._endTime
  }

  get currentTime() {
    return this._currentTime || 0
  }

  _loop(){
    if(this._isSettingStartTime){
      this.endTime = null
      this.startTime = this.currentTime
    }else{
      this.endTime = this.currentTime
      this._mediaSouce.currentTime = this.startTime
    }
    this._isSettingStartTime = !this._isSettingStartTime
  }

  _start(){

  }

  _timeUpdate(currentTime){
    this._currentTime = currentTime
    if(this.endTime){
      if(this._currentTime > this._endTime){
        this._mediaSouce.currentTime = this.startTime
      }
    }
  }

  destroy(){
    super.destroy()
  }
}
