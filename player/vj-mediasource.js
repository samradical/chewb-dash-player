import {
  Constants,
  Emitter,
} from '../utils'

import Loader from './vj-mediasource-loader';
import Signals from 'signals';
import Q from 'bluebird';
const { ERROR_TYPES } = Constants;

let VERBOSE = true;
const BUFFER_MARGIN = 3;
const BUFFER_MARGIN_2 = 0.7


class VjMediaSource {
  constructor(options = {}) {
    let _type = options.quality.audioOnly ? 'audio' : 'video'
    let el = document.createElement(_type);
    Object.keys(options.elAttributes).forEach(key => {
      el.setAttribute(key, options.elAttributes[key]);
    })
    el.setAttribute('crossOrigin', 'anonymous');
    el.setAttribute('crossorigin', 'anonymous');
    el.setAttribute('controls', 'true');
    if (!options.paused) {
      el.setAttribute('autoplay', 'true');
    }
    this.options = options;
    this.el = el;
    if (!MediaSource) {
      throw new Error('NO MEDIASOURCE!');
    }
    //booleans
    this.updatedStarted, this.locked, this.starting = true;

    //playback info
    this.segDuration = 0,
      this.totalDuration = 0,
      this.newVoStarted = false,
      this.requestingNewVo = false,
      this.playOffset = 0,
      this.segmentIndex = 0,
      this.totalSegments = 0,
      this.paused = false,
      this.ended = false,
      this.currentCodec = "",
      this.skipCount = 0;
    ////-----------------
    //SETUP
    ////-----------------
    this._currentVo;
    this.mediaSource;
    this.sourceBuffer;
    this._effects;
    this.currentVideoId;

    this.readySignal = this.options.readySignal
    this.videoPlayingSignal = this.options.videoPlayingSignal
    this.videoStartedSignal = this.options.videoStartedSignal
    this.segmentAddedSignal = this.options.segmentAddedSignal
    this.timeUpdateSignal = this.options.timeUpdateSignal
    this.endingSignal = this.options.endingSignal
    this.endedSignal = this.options.endedSignal

    this.videoElement = el;

    this.onBufferUpdateStartBound = this.onBufferUpdateStart.bind(this);
    this.onBufferUpdateEndBound = this.onBufferUpdateEnd.bind(this);
    //this.onInitAddedBound = this._onInitAdded.bind(this);
    this.onTimeUpdateBound = this._onTimeUpdate.bind(this);
    this.onBufferSourceRemovedBound = this._onBufferSourceRemoved.bind(this);
    this.onSourceOpenBound = this._onSourceOpen.bind(this);
    this.onSourceErrorBound = this._onSourceError.bind(this);

    this.videoElement.addEventListener("timeupdate", this.onTimeUpdateBound, false);
    this.videoElement.addEventListener("ended", this._onVideoEnded, false);
    this.videoElement.addEventListener("loadeddata", () => {
      if (VERBOSE) {
        console.log("Loaded data");
      }
    });

    this.videoElement.addEventListener("playing", () => {
      if (VERBOSE) {
        console.log("Playing");
      }
      this._waiting = false
      this.videoPlayingSignal.dispatch()
    });

    this.videoElement.addEventListener("waiting", () => {
      if (VERBOSE) {
        console.log("Waiting");
      }
      this._waiting = true
    });
    this.videoElement.addEventListener("pause", () => {
      if (VERBOSE) {
        console.log("Pause");
      }
      this._waiting = true
    });

    this.videoElement.addEventListener("loadstart", () => {
      if (VERBOSE) {
        console.log("loadstart");
      }
      this._waiting = false
        //this.videoPlayingSignal.dispatch()
    });

    this._newMediaSource();
    this.waitingLine = [];
  }

  _newMediaSource() {
    this.starting = true;
    this.mediaSource = new MediaSource();
    let url = URL.createObjectURL(this.mediaSource);
    this.videoElement.src = url;
    this.mediaSource.addEventListener('error', this.onSourceErrorBound, false);
    this.mediaSource.addEventListener('sourceopen', this.onSourceOpenBound, false);
  }

