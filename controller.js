/*
"PLqi-HJej8buf-iyECUqIEiMfIuKvmVheH",
      "PLqbllT_YPpdPOqPKZcHhiPGo-ScFGM3Xs",
      "PLqi-HJej8budAOCwDJRW4mFF258ZdLG9m"
*/
import _ from 'lodash'

let _cdefaults = {
  el: undefined,
  fps: 30,
  autoUpdate: true,
  serverBase: "http://0.0.0.0:8080/",
  mediaSources: []
}

let _msdefaults = {
  playlists: [],
  jsonUrls: [],
  timeBeforeRequestingNewClip: 4,
  shufflePlaylist: true,
  noAutoStart: false,
  elAttributes: {
    width: 640,
    height: 360,
  },
  videoCanvas: {
    bufferSize: 50
  },
  controller: {
    extentions: []
  },
  quality: {
    chooseBest: true,
  },
  video: true,
  audio: false,
  paused: false,
  verbose: false
}

class Controller {
  constructor(options = _cdefaults) {
    this.el = options.el
    this.fps = options.fps
    this.autoUpdate = options.autoUpdate
    this.serverBase = options.serverBase
    this.mediaSources = options.mediaSources
  }

  newSource(options) {
    options = options || this.getSourceOptions()
    this.mediaSources.push(options)
    return options
  }

  getSourceOptions() {
    return _.clone(_msdefaults)
  }

  toJson() {
    return {
      el: this.el,
      fps: this.fps,
      autoUpdate: this.autoUpdate,
      serverBase: this.serverBase,
      mediaSources: this.mediaSources,
    }
  }
}

export default Controller
