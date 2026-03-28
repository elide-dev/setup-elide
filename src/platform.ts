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

/**
 * Check whether the current system is RPM-based (RHEL, Fedora, CentOS, etc.)
 * by testing for the presence of `/etc/redhat-release`.
 *
 * @return `true` if `/etc/redhat-release` exists.
 */
export async function isRpmBased(): Promise<boolean> {
  try {
    await access('/etc/redhat-release')
    return true
  } catch {
    return false
  }
}
