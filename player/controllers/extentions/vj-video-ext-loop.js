import ExtensionBase from './vj-video-ext-base'

export default class ExtensionLoop extends ExtensionBase {
  constructor(controller, options) {
    super(controller, options)
    let {emitter} = options
    this._startBound = this._start.bind(this)
    this._loopBound = this._loop.bind(this)
    this._onTimeupdateSignalBound = this._onTimeupdateSignal.bind(this)
    this._onEndedSignalBound = this._onEndedSignal.bind(this)

    emitter.on(`${options.id}:controller:ext:loop`, this._loopBound)

    this._isSettingStartTime = true
  }

  addMediaSource(ms) {
    ms.endedSignal.add(this._onEndedSignalBound)
    ms.timeUpdateSignal.add(this._onTimeupdateSignalBound)
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

  _loop() {
    if (this._isSettingStartTime) {
      this.endTime = null
      this.startTime = this.currentTime
    } else {
      this.endTime = this.currentTime
      this._mediaSouce.currentTime = this.startTime
    }
    this._isSettingStartTime = !this._isSettingStartTime
  }

  _start() {

  }

  _onTimeupdateSignal(mediaSource) {
/*    this._currentTime = currentTime
    if (this.endTime) {
      if (this._currentTime > this._endTime) {
        this._mediaSouce.currentTime = this.startTime
      }
    }*/
  }

  _onEndedSignal(mediaSource) {
    let {currentTime, totalDuration, duration} = mediaSource
    //mediaSource.currentTime = mediaSource.currentVo.startTime
  }

  destroy() {
    super.destroy()
  }
}