let audio: HTMLAudioElement | null = null
export function getPrankAudio() {
  audio ??= new Audio('/audio/party-prank.m4a')
  audio.preload = 'auto'
  return audio
}
export function startPrankAudio() {
  const player = getPrankAudio()
  player.currentTime = 0
  return player.play()
}
