import sono from '@stinkdigital/sono';
import TweenLite from 'gsap';
import Proxxy from '../utils/proxy';
const FADE_DUR = 3

class AudioController {
    constructor(mediaSource, options) {
        this._mediaSource = mediaSource
        this._options = options
        this.mediaEl = mediaSource.el;
        this.context = sono.context;
        this.sound = sono.createSound(this.mediaEl);
        this._analyzer = this.sound.effect.analyser({ fftSize: this._options.fft })

        this._volume = this._options.volume.max || 1

        this._control = {
            volume: this._volume
        }

        this._beatCounter = this._options.offset || 0

        this._effects = {}
        this._options.effects = this._options.effects || []
        this._options.effects.forEach(effect => {
            let _e = sono.effect[effect.key](effect.value);
            this._effects[effect.key] = _e
            this._effects[effect.key].defaults = effect
        })

        let amplitudeBlob = new Blob(["onmessage=function(a){postMessage(1*(a.data[0]-a.data[1])/(a.data[2]-a.data[1])+0)};"]);
        let amplitudeBlobURL = URL.createObjectURL(amplitudeBlob);
        this._amplitudeWorker = new Worker(amplitudeBlobURL);
        this._amplitudeWorker.onmessage = (scaledAmp) => {
            this._ampCb(scaledAmp.data)
        };

        this._isFadedDown = false

        this._onAmplitudeBound = this._onAmplitude.bind(this)
    }

    beat(value) {
        if (this._beatCounter % this._options.playEveryBars === 0) {
            if (this._isFadedDown) {
                this.fadeUp()
            }
        }
        this._beatCounter++
    }

    get effects(){
        return this._effects
    }

    videoEnding() {
        this.fadeDown(this._options.volume.min)
    }

    fadeDown(volume = 0, options = {}) {
        TweenLite.to(this._control, FADE_DUR, {
            volume: volume,
            overwrite: 1,
            onUpdate: () => {
                this.mediaEl.volume = this._control.volume
            },
            onComplete: () => {
                this._isFadedDown = true
                if (options.pause) {
                    this._mediaSource.pause()
                }
            }
        })
    }

    fadeUp(volume = this._volume, options = {}) {
        if (this._mediaSource.isPaused) {
            this._mediaSource.play()
        }
        this._isFadedDown = false
        TweenLite.to(this._control, FADE_DUR, {
            volume: volume,
            overwrite: 1,
            onUpdate: () => {
                this.mediaEl.volume = this._control.volume
            }
        })
    }

    pause(fade = true) {
        let dur = fade ? FADE_DUR : 0
        TweenLite.to(this._control, dur, {
            volume: 0,
            overwrite: 1,
            onUpdate: () => {
                this.mediaEl.volume = this._control.volume
            },
            onComplete: () => {
                this._mediaSource.pause()
            }
        })
    }

    play(fade = true) {
        let dur = fade ? FADE_DUR : 0
        TweenLite.to(this._control, dur, {
            volume: this._volume,
            overwrite: 1,
            onUpdate: () => {
                this.mediaEl.volume = this._control.volume
            }
        })
        this._mediaSource.play()
    }


    getContext() {
        return this.sound.context;
    }

    getAmplitude(cb) {
        this._ampCb = cb
        this._analyzer.getAmplitude(this._onAmplitudeBound)
    }

    _onAmplitude(amp) {
        this._amplitudeWorker.postMessage([amp,
            this._options.ampScale.min,
            this._options.ampScale.max
        ]);
    }
}

export default AudioController;