import { StaticImageData } from 'next/image'

export type ProfileType = {
  id: number | string
  avatar: string
  name: string
  time: string
}

export type Likes = {
  like: boolean
  value: number
}

export type PostImageType = {
  img: string | StaticImageData
  featured?: boolean
  title?: string
}

export type CommentDataType = {
  name?: string
  comment?: string
  likes?: Likes
  video?: string
  replies?: Reply[]
}

export type Reply = {
  id?: string
  profile?: ProfileType
  data: CommentDataType
}

export type Comment = {
  id: string
  profile: ProfileType
  data?: CommentDataType
}

export type PostDataType = {
  id?: string
  content: string
  images: PostImageType[]
  video?: string
  likes: Likes
  comments?: Comment[]
}

export type PostType = {
  id?: string
  profile: ProfileType
  data: PostDataType
}

export type profiledataType = {
  name: string
  role: string
  avatar: string | StaticImageData
  coverImage: string
  postsCount: number
  followersCount: number
  followingCount: number
}
