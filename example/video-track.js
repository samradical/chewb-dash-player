import Video from './video'
import Config from './config'
import Socket from './socket'

const player = new Video({socket: Socket.localsocket })
player.addSource(config)
player.start()

player.on('MEDIASOURCE_STATE', (state) => {})

//the playlist items
player.on('PLAYLIST', (items) => {})

//a new vo chunk has been added
player.on('VO_ADDED', (vo, msVo) => {})

//over
player.on('VIDEO_FINISHED', (item) => {})

//youtube query items []
		//this.controller.addPlaylistItems(results)

//***********
//UI API
//***********

//id exists in player
	//this.controller.removeIdFromPlaylist(videoId)

//add a new id
//	this.controller.moveToFrontPlaylist(videoId, item)


//GETS
/*get controller() {
	return player.vjPlayer.controllers[0]
}

get mediasource() {
	return player.vjPlayer.mediaSources[0][0]
}
*/
