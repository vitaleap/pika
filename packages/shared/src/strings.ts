export abstract class Strings {
  static includes(origin: string | undefined, fragment: string): boolean {
    if (!origin) {
      return false
    }
    return origin.includes(fragment)
  }
}
