/*
"PLqi-HJej8buf-iyECUqIEiMfIuKvmVheH",
      "PLqbllT_YPpdPOqPKZcHhiPGo-ScFGM3Xs",
      "PLqi-HJej8budAOCwDJRW4mFF258ZdLG9m"
*/
let videoController = {
  playlists: [],
  shufflePlaylist: true,
  extentions: ["loop"]
}

let controller = {
  serverBase: "0.0.0.0:9999"
  el: undefined,
  fps: 30,
  autoUpdate: false,
  mediaSources: [{
    id: "videoOne",
    videoWidth: 480,
    videoHeight: 270,
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
  }]
}

export { controller, videoController }
