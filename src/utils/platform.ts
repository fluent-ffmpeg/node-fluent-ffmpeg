export const isWindows: boolean = !!require('os')
  .platform()
  .match(/win(32|64)/)
