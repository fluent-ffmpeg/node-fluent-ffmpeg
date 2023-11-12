export const streamRegexp = /^\[?(.*?)\]?$/

export const protocolRegexp = /^([a-z]{2,}):/i

export const nlRegexp = /\r\n|\r|\n/g

export const durationRegexp = /^(?:(?:(\d{2}):)?(\d{2}):)?(\d{2})(?:\.(\d+))?$/

export const codecInputRegexp = /Input #[0-9]+, ([^ ]+),/
export const codecDurRegexp = /Duration\: ([^,]+)/
export const codecAudioRegexp = /Audio\: (.*)/
export const codecVideoRegexp = /Video\: (.*)/
export const codecOutputRegexp = /Output #\d+/
export const codecEndRegexp = /Stream mapping:|Press (\[q\]|ctrl-c) to stop/

export const filterNeedsEscapeRegexp = /[,]/

export const capFormatRegexp = /^\s*([D ])([E ]) ([^ ]+) +(.*)$/
export const capCodecRegexp =
  /^\s*([D\.])([E\.])([VASDT])([I\.])([L\.])([S\.]) ([^ ]+) +(.*)$/
export const capCodecEncodersRegexp = /\(encoders:([^\)]+)\)/
export const capCodecDecodersRegexp = /\(decoders:([^\)]+)\)/
export const capFilterRegexp =
  /^([T\.])([S\.])([C\.]) +([^ ]+) +([ANV|]+)->([ANV|]+) +(.*)$/
export const capEncoderRegexp =
  /^([AVS\.])([F\.])([S\.])([X\.])([B\.])([D\.]) ([^ ]+) +(.*)$/
