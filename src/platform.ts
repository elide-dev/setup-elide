import { access } from 'node:fs/promises'

/**
 * Check whether the current system is Debian-like (Debian, Ubuntu, etc.)
 * by testing for the presence of `/etc/debian_version`.
 *
 * @return `true` if `/etc/debian_version` exists.
 */
export async function isDebianLike(): Promise<boolean> {
  try {
    await access('/etc/debian_version')
    return true
  } catch {
    return false
  }
}
