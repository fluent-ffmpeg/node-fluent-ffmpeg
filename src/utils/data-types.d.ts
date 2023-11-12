/**
 * Ffmpeg processing progress information
 */
export type ProgressInformation = {
  /** Current frame being processed */
  frame?: number
  /** Current processing speed in frames per second */
  fps?: number
  /** Current output bitrate in kbits/s */
  bitrate?: number
  /** Projected output size in kB */
  size?: number
  /** Current timestamp */
  time?: string
  /** Current processing speed (compared to stream time - a speed of 2 means we process a 1h video in 30 minutes) */
  speed?: number
}

/**
 * Ffmpeg codec information for a single input stream
 */
export type InputStreamCodecInformation = {
  /** Input format */
  format?: string
  /** Input duration */
  duration?: string
  /** Input audio codec info */
  audio?: string
  /** Input audio detailed information */
  audioDetails?: string
  /** Input video codec info */
  video?: string
  /** Input video detailed information */
  videoDetails?: string
}

/**
 * Fffmpeg process input information, as an array with one item per input stream
 */
export type InputCodecInformation = InputStreamCodecInformation[]

export type FfmpegCodecType =
  | 'audio'
  | 'video'
  | 'subtitle'
  | 'data'
  | 'attachment'

export type FfmpegCodec = {
  description: string
  type: FfmpegCodecType
  canEncode: boolean
  canDecode: boolean
  encoders?: string[]
  decoders?: string[]
  intraFrame: boolean
  lossy: boolean
  lossless: boolean
}

export type FfmpegCodecs = {
  [key: string]: FfmpegCodec
}

export type FfmpegFormat = {
  description: string
  canMux: boolean
  canDemux: boolean
}

export type FfmpegFormats = {
  [key: string]: FfmpegFormat
}

export type FfmpegFilterStreamType = 'audio' | 'video'

export type FfmpegFilter = {
  description: string
  inputs: FfmpegFilterStreamType[] | 'dynamic'
  outputs: FfmpegFilterStreamType[] | 'dynamic'
}

export type FfmpegFilters = {
  [key: string]: FfmpegFilter
}

export type FfmpegEncoderType = 'audio' | 'video' | 'subtitle'

export type FfmpegEncoder = {
  description: string
  type: FfmpegEncoderType
  frameMultithreading: boolean
  sliceMultithreading: boolean
  experimental: boolean
  drawHorizBand: boolean
  directRendering: boolean
}

export type FfmpegEncoders = {
  [key: string]: FfmpegEncoder
}
