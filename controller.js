import _ from 'lodash'

let _cdefaults = {
  el: undefined,
  fps: 30,
  autoUpdate: true,
  serverBase: "http://0.0.0.0:8080/",
  mediaSources: null
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
  constructor(opt = _cdefaults) {
    let options = _.assign({}, _cdefaults, opt)
    this.el = options.el
    this.fps = options.fps
    this.autoUpdate = options.autoUpdate
    this.serverBase = options.serverBase
    this.mediaSources = []
    this.socket = opt.socket
    if(!this.socket){
      throw new Error('Pass a socketIo instance {socket: instance}')
    }
  }

  addSource(options = {}) {
    this.mediaSources.push(_.assign({},
      this.getSourceOptions(),
      options))
    return this.mediaSources[this.mediaSources.length - 1]
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