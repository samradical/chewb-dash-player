const VjMediaSourceLoader = (() => {
  let SocketSever

  function setSocketServer(server){
    SocketSever = server
  }

  function rangeRequest(obj){

  }

  return {
    setSocketServer,
    rangeRequest,
  }
})()

export default VjMediaSourceLoader;
