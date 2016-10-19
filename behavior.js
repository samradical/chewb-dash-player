import _ from 'lodash'

const B = (() => {
  /*
  Youtube segments are 5.12 sec 
  */
  let DEFAULT = {
    videoPlayDuration: 10
  }

  function get() {
    return _.clone(DEFAULT)
  }

  return {
    get: get
  }
  
})()

export default B