  _onSourceError(e) {}

  _onSourceOpen(e) {
    this.starting = false;
    this.readySignal.dispatch(this);
    Emitter.emit('mediasource:ready', this)
    if (this.waitingLine.length) {
      //this.addVo(this.waitingLine.pop());
    }
  }

  newBufferSouce(codecs) {
    return new Q((resolve, reject) => {
      this._removeSourceBuffer()
        .then(() => {
          setTimeout(() => {
            console.log(this.mediaSource.sourceBuffers);
            this.mediaSource.removeEventListener('sourceopen', this.onSourceOpenBound);
            this.currentCodec = codecs || this.currentCodec;
            this.mediaSource.addEventListener('addsourcebuffer', () => {
              console.log("Mediasource");
            })
            this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4; codecs="' + codecs + '"');
            this.sourceBuffer.addEventListener('updatestart', this.onBufferUpdateStartBound);
            this.sourceBuffer.addEventListener('updateend', this.onBufferUpdateEndBound);

            resolve()
          }, 2000)
        })
    })
  }

  ////-----------------
  //VIDEO HANDLERS
  ////-----------------

  pause() {
    this.videoElement.pause();
  }

  play() {
    this.videoElement.play();
  }

  _onVideoEnded(e) {
    if (VERBOSE) {
      console.warn('Video Ended');
    }
  }

  _onTimeUpdate() {
    let ct = this.videoElement.currentTime;
    if (ct > this.currentVo.startTime && !this.newVoStarted) {
      this.newVoStarted = true;
      this.videoStartedSignal.dispatch(this.currentVo);
      Emitter.emit('mediasource:videostarting', this)
    }
    //console.log(ct, this.totalDuration);
    if (ct >= (this.totalDuration - BUFFER_MARGIN)) {
      if (!this.requestingNewVo) {
        this.requestingNewVo = true;
        if (VERBOSE) {
          console.log(this.currentVo.videoId, "Requesting new vo");
        }
        this.endingSignal.dispatch(this);
        Emitter.emit('mediasource:ending', this)
      }
    }
    if (ct >= this.totalDuration - 0.1) {
      if (!this.ended) {
        this.ended = true;
        this.endedSignal.dispatch(this);
        Emitter.emit('mediasource:ended', this)
      }
    }
    this.timeUpdateSignal.dispatch(ct)
  }

  get el() {
    return this.videoElement
  }

  set el(e) {
    this.videoElement = e
  }

  get isPaused() {
    return !this.videoElement.playing
  }

  set currentTime(t) {
    this.videoElement.currentTime = t
  }

  get waiting() {
    return this._waiting
  }

  ////-----------------
  //API
  ////-----------------

  stepBack(amount = 0) {
    let _target = this.videoElement.currentTime - amount
    this.videoElement.currentTime = _target
    console.log("back", _target);
  }

  stepForward(amount = 0) {
    let _target = this.videoElement.currentTime + amount
    if (_target > this.totalDuration) {
      _target = this.totalDuration - BUFFER_MARGIN
    }
    console.log("forward", _target);
    this.videoElement.currentTime = _target
  }

  setPlaybackRate(rate) {
    this.videoElement.playbackRate = rate;
  }

  getReadyState() {
    return this.mediaSource.readyState;
  }

  setCurrentVideoId(id) {
    this.currentVideoId = id;
  }

  getCurrentVideoId(id) {
    return this.currentVideoId;
  }

