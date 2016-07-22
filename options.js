/*
"PLqi-HJej8buf-iyECUqIEiMfIuKvmVheH",
      "PLqbllT_YPpdPOqPKZcHhiPGo-ScFGM3Xs",
      "PLqi-HJej8budAOCwDJRW4mFF258ZdLG9m"
*/

let videoController = {
  playlists: [],
  jsonUrls: [],
  shufflePlaylist: true,
  noAutoStart:false,
  extentions: ["loop"]
}

let mediaSource = {
  id: "videoOne",
  serverBase: "http://0.0.0.0:8080/",
  elAttributes:{
    width: 640,
    height: 360,
  },
  videoCanvas: {
    bufferSize: 50
  },
  controller: videoController,
  quality: {
    videoOnly: true,
    chooseBest: true,
  },
  paused: false,
  verbose: false
}

let controller = {
  el: undefined,
  fps: 30,
  autoUpdate: false,
  mediaSources: [mediaSource]
}


export { controller, mediaSource, videoController }
