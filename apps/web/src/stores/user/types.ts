export interface User {
  /**
   * 一般表示用户id
   */
  id: string
  /**
   * 一般表示用户id
   */
  sub?: string
  /**
   * 名称，姓名全称或用户名等等
   */
  name?: string
  /**
   * 昵称
   */
  nickname?: string
  /**
   * 头像url地址
   */
  picture?: string
  /**
   * 地址
   */
  address?: string
  /**
   * 性别
   */
  gender?: string
  /**
   * 邮箱
   */
  email?: string
  /**
   * 邮箱是否验证
   */
  email_verified?: boolean
  /**
   * 手机号
   */
  phone_number?: string
  /**
   * 手机号是否验证
   */
  phone_number_verified?: boolean
  /**
   * 角色
   */
  roles?: string[]
  /**
   * 其他属性
   */
  [key: string]: unknown
}
export interface TokenInfo {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in?: string
}
export interface UserState {
  user: User
  tokenInfo?: TokenInfo
}