  addVo(currentVo) {
    return new Q((resolve, reject) => {
      if (this._addingSegment) {
        return reject(new Error(`Vo being added`))
      }
      this._addingSegment = true

      if (VERBOSE) {
        console.log("CurrentCodec: ", this.currentCodec, "new codec:", currentVo.codecs);
      }

      this._currentVo = currentVo

      if (!this.currentCodec) {
        Emitter.emit('audio:warn', `The codecs arnt equal`);
        this.newBufferSouce(currentVo.codecs).then(() => {
          resolve(this._readyToAdd(currentVo))
        });
      } else {
        if (this.sourceBuffer) {
          if (VERBOSE) {
            Emitter.emit('audio:log', `Sourcebuffer updating: ${this.sourceBuffer.updating}`);
            Emitter.emit('audio:log', `Sourcebuffer mode: ${this.sourceBuffer.mode}`);
          }
          resolve(this._readyToAdd(currentVo));
        } else {
          Emitter.emit('audio:warn', `The codecs arnt equal`);
          //return this._readyToAdd(currentVo);
        }
      }
    })
  }

  _readyToAdd(currentVo) {
    this.setCurrentVideoId(currentVo.id);
    this.mediaSource.duration = this.totalDuration;
    return this._addSegment(currentVo);
  }

  _onBufferSourceRemoved() {

    }
    ////-----------------
    //BUFFER HANDLERS
    ////-----------------


  onBufferUpdateStart() {
    this.updatedStarted = true;
    this.requestingNewVo = false;
    this.ended = false;
  }

  onBufferUpdateEnd() {
    this.updatedStarted = false;
    if (VERBOSE) {
      Emitter.emit('audio:log', `Sourcebuffer updated. Is updating: ${this.sourceBuffer.updating}`);
    }
  }

  _addSegment(currentVo) {
    this.newVoStarted = false;
    this.currentVo = currentVo;
    this.currentVo.startTime = this.totalDuration;
    this.totalDuration += this.currentVo.duration;

    let off = 0,
      videoId = this.currentVo.videoId;
    if (this.sourceBuffer.buffered.length > 0) {
      off = this.sourceBuffer.buffered.end(this.sourceBuffer.buffered.length - 1);
    }

    return this._trySettingOffset(this.currentVo, off)
      .then(() => {
        return Loader.indexRange(this.currentVo)
          .then(initResp => {
            return this._addInitReponse(this.currentVo, initResp)
              .then(() => {
                off = this.sourceBuffer.timestampOffset - this.currentVo['timestampOffset'];
                return this._trySettingOffset(this.currentVo, off)
                  .then(() => {
                    return Loader.range(this.currentVo)
                      .then((rangeData) => {
                        return this._addResponse(this.currentVo, rangeData)
                          .then(() => {
                            this._addingSegment = false
                            return {
                              totalDuration: this.totalDuration,
                              duration: this.currentVo.duration
                            }
                          })
                      })
                  })
              })
          })
      })
  }

  _trySettingOffset(vo, off) {
    return new Q((resolve, reject) => {
      let _i, _self = this

      function _poll() {
        if (!_self.sourceBuffer.updating) {
          clearInterval(_i)
          Emitter.emit('audio:log', `Sourcebuffer mode: ${_self.sourceBuffer.mode}`);
          try {
            _self.sourceBuffer.timestampOffset = off || 0;
            if (VERBOSE) {
              console.log(`timestampOffset is: ${off}`);
            }
            resolve()
          } catch (e) {
            if (VERBOSE) {
              console.log(`Error _trySettingOffset of: ${off}... ${e.toString()}`);
            }
            resolve()
              //reject(new Error(`${ERROR_TYPES.FATAL}:${vo.videoId}`))
          }
        } else {
          if (VERBOSE) {
            console.log(`source buffer updating...`);
          }
        }
      }
      _i = this._getInterval(_poll)
    })
  }

