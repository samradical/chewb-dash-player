/*
"PLqi-HJej8buf-iyECUqIEiMfIuKvmVheH",
      "PLqbllT_YPpdPOqPKZcHhiPGo-ScFGM3Xs",
      "PLqi-HJej8budAOCwDJRW4mFF258ZdLG9m"
*/

let videoController = {
  extentions: ["loop"]
}

let mediaSource = {
  id: "videoOne",
  playlists: [],
  jsonUrls: [],
  shufflePlaylist: true,
  noAutoStart:false,
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

let Controller = {
  el: undefined,
  fps: 30,
  autoUpdate: false,
  serverBase: "http://0.0.0.0:8080/",
  mediaSources: [mediaSource]
}


export { Controller }