  _addInitReponse(vo, initResp) {
    return new Q((resolve, reject) => {
      let _self = this

      function _onInitAdded() {
        _self.sourceBuffer.removeEventListener('updateend', _onInitAdded);
        if (VERBOSE) {
          console.log("Init response added: ", vo.videoId || vo.id);
        }
        resolve()
      }

      function _tryAppend(){
        try {
          _self.sourceBuffer.appendBuffer(initResp);
        } catch (e) {
          //_self.newBufferSouce().then(_tryAppend).finally()
          console.log(vo);
          reject(new Error(`${ERROR_TYPES.RECOVER}:${vo.videoId || vo.id}`))
        }
      }

      if (this._canUpdate() && this.sourceBuffer) {
        this.sourceBuffer.removeEventListener('updatestart', this.onBufferUpdateStartBound);
        this.sourceBuffer.removeEventListener('updateend', this.onBufferUpdateEndBound);
        this.sourceBuffer.addEventListener('updateend', _onInitAdded);
        _tryAppend()
      } else {
        console.log(`Cannot update init!`);
      }
    })
  }

  _addResponse(vo, resp) {
    return new Q((resolve, reject) => {
      let _self = this

      if (VERBOSE) {
        console.log(`Got video response. Soundbuffer updating: ${this.sourceBuffer.updating}`);
      }

      function _onResponseAdded() {
        _self.sourceBuffer.removeEventListener('updateend', _onResponseAdded);
        _self.onBufferUpdateEndBound()
        resolve()
      }


      if (this._canUpdate() && this.sourceBuffer) {
        this.sourceBuffer.addEventListener('updateend', _onResponseAdded);
        //this.sourceBuffer.addEventListener('updateend', this.onBufferUpdateEndBound);
        this.sourceBuffer.addEventListener('updatestart', this.onBufferUpdateStartBound);
        try {
          this.sourceBuffer.appendBuffer(resp);
          if (vo.seekValue) {
            let _t = this.videoElement.currentTime + vo.seekValue
            this.videoElement.currentTime = _t
          }
          if (VERBOSE) {
            console.log("Added segment: ", vo.id, "Total duration:", this.totalDuration);
          }
          this.segmentAddedSignal.dispatch()
        } catch (e) {
          if (VERBOSE) {
            /*
        DOMException: Failed to execute 'appendBuffer' on 'SourceBuffer': The HTMLMediaElement.error attribute is not null.(…)
            */
            console.log(e.name);
            console.log(e);
          }
          //reject(new Error(`${ERROR_TYPES.RECOVER}:${vo.videoId}`))
        }
      } else {
        console.log(`Cannot update video!`);
      }
    })
  }

  _getInterval(func, dur = 100) {
    return setInterval(func, 100)
  }

  //crash

  _canUpdate() {
    return this.mediaSource.readyState === 'open' && !this.sourceBuffer.updating;
  }

  _removeSourceBuffer() {
    return new Q((resolve, reject) => {
      if (this.sourceBuffer) {
        this.sourceBuffer.removeEventListener('updateend', this.onBufferUpdateEndBound);
        this.sourceBuffer.removeEventListener('updatestart', this.onBufferUpdateStartBound);
        try {
          this.sourceBuffer.remove(0, this.mediaSource.duration);
        } catch (e) {

        }
        this.mediaSource.removeSourceBuffer(this.mediaSource.sourceBuffers[0]);
        this.sourceBuffer = null
        if (VERBOSE) {
          console.log(`_removeSourceBuffer success`);
        }
        resolve()
      } else {
        resolve()
      }
    })
  }

  resetMediasource() {
    if (this.starting || !this.mediaSource) {
      return;
    }
    if (VERBOSE) {
      console.warn('Reset buffer source');
    }
    return this._removeSourceBuffer()
      .then(() => {
        this.mediaSource.removeEventListener('error', this.onSourceErrorBound);
        this.mediaSource.removeEventListener('sourceopen', this.onSourceOpenBound);
        this.mediaSource = null;
        this.sourceBuffer = null;
        this.requestingNewVo = false;
        this.enterFrameCounter = 0;
        this.videoElement.currentTime = 0;
        this.totalDuration = this.segDuration = this.playOffset = 0;
        //this.waitingLine.push(this.currentVo)
        return this._newMediaSource()
      });
  }
}

export default VjMediaSource;